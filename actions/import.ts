"use server"

import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import Class from "@/models/Class"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isDemoSession } from "@/lib/demo-guard"

// Zod schema for student import
const importStudentSchema = z.object({
  name: z.string().min(2, "Name is required"),
  registrationNumber: z.string().optional(), // Optional, no auto-generation
  
  // Parent details
  fatherName: z.string().min(2, "Father Name is required"),
  fatherAadhaar: z.string().optional().refine(val => !val || /^\d{12}$/.test(val), "Invalid Father Aadhaar"),
  motherName: z.string().optional().default(""),
  motherAadhaar: z.string().optional().refine(val => !val || /^\d{12}$/.test(val), "Invalid Mother Aadhaar"),
  
  className: z.string().min(1, "Class Name is required"),
  section: z.enum(["A", "B", "C", "D"]).optional().default("A"),
  rollNumber: z.string().optional(),
  
  gender: z.enum(["Male", "Female", "Other"]).optional().nullable(),
  dob: z.union([z.string(), z.date()]).optional().transform((val, ctx) => {
      if (!val) return undefined;
      const date = new Date(val);
      if (isNaN(date.getTime())) {
          if (typeof val === 'string') {
              const parts = val.split(/[-/.]/);
              if (parts.length === 3) {
                  const day = parseInt(parts[0], 10);
                  const month = parseInt(parts[1], 10) - 1;
                  const year = parseInt(parts[2], 10);
                  const parsedDate = new Date(year, month, day);
                  if (!isNaN(parsedDate.getTime())) return parsedDate;
              }
          }
          ctx.addIssue({
            code: "custom",
            message: `Invalid Date format: "${val}".`,
          });
          return z.NEVER;
      }
      return date;
  }),
  
  address: z.string().optional().default(""),
  contactNumber: z.string().optional().default(""),
  email: z.string().email().optional(),
  
  // New fields
  pen: z.string().optional(),
  lastInstitution: z.string().optional(),
  tcNumber: z.string().optional(),
  
  dateOfAdmission: z.union([z.string(), z.date()]).optional().transform((val, ctx) => {
      // Logic for default admission date based on session
      if (!val) {
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth(); // 0-11
          
          // Academic session starts April (Month 3)
          // If we are in Jan(0), Feb(1), Mar(2) of 2025, the session is 2024-25. Start date: April 1, 2024.
          // If we are in April(3) to Dec(11) of 2025, the session is 2025-26. Start date: April 1, 2025.
          
          const sessionStartYear = currentMonth < 3 ? currentYear - 1 : currentYear;
          return new Date(sessionStartYear, 3, 1); // April 1st
      }
      
      const date = new Date(val);
       if (isNaN(date.getTime())) {
          if (typeof val === 'string') {
              const parts = val.split(/[-/.]/);
              if (parts.length === 3) {
                  const day = parseInt(parts[0], 10);
                  const month = parseInt(parts[1], 10) - 1;
                  const year = parseInt(parts[2], 10);
                  const parsedDate = new Date(year, month, day);
                  if (!isNaN(parsedDate.getTime())) return parsedDate;
              }
          }
          ctx.addIssue({
            code: "custom",
            message: `Invalid Admission Date format: "${val}"`,
          });
          return z.NEVER;
      }
      return date;
  })
})

export async function bulkImportStudents(data: Record<string, unknown>[], confirm: boolean = false) {
  try {
    const session = await getServerSession(authOptions);
    const demo = isDemoSession(session);
    if (demo) {
      confirm = false;
    }
    await dbConnect();
    
    // Fetch all classes to map names to IDs
    const classes = await Class.find({}).lean();
    const classMap = new Map(classes.map(c => [c.name.trim().toLowerCase(), c._id]));
    
    const results = {
      successCount: 0,
      failureCount: 0,
      errors: [] as string[],
    };

    interface StudentInsert {
        registrationNumber?: string;
        name: string;
        classId: string;
        section: string;
        rollNumber?: string;
        dateOfBirth?: Date;
        parents: {
            father: { name: string; aadhaarNumber?: string };
            mother: { name: string; aadhaarNumber?: string };
        };
        address: string;
        gender?: string | null;
        contacts: { mobile: string[], email: string[] };
        isActive: boolean;
        dateOfAdmission: Date;
        pen?: string;
        lastInstitution?: string;
        tcNumber?: string;
        photo?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        documents?: any[];
    }

    const studentsToInsert: StudentInsert[] = [];
    const batchRegistrationNumbers = new Set<string>(); // Track duplicates within the file itself

    // First pass: Validation and preparation
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2; // Assuming header is row 1
        
        // Helper to get value case-insensitively with variations
        const getVal = (keys: string[]) => {
            for (const k of keys) {
                // Check exact match
                if (row[k] !== undefined) return row[k];
                // Check case-insensitive match
                const lowerK = k.toLowerCase();
                const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === lowerK);
                if (foundKey && row[foundKey] !== undefined) return row[foundKey];
            }
            return undefined;
        };

        const studentName = getVal(["Student Name", "Name", "StudentName"]);
        const fatherName = getVal(["Father Name", "Father's Name", "FatherName"]);
        const className = getVal(["Class Name", "Class", "ClassName"]);
        const regNo = getVal(["Registration Number", "Reg No", "RegistrationNumber", "RegNo"]);

        // Skip empty rows
        if (!studentName && !regNo) continue;

        try {
            const normalizedRow = {
                name: String(studentName || ""),
                registrationNumber: regNo ? String(regNo) : undefined,
                
                fatherName: String(fatherName || ""),
                fatherAadhaar: getVal(["Father Aadhaar", "FatherAadhaar"]) ? String(getVal(["Father Aadhaar", "FatherAadhaar"])) : undefined,
                
                motherName: String(getVal(["Mother Name", "Mother's Name", "MotherName"]) || ""),
                motherAadhaar: getVal(["Mother Aadhaar", "MotherAadhaar"]) ? String(getVal(["Mother Aadhaar", "MotherAadhaar"])) : undefined,
                
                className: String(className || ""),
                section: getVal(["Section"]) ? String(getVal(["Section"])).trim().toUpperCase() || undefined : undefined,
                rollNumber: getVal(["Roll Number", "Roll No", "RollNumber"]) ? String(getVal(["Roll Number", "Roll No", "RollNumber"])) : undefined,
                
                gender: getVal(["Gender"]) ? String(getVal(["Gender"])) : undefined,
                dob: getVal(["Date of Birth", "DOB", "DateOfBirth"]),
                
                address: String(getVal(["Address"]) || ""),
                contactNumber: String(getVal(["Contact Number", "Contact", "Mobile", "Phone"]) || ""),
                email: getVal(["Email", "E-mail"]) ? String(getVal(["Email", "E-mail"])) : undefined,
                
                pen: getVal(["PEN"]) ? String(getVal(["PEN"])) : undefined,
                lastInstitution: getVal(["Last Institution", "Previous School"]) ? String(getVal(["Last Institution", "Previous School"])) : undefined,
                tcNumber: getVal(["TC Number", "TC No"]) ? String(getVal(["TC Number", "TC No"])) : undefined,
                
                dateOfAdmission: getVal(["Admission Date", "Date of Admission", "AdmissionDate"])
            };

            const result = importStudentSchema.safeParse(normalizedRow);
            
            if (!result.success) {
                const errorMessage = result.error.issues.map(i => {
                    if (i.code === "invalid_type") {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const issue = i as any;
                        return `Field '${i.path.join('.')}' expected ${issue.expected}, received ${issue.received}`;
                    }
                    return i.message;
                }).join(", ");
                throw new Error(`${errorMessage} (Student: ${normalizedRow.name})`);
            }

            const validated = result.data;
            
            // Check Class
            const classId = classMap.get(validated.className.trim().toLowerCase());
            if (!classId) {
                throw new Error(`Class "${validated.className}" not found`);
            }
            
            // Handle Registration Number (Only if provided)
            if (validated.registrationNumber) {
                // Check duplicate in current batch
                if (batchRegistrationNumbers.has(validated.registrationNumber)) {
                     throw new Error(`Duplicate Registration Number "${validated.registrationNumber}" in file`);
                }
                batchRegistrationNumbers.add(validated.registrationNumber);
            }

            studentsToInsert.push({
                registrationNumber: validated.registrationNumber, // Can be undefined now
                name: validated.name,
                classId: classId.toString(),
                section: validated.section,
                rollNumber: validated.rollNumber,
                dateOfBirth: validated.dob,
                
                parents: {
                    father: {
                        name: validated.fatherName,
                        aadhaarNumber: validated.fatherAadhaar
                    },
                    mother: {
                        name: validated.motherName || "N/A",
                        aadhaarNumber: validated.motherAadhaar
                    }
                },
                
                address: validated.address || "N/A",
                gender: validated.gender,
                contacts: {
                    mobile: validated.contactNumber ? [validated.contactNumber] : [],
                    email: validated.email ? [validated.email] : []
                },
                isActive: true,
                dateOfAdmission: validated.dateOfAdmission,
                
                pen: validated.pen,
                lastInstitution: validated.lastInstitution,
                tcNumber: validated.tcNumber
            });

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unknown error";
            results.failureCount++;
            results.errors.push(`Row ${rowNumber}: ${message}`);
        }
    }

    // Second pass: Check DB for existing registration numbers
    const regsToCheck = Array.from(batchRegistrationNumbers);
    
    let existingRegSet = new Set<string>();
    if (regsToCheck.length > 0) {
        const existingRegs = await Student.find({ 
            registrationNumber: { $in: regsToCheck } 
        }).select('registrationNumber');
        existingRegSet = new Set(existingRegs.map(s => s.registrationNumber));
    }
    
    const finalBatch: StudentInsert[] = [];
    
    for (const student of studentsToInsert) {
            // Fix missing DOB before insert if needed
        if (!student.dateOfBirth) student.dateOfBirth = new Date("2020-01-01"); 
        
        // If reg number is provided, check uniqueness. If not, it's okay (optional).
        if (student.registrationNumber && existingRegSet.has(student.registrationNumber)) {
            results.failureCount++;
            results.errors.push(`Registration Number "${student.registrationNumber}" already exists in database`);
        } else {
            finalBatch.push(student);
        }
    }

    if (confirm && finalBatch.length > 0) {
        await Student.insertMany(finalBatch);
        
        revalidatePath('/students/list');
        revalidatePath('/admin/dashboard');
    }
    
    results.successCount = finalBatch.length;

    return { success: true, ...results };
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
