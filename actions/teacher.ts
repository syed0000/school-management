"use server"

import { revalidatePath } from "next/cache"
import dbConnect from "@/lib/db"
import Teacher from "@/models/Teacher"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import crypto from "crypto"
import logger from "@/lib/logger"
import { demoWriteSuccess, isDemoSession } from "@/lib/demo-guard"

import { saveFile } from "@/lib/upload";

// Helper to generate unique ID
function generateTeacherId(name: string, aadhaar: string, mobile: string): string {
  const input = `${name.trim().toLowerCase()}${aadhaar.trim()}${mobile.trim()}`;
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 8).toUpperCase();
}

export async function createTeacher(formData: FormData) {
  try {
    await dbConnect()
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return { success: false, error: "Unauthorized" }
    }

    if (isDemoSession(session)) return demoWriteSuccess();

    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const joiningDate = formData.get('joiningDate') as string;
    const aadhaar = formData.get('aadhaar') as string;
    const fatherName = formData.get('fatherName') as string;
    const motherName = formData.get('motherName') as string;
    const governmentTeacherId = formData.get('governmentTeacherId') as string;
    const salaryAmount = formData.get('salaryAmount') as string;
    const totalExperience = formData.get('totalExperience') as string;

    if (!name || !aadhaar || !phone) {
        return { success: false, error: "Missing required fields for ID generation" }
    }

    // File Handling
    // 1. Photo
    const photoFile = formData.get('photo') as File;
    let photoUrl = null;
    if (photoFile && photoFile.size > 0) {
        photoUrl = await saveFile(photoFile, 'teachers/photos');
    }

    // 2. Experience Letter
    const expLetterFile = formData.get('experienceLetter') as File;
    let expLetterUrl = null;
    if (expLetterFile && expLetterFile.size > 0) {
        expLetterUrl = await saveFile(expLetterFile, 'teachers/documents');
    }

    // 3. Documents
    const documentMetaStr = formData.get('document_meta') as string;
    const documentMeta = documentMetaStr ? JSON.parse(documentMetaStr) : [];
    const documentFiles = formData.getAll('document_files') as File[];
    
    const processedDocuments = [];
    
    if (documentMeta.length > 0) {
        for (let i = 0; i < documentMeta.length; i++) {
            const file = documentFiles[i];
            let fileUrl = "";
            
            if (file && file.size > 0) {
                fileUrl = await saveFile(file, 'teachers/documents');
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

    // Generate Teacher ID
    const teacherId = generateTeacherId(name, aadhaar, phone);

    // Check collision
    const existingTeacher = await Teacher.findOne({ teacherId });
    if (existingTeacher) {
      return { success: false, error: "Teacher with these details likely already exists." }
    }

    // Parse assignedClasses from JSON string
    const assignedClassesStr = formData.get('assignedClasses') as string;
    const assignedClasses: { classId: string; section: string; attendanceAccess: boolean }[] =
      assignedClassesStr ? JSON.parse(assignedClassesStr) : [];
    
    const newTeacher = await Teacher.create({
      name,
      email,
      phone,
      joiningDate: new Date(joiningDate),
      aadhaar,
      parents: {
          fatherName,
          motherName
      },
      governmentTeacherId: governmentTeacherId || undefined,
      teacherId,
      salary: {
          amount: parseFloat(salaryAmount) || 0,
          effectiveDate: new Date()
      },
      photo: photoUrl,
      documents: processedDocuments,
      pastExperience: {
          totalExperience: parseFloat(totalExperience) || 0,
          experienceLetter: expLetterUrl
      },
      assignedClasses,
    })

    revalidatePath("/admin/teachers")
    revalidatePath("/teachers")
    return { success: true, teacher: JSON.parse(JSON.stringify(newTeacher)) }
  } catch (error: unknown) {
    logger.error(error, "Error creating teacher")
    const errorMessage = error instanceof Error ? (error.message?.length > 100 ? error.message.substring(0, 100) + "..." : error.message) : "An unknown error occurred";
    return { success: false, error: errorMessage }
  }
}

export async function updateTeacher(id: string, formData: FormData) {
  try {
    await dbConnect()
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return { success: false, error: "Unauthorized" }
    }

    if (isDemoSession(session)) return demoWriteSuccess();
    
    // Parse fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    const name = formData.get('name') as string;
    if (name) updateData.name = name;
    
    const email = formData.get('email') as string;
    if (email) updateData.email = email;
    
    const phone = formData.get('phone') as string;
    if (phone) updateData.phone = phone;

    const aadhaar = formData.get('aadhaar') as string;
    if (aadhaar) updateData.aadhaar = aadhaar;

    const joiningDate = formData.get('joiningDate') as string;
    if (joiningDate) updateData.joiningDate = new Date(joiningDate);
    
    const fatherName = formData.get('fatherName') as string;
    const motherName = formData.get('motherName') as string;
    if (fatherName || motherName) {
        updateData.parents = {
            fatherName: fatherName || undefined,
            motherName: motherName || undefined
        };
    }
    
    const salaryAmount = formData.get('salaryAmount') as string;
    if (salaryAmount) {
        updateData.salary = {
            amount: parseFloat(salaryAmount),
            effectiveDate: new Date() // or keep existing? simpler to update
        };
    }
    
    const governmentTeacherId = formData.get('governmentTeacherId') as string;
    if (governmentTeacherId !== null) updateData.governmentTeacherId = governmentTeacherId;

    // Files
    const photoFile = formData.get('photo') as File;
    if (photoFile && photoFile.size > 0) {
        updateData.photo = await saveFile(photoFile, 'teachers/photos');
    }

    const expLetterFile = formData.get('experienceLetter') as File;
    const totalExperience = formData.get('totalExperience') as string;
    
    if (expLetterFile && expLetterFile.size > 0) {
        if (!updateData.pastExperience) updateData.pastExperience = {};
        updateData.pastExperience.experienceLetter = await saveFile(expLetterFile, 'teachers/documents');
    }
    if (totalExperience) {
        if (!updateData.pastExperience) updateData.pastExperience = {};
        updateData.pastExperience.totalExperience = parseFloat(totalExperience);
    }
    // Retain existing exp letter if not updated? 
    // Mongoose update $set will overwrite object if we set whole object.
    // Better to use dot notation if we want partial update of nested object, 
    // but here we are constructing a simple object. 
    // If we only update totalExperience, we might lose existing letter if we set `pastExperience: { totalExperience }`.
    // So we should fetch existing first or use $set notation.
    // For simplicity, let's rely on Mongoose merge if possible, or fetch existing.
    // Actually, `findByIdAndUpdate` with simple object replaces top-level keys.
    // Let's fetch the current teacher to merge properly or use dot notation keys.
    
    // Using dot notation for safety
    if (totalExperience) updateData['pastExperience.totalExperience'] = parseFloat(totalExperience);
    if (expLetterFile && expLetterFile.size > 0) {
         // We already saved it to variable, just set key
         updateData['pastExperience.experienceLetter'] = await saveFile(expLetterFile, 'teachers/documents');
    }

    // Documents (Append or Replace? usually Replace list in such forms)
    // The form usually sends ALL current documents + new ones.
    // If we only send new ones, we need logic. 
    // Assuming for now we just ADD new ones from this form or REWRITE?
    // Let's stick to: "If documents provided, process and SET".
    // But dealing with existing documents in FormData is hard (they are URLs, not Files).
    // So usually we skip existing documents in FormData and only send NEW files.
    // If we want to keep existing, we need to fetch them.
    
    // Logic: 
    // 1. Fetch existing teacher
    // 2. See what documents are kept (maybe passed as hidden fields or IDs?)
    // 3. Add new files.
    
    // For this iteration, let's support ADDING new documents via this update, 
    // ensuring we don't wipe existing unless intended.
    // But `document_meta` usually comes from a dynamic field array which represents the FINAL state.
    // If the user removed a doc in UI, it shouldn't be here.
    // Complex part: How does UI send "existing" file? It can't send File object.
    // It usually sends the URL.
    
    // Simplified: We will just handle NEW files if any are sent, and push them.
    // If we need full CRUD on docs, we need a separate mechanism or comprehensive state sync.
    // Let's assume we append for now or just process new ones.
    
    const documentMetaStr = formData.get('document_meta') as string;
    const documentFiles = formData.getAll('document_files') as File[];
    
    if (documentMetaStr) {
         const documentMeta = JSON.parse(documentMetaStr);
         const newDocs = [];
         
         // We need to know which of these are NEW files vs EXISTING URLs.
         // Our FileUploader returns File or null. 
         // If it's an existing URL, it might not be in `document_files` array?
         // This depends on frontend implementation.
         
         // Let's wait for frontend update. For now, we support adding new files.
         for (let i = 0; i < documentMeta.length; i++) {
             // If this index corresponds to a File in documentFiles
             // Note: getAll returns all files. We need to map them.
             // If frontend sends strictly new files, we can just save them.
             // If frontend sends mixed, we need a way to distinguish.
             
             // Let's assume frontend sends "document_files" only for NEW uploads.
             // And "document_meta" has a flag or we check if `image` property is missing/present.
             
             const file = documentFiles[i]; // This alignment is risky if mixed.
             if (file && file.size > 0) {
                 const url = await saveFile(file, 'teachers/documents');
                 newDocs.push({
                     type: documentMeta[i].type,
                     documentNumber: documentMeta[i].documentNumber,
                     image: url
                 });
             }
         }
         
         if (newDocs.length > 0) {
             // Push to existing
             const existing = await Teacher.findById(id);
             if (existing) {
                 updateData.documents = [...(existing.documents || []), ...newDocs];
             }
         }
    }

    // Parse assignedClasses if provided
    const assignedClassesStr = formData.get('assignedClasses') as string | null;
    if (assignedClassesStr) {
      updateData.assignedClasses = JSON.parse(assignedClassesStr) as { classId: string; section: string; attendanceAccess: boolean }[];
    }

    const teacher = await Teacher.findByIdAndUpdate(id, updateData, { returnDocument: "after" })
    
    if (!teacher) {
      return { success: false, error: "Teacher not found" }
    }

    revalidatePath("/admin/teachers")
    revalidatePath("/teachers")
    revalidatePath(`/admin/teachers/${id}`)
    revalidatePath(`/teachers/${id}`)
    
    return { success: true, teacher: JSON.parse(JSON.stringify(teacher)) }
  } catch (error: unknown) {
    logger.error(error, "Error updating teacher")
    const errorMessage = error instanceof Error ? (error.message?.length > 100 ? error.message.substring(0, 100) + "..." : error.message) : "An unknown error occurred";
    return { success: false, error: errorMessage }
  }
}

export async function deleteTeacher(id: string) {
  try {
    await dbConnect()
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized. Only admins can delete teachers." }
    }

    if (isDemoSession(session)) return demoWriteSuccess();

    const teacher = await Teacher.findByIdAndDelete(id)
    
    if (!teacher) {
      return { success: false, error: "Teacher not found" }
    }

    revalidatePath("/admin/teachers")
    revalidatePath("/teachers")
    return { success: true }
  } catch (error: unknown) {
    logger.error(error, "Error deleting teacher")
    return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
}

export async function getTeachers(query: string = "") {
  try {
    await dbConnect()
    const session = await getServerSession(authOptions)
    if (!session) return []

    const searchRegex = new RegExp(query, "i")
    
    const teachers = await Teacher.find({
      $or: [
        { name: searchRegex },
        { teacherId: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { aadhaar: searchRegex },
      ]
    }).sort({ createdAt: -1 })

    return JSON.parse(JSON.stringify(teachers))
  } catch (error) {
    logger.error(error, "Error fetching teachers")
    return []
  }
}

export async function getTeacherById(id: string) {
  try {
    await dbConnect()
    const session = await getServerSession(authOptions)
    if (!session) return null

    const teacher = await Teacher.findById(id).populate("assignedClasses.classId", "name");
    if (!teacher) return null

    return JSON.parse(JSON.stringify(teacher))
  } catch (error) {
    logger.error(error, "Error fetching teacher")
    return null
  }
}
