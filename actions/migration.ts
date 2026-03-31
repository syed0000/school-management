"use server"

import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import { revalidatePath } from "next/cache"

export async function getStudentsByClass(classId: string) {
  await dbConnect();
  if (!classId) return [];
  
  interface StudentDoc {
    _id: { toString: () => string };
    name: string;
    registrationNumber: string;
    fatherName: string;
    photo?: string;
  }

  const students = await Student.find({ classId, isActive: true })
    .select('name registrationNumber fatherName photo')
    .sort({ name: 1 })
    .lean();
    
  return students.map((s: unknown) => {
    const student = s as StudentDoc;
    return {
      id: student._id.toString(),
      name: student.name,
      registrationNumber: student.registrationNumber,
      fatherName: student.fatherName,
      photo: student.photo
    };
  });
}

export async function getInactiveStudentsByClass(classId: string) {
  await dbConnect();
  if (!classId) return [];
  
  interface StudentDoc {
    _id: { toString: () => string };
    name: string;
    registrationNumber: string;
    fatherName: string;
    photo?: string;
  }

  const students = await Student.find({ classId, isActive: false })
    .select('name registrationNumber fatherName photo')
    .sort({ name: 1 })
    .lean();
    
  return students.map((s: unknown) => {
    const student = s as StudentDoc;
    return {
      id: student._id.toString(),
      name: student.name,
      registrationNumber: student.registrationNumber,
      fatherName: student.fatherName,
      photo: student.photo
    };
  });
}

export async function migrateStudents(studentIds: string[], targetClassId: string) {
  try {
    await dbConnect();
    
    if (!studentIds.length || !targetClassId) {
        return { success: false, error: "Invalid input" };
    }

    const result = await Student.updateMany(
        { _id: { $in: studentIds } },
        { 
          $set: { classId: targetClassId },
          $unset: { rollNumber: 1 }
        }
    );

    revalidatePath("/students/list");
    revalidatePath("/admin/dashboard");
    
    return { success: true, count: result.modifiedCount };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}

export async function bulkDeactivateStudents(studentIds: string[]) {
  try {
    await dbConnect();
    
    if (!studentIds.length) {
        return { success: false, error: "No students selected" };
    }

    const result = await Student.updateMany(
        { _id: { $in: studentIds } },
        { $set: { isActive: false } }
    );

    revalidatePath("/students/list");
    revalidatePath("/admin/dashboard");
    
    return { success: true, count: result.modifiedCount };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}

export async function bulkReactivateStudents(studentIds: string[]) {
  try {
    await dbConnect();
    
    if (!studentIds.length) {
        return { success: false, error: "No students selected" };
    }

    const result = await Student.updateMany(
        { _id: { $in: studentIds } },
        { $set: { isActive: true } }
    );

    revalidatePath("/students/list");
    revalidatePath("/admin/dashboard");
    
    return { success: true, count: result.modifiedCount };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}
