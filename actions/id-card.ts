"use server"

import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import Setting from "@/models/Setting"
import { saveFile } from "@/lib/upload"

export async function generateIdCard(studentId: string) {
  await dbConnect();
  
  const student = await Student.findById(studentId).populate('classId', 'name').lean();
  if (!student) throw new Error("Student not found");
  
  return {
    success: true,
    data: {
      id: student._id.toString(),
      name: student.name,
      registrationNumber: student.registrationNumber,
      className: student.classId.name,
      section: student.section,
      fatherName: student.parents?.father?.name || student.fatherName,
      dob: student.dateOfBirth,
      address: student.address,
      mobile: student.contacts?.mobile?.[0] || '',
      photo: student.photo
    }
  };
}

export async function generateBulkIdCards(classId: string) {
  await dbConnect();
  
  const students = await Student.find({ classId, isActive: true })
    .populate('classId', 'name')
    .sort({ name: 1 })
    .lean();
    
  if (!students.length) return { success: false, error: "No students found in this class" };
  
  interface IdCardData {
      _id: { toString: () => string };
      name: string;
      registrationNumber: string;
      classId: { name: string };
      section: string;
      fatherName: string;
      parents?: { father?: { name?: string } };
      dateOfBirth: Date;
      address: string;
      contacts?: { mobile?: string[] };
      photo?: string;
  }

  const data = students.map((s: unknown) => {
    const student = s as IdCardData;
    return {
        id: student._id.toString(),
        name: student.name,
        registrationNumber: student.registrationNumber,
        className: student.classId.name,
        section: student.section,
        fatherName: student.parents?.father?.name || student.fatherName,
        dob: student.dateOfBirth,
        address: student.address,
        mobile: student.contacts?.mobile?.[0] || '',
        photo: student.photo
    };
  });
  
  return {
    success: true,
    data
  };
}

export async function saveSignature(formData: FormData, config: { x: number, y: number, scale: number }) {
  await dbConnect();
  
  const file = formData.get('file') as File;
  let signatureUrl = formData.get('signatureUrl') as string;

  if (file) {
    signatureUrl = await saveFile(file, 'signatures');
  }

  if (!signatureUrl) {
    throw new Error("No signature URL or file provided");
  }

  await Setting.findOneAndUpdate(
    { key: "id_card_signature" },
    { 
      value: {
        url: signatureUrl,
        ...config
      } 
    },
    { upsert: true, new: true }
  );

  return { success: true, url: signatureUrl };
}

export async function getSignature() {
  await dbConnect();
  const setting = await Setting.findOne({ key: "id_card_signature" }).lean();
  return setting ? setting.value : null;
}
