"use server"

import mongoose from "mongoose";
import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import Class from "@/models/Class"
import Counter from "@/models/Counter"
import ClassFee from "@/models/ClassFee"
import { revalidatePath } from "next/cache"
import { z } from "zod"

export async function getClasses() {
  await dbConnect();

  interface ClassDoc {
    _id: { toString: () => string };
    name: string;
    exams?: string[];
  }

  const classes = await Class.find({ isActive: true }).sort({ name: 1 }).lean();
  return classes.map((c: unknown) => {
    const cls = c as ClassDoc;
    return {
      id: cls._id.toString(),
      name: cls.name,
      exams: cls.exams || []
    };
  });
}

const parentSchema = z.object({
  name: z.string().optional(),
  aadhaarNumber: z.string().regex(/^\d{12}$/, "Aadhaar number must be 12 digits").optional().or(z.literal("")),
}).optional();

const registerStudentSchema = z.object({
  registrationNumber: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  classId: z.string().min(1, "Class is required"),
  section: z.enum(["A", "B", "C", "D"]).default("A"),
  rollNumber: z.string().optional(),
  dateOfBirth: z.string().min(1, "Date of Birth is required"),
  dateOfAdmission: z.string().optional(), // Can be string from form
  gender: z.enum(["Male", "Female", "Other"]).optional().nullable(),
  aadhaar: z.string().optional().or(z.literal("")),
  
  parents: z.object({
    father: parentSchema,
    mother: parentSchema
  }).optional(),

  // Legacy fields for backward compatibility/form handling
  fatherName: z.string().optional(), 
  motherName: z.string().optional(),

  address: z.string().min(1, "Address is required"),
  mobile: z.array(z.string().min(10, "Valid mobile number is required")).min(1, "At least one mobile number is required"),
  email: z.array(z.string().email("Invalid email")).optional(),
  photo: z.string().nullable().optional(),
  documents: z.array(z.object({
    type: z.string(),
    image: z.string(),
    documentNumber: z.string().optional()
  })).optional(),
  
  pen: z.string().optional(),
  lastInstitution: z.string().optional(),
  tcNumber: z.string().optional(),
})

export async function getNextRegistrationNumber() {
  await dbConnect();
  
  // Try to find existing counter
  let counter = await Counter.findById('registrationNumber');
  
  if (!counter) {
    // If not exists, initialize with 214 so next is 215
    counter = await Counter.create({ _id: 'registrationNumber', seq: 214 });
  }
  
  // Return the *next* number (seq + 1) formatted
  let nextSeq = counter.seq + 1;
  let nextRegNo = String(nextSeq).padStart(4, '0');

  // Check for collision and auto-heal
  // If the calculated next number already exists in Students, the counter is stale.
  let attempts = 0;
  while (attempts < 100 && await Student.exists({ registrationNumber: nextRegNo })) {
      // Update counter to match the existing student's number
      await Counter.findByIdAndUpdate(
          'registrationNumber',
          { $set: { seq: nextSeq } },
          { new: true }
      );
      nextSeq++;
      nextRegNo = String(nextSeq).padStart(4, '0');
      attempts++;
  }

  return nextRegNo;
}

// Function to actually increment and get
async function incrementRegistrationNumber() {
  await dbConnect();
  const counter = await Counter.findByIdAndUpdate(
    'registrationNumber',
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  
  return String(counter.seq).padStart(4, '0');
}


import logger from "@/lib/logger";
import { saveFile } from "@/lib/upload";

export async function registerStudent(formData: FormData) {
  try {
    await dbConnect();

    // Parse manual JSON fields
    const rawData = {
      name: formData.get('name') as string,
      classId: formData.get('classId') as string,
      section: formData.get('section') as "A" | "B" | "C" | "D",
      rollNumber: formData.get('rollNumber') as string,
      dateOfBirth: formData.get('dateOfBirth') as string,
      dateOfAdmission: formData.get('dateOfAdmission') as string,
      gender: formData.get('gender') as "Male" | "Female" | "Other",
      aadhaar: formData.get('aadhaar') as string,
      address: formData.get('address') as string,
      fatherName: formData.get('fatherName') as string,
      fatherAadhaar: formData.get('fatherAadhaar') as string,
      motherName: formData.get('motherName') as string,
      motherAadhaar: formData.get('motherAadhaar') as string,
      pen: formData.get('pen') as string,
      lastInstitution: formData.get('lastInstitution') as string,
      tcNumber: formData.get('tcNumber') as string,
      registrationNumber: formData.get('registrationNumber') as string,
    };

    // Extract arrays (mobile, email)
    const mobile = formData.getAll('mobile') as string[];
    const email = formData.getAll('email') as string[];

    // --- File Upload Handling ---
    
    // 1. Profile Photo
    const photoFile = formData.get('photo') as File;
    let photoUrl = null;
    if (photoFile && photoFile.size > 0) {
        photoUrl = await saveFile(photoFile, 'students/photos');
    }

    // 2. Documents
    const documentMetaStr = formData.get('document_meta') as string;
    const documentMeta = documentMetaStr ? JSON.parse(documentMetaStr) : [];
    const documentFiles = formData.getAll('document_files') as File[];
    
    const processedDocuments = [];
    
    if (documentMeta.length > 0) {
        for (let i = 0; i < documentMeta.length; i++) {
            const file = documentFiles[i];
            let fileUrl = "";
            
            if (file && file.size > 0) {
                fileUrl = await saveFile(file, 'students/documents');
            }
            
            if (fileUrl) {
                processedDocuments.push({
                    type: documentMeta[i].type,
                    documentNumber: documentMeta[i].documentNumber,
                    image: fileUrl
                });
            }
        }
    }

    // --- End File Upload Handling ---

    let registrationNumber = rawData.registrationNumber;
    
    if (!registrationNumber) {
        registrationNumber = await incrementRegistrationNumber();
    } else {
        const existing = await Student.findOne({ registrationNumber });
        if (existing) {
             return { success: false, error: "Registration Number already exists" };
        }

        // Sync counter if manual registration number is provided (and it's a number)
        // This ensures the auto-increment sequence catches up if the user manually uses the "next" number
        const regNumInt = parseInt(registrationNumber);
        if (!isNaN(regNumInt)) {
             const counter = await Counter.findById('registrationNumber');
             // If counter doesn't exist or provided number is higher than current sequence
             if (!counter || regNumInt > counter.seq) {
                 await Counter.findOneAndUpdate(
                    { _id: 'registrationNumber' },
                    { $set: { seq: regNumInt } },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                 );
             }
        }
    }

    const parents = {
        father: {
            name: rawData.fatherName,
            aadhaarNumber: rawData.fatherAadhaar
        },
        mother: {
            name: rawData.motherName,
            aadhaarNumber: rawData.motherAadhaar
        }
    };
    
    // Create student first
    await Student.create({
      registrationNumber,
      name: rawData.name,
      classId: rawData.classId,
      section: rawData.section,
      rollNumber: rawData.rollNumber?.trim() || undefined,
      dateOfBirth: new Date(rawData.dateOfBirth),
      dateOfAdmission: rawData.dateOfAdmission ? new Date(rawData.dateOfAdmission) : new Date(),
      gender: rawData.gender,
      aadhaar: rawData.aadhaar,
      
      parents,
      fatherName: parents.father.name,
      motherName: parents.mother.name,

      address: rawData.address,
      contacts: {
        mobile: mobile,
        email: email
      },
      photo: photoUrl,
      documents: processedDocuments,
      
      pen: rawData.pen,
      lastInstitution: rawData.lastInstitution,
      tcNumber: rawData.tcNumber,
      
      isActive: true,
    });

    // Auto-assign fees for the new student
    // Fetch class fees
    const classFees = await ClassFee.find({ 
        classId: rawData.classId, 
        isActive: true,
        type: { $in: ['admission', 'admissionFees', 'registrationFees'] }
    }).lean();

    if (classFees.length > 0) {
        // const currentYear = new Date().getFullYear();
        // Since session starts April, if current month < 3 (April), year is prev year
        // Actually, for admission, it's usually current academic year.
        // Let's stick to simple logic: current calendar year or academic year based on session util
        // For now, let's use the year from dateOfAdmission
        // const admissionYear = newStudent.dateOfAdmission.getFullYear();
        // const admissionMonth = newStudent.dateOfAdmission.getMonth();
        // If admission is Jan-March, it might be end of previous session or start of new session?
        // Usually new session starts April.
        // Let's assume academic year is year of admission if month >= 3, else year-1
        // const academicYear = admissionMonth >= 3 ? admissionYear : admissionYear - 1;

        // We don't automatically create transactions as paid, but we could create "pending" transactions if we had a proper ledger system.
        // But the current system creates transaction ON PAYMENT.
        // So we don't need to do anything here. The fees will show up as "due" in the fee collection form because they are defined in ClassFee.
    }
    
    revalidatePath("/students/list");
    
    return { success: true, regNo: registrationNumber };
  } catch (error: unknown) {
    logger.error(error, "Failed to register student");
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}

export async function updateStudent(id: string, data: z.infer<typeof registerStudentSchema>) {
    try {
      registerStudentSchema.parse(data);
      await dbConnect();
      
      // Prepare parents object
      const parents = {
        father: {
            name: data.parents?.father?.name || data.fatherName,
            aadhaarNumber: data.parents?.father?.aadhaarNumber
        },
        mother: {
            name: data.parents?.mother?.name || data.motherName,
            aadhaarNumber: data.parents?.mother?.aadhaarNumber
        }
      };

      interface StudentUpdateData {
          name: string;
          classId: string;
          section?: string;
          rollNumber?: string;
          dateOfBirth: Date;
          dateOfAdmission?: Date;
          gender?: string | null;
          aadhaar?: string;
          parents?: {
            father: { name?: string; aadhaarNumber?: string };
            mother: { name?: string; aadhaarNumber?: string };
          };
          fatherName: string;
          motherName: string;
          address: string;
          contacts: { mobile: string[], email: string[] };
          photo?: string | null;
          documents?: { type: string, image: string, documentNumber?: string }[];
          registrationNumber?: string;
          pen?: string;
          lastInstitution?: string;
          tcNumber?: string;
      }

      const updateData: StudentUpdateData = {
        name: data.name,
        classId: data.classId,
        section: data.section,
        rollNumber: data.rollNumber?.trim() || undefined,
        dateOfBirth: new Date(data.dateOfBirth),
        dateOfAdmission: data.dateOfAdmission ? new Date(data.dateOfAdmission) : undefined,
        gender: data.gender,
        aadhaar: data.aadhaar,
        
        parents,
        fatherName: parents.father.name || "",
        motherName: parents.mother.name || "",
        
        address: data.address,
        contacts: {
            mobile: data.mobile,
            email: data.email || []
        },
        photo: data.photo,
        documents: data.documents,
        
        pen: data.pen,
        lastInstitution: data.lastInstitution,
        tcNumber: data.tcNumber,
      };

      if (data.registrationNumber) {
        // Check uniqueness if changing
        const existing = await Student.findOne({ 
            registrationNumber: data.registrationNumber,
            _id: { $ne: id }
        });
        if (existing) {
             return { success: false, error: "Registration Number already exists" };
        }
        updateData.registrationNumber = data.registrationNumber;
      }
      
      // Robustly handle empty rollNumbers by explicitly unsetting them
      // This circumvents the duplicate key partial index collision for empty strings.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const finalUpdateObj: any = { $set: updateData, $unset: {} };
      if (!updateData.rollNumber) {
          delete updateData.rollNumber;
          finalUpdateObj.$unset.rollNumber = 1;
      }
      
      await Student.findByIdAndUpdate(id, finalUpdateObj);
      
      revalidatePath("/students/list");
      revalidatePath(`/students/${id}`);
      
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      return { success: false, error: message };
    }
}

export async function deleteStudent(id: string) {
    try {
        await dbConnect();
        await Student.findByIdAndUpdate(id, { isActive: false });
        revalidatePath("/students/list");
        return { success: true };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        return { success: false, error: message };
    }
}

interface StudentQuery {
    isActive: boolean;
    $or?: { [key: string]: { $regex: string, $options: string } }[];
    classId?: string;
}

interface StudentDoc {
    _id: { toString: () => string };
    registrationNumber: string;
    name: string;
    gender?: string;
    aadhaar?: string;
    classId?: { name: string; _id: { toString: () => string } };
    section?: string;
    rollNumber?: string;
    fatherName: string; // legacy
    parents?: { father?: { name?: string; aadhaarNumber?: string }, mother?: { name?: string; aadhaarNumber?: string } };
    contacts?: { mobile?: string[]; email?: string[] };
    photo?: string;
    motherName: string; // legacy
    dateOfBirth: Date;
    dateOfAdmission?: Date;
    address: string;
    documents?: { type: string; image: string; documentNumber?: string; _id?: { toString: () => string } }[];
    pen?: string;
    lastInstitution?: string;
    tcNumber?: string;
    createdAt?: Date;
}

export async function getStudents(searchQuery?: string, classId?: string) {
  await dbConnect();
  
  const query: StudentQuery = { isActive: true };
  
  if (searchQuery) {
    const regex = { $regex: searchQuery, $options: 'i' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orConditions: any[] = [
      { name: regex },
      { registrationNumber: regex },
      { rollNumber: regex }
    ];
    query.$or = orConditions;
  }
  
  if (classId && classId !== "all") {
    query.classId = classId;
  }
  
  const students = await Student.find(query)
    .populate('classId', 'name')
    .sort({ createdAt: -1 })
    .lean();
    
  return students.map((s: unknown) => {
    const student = s as StudentDoc;
    return {
      id: student._id.toString(),
      registrationNumber: student.registrationNumber,
      name: student.name,
      gender: student.gender,
      aadhaar: student.aadhaar,
      className: student.classId?.name || 'Unknown',
      section: student.section,
      rollNumber: student.rollNumber,
      fatherName: student.parents?.father?.name || student.fatherName,
      mobile: student.contacts?.mobile?.[0] || '', // Display first mobile
      photo: student.photo,
    };
  });
}

export async function getStudentById(id: string) {
  await dbConnect();

  // Validate if the ID is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const student = await Student.findById(id).populate('classId', 'name').lean();
  if (!student) return null;
  
  const s = student as unknown as StudentDoc;
  
  return {
    id: s._id.toString(),
    registrationNumber: s.registrationNumber,
    name: s.name,
    classId: s.classId?._id.toString() || '',
    className: s.classId?.name || '',
    section: s.section || 'A',
    rollNumber: s.rollNumber || '',
    gender: (s.gender as "Male" | "Female" | "Other") || "Male",
    aadhaar: s.aadhaar || '',
    
    fatherName: s.parents?.father?.name || s.fatherName,
    fatherAadhaar: s.parents?.father?.aadhaarNumber || '',
    motherName: s.parents?.mother?.name || s.motherName,
    motherAadhaar: s.parents?.mother?.aadhaarNumber || '',
    
    email: s.contacts?.email || [],
    dateOfBirth: s.dateOfBirth ? s.dateOfBirth.toISOString().split('T')[0] : '',
    dateOfAdmission: s.dateOfAdmission ? s.dateOfAdmission.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    
    address: s.address,
    mobile: s.contacts?.mobile || [],
    photo: s.photo,
    documents: s.documents ? s.documents.map((doc) => ({
        type: doc.type,
        image: doc.image,
        documentNumber: doc.documentNumber,
        _id: doc._id ? doc._id.toString() : undefined
    })) : [],
    
    pen: s.pen || '',
    lastInstitution: s.lastInstitution || '',
    tcNumber: s.tcNumber || '',
  };
}
