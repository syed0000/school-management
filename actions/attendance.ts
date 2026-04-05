"use server"

import dbConnect from "@/lib/db"
import Attendance from "@/models/Attendance"
import Student from "@/models/Student"
import Class from "@/models/Class"
import { revalidatePath } from "next/cache"
import { getSchoolDateBoundaries } from "@/lib/tz-utils"
import { Types } from "mongoose"
import logger from "@/lib/logger"
import { checkIsHoliday } from "@/actions/holiday"

interface StudentDoc {
  _id: Types.ObjectId;
  name: string;
  rollNumber?: string;
  registrationNumber: string;
  photo?: string;
  classId: Types.ObjectId;
  section: string;
  isActive: boolean;
  parents?: {
    father?: { name?: string };
    mother?: { name?: string };
  };
}

interface ClassDoc {
  _id: Types.ObjectId;
  name: string;
  sections: string[];
}

export interface StudentForAttendance {
  id: string
  name: string
  rollNumber: string
  registrationNumber: string
  photo: string
  currentStatus: string | null
  remarks?: string
  fatherName?: string
}

interface AttendanceRecord {
  studentId: Types.ObjectId;
  status: 'Present' | 'Absent' | 'Late' | 'Holiday';
  remarks?: string;
}

interface AttendanceDoc {
  _id: Types.ObjectId;
  date: Date;
  classId: Types.ObjectId;
  section: string;
  records: AttendanceRecord[];
  markedBy: Types.ObjectId;
  isHoliday: boolean;
  holidayReason?: string;
}

export async function getStudentsForAttendance(classId: string, section: string, date: string) {
  try {
    await dbConnect()

    if (!classId || !Types.ObjectId.isValid(classId)) {
      return { success: false, error: "Invalid Class ID" }
    }

    const searchDate = new Date(date)
    const { startUtc: start, endUtc: end } = await getSchoolDateBoundaries(searchDate)

    // Parallel fetch: Students and Existing Attendance
    const [students, existingAttendance, holidayCheck] = await Promise.all([
      Student.find({
        classId: classId,
        section: section,
        isActive: true
      }).sort({ name: 1 }).lean(),
      Attendance.findOne({
        classId: classId,
        section: section,
        date: { $gte: start, $lte: end }
      }).lean(),
      checkIsHoliday(date)
    ])

    const attendanceDoc = existingAttendance as unknown as AttendanceDoc | null;
    let isHoliday = attendanceDoc?.isHoliday || false;
    let holidayReason = attendanceDoc?.holidayReason || null;

    if (!attendanceDoc && holidayCheck.isHoliday) {
      isHoliday = true;
      holidayReason = holidayCheck.reason;
    }

    const result: StudentForAttendance[] = (students as unknown as StudentDoc[]).map((s) => {
      let status: string | null = isHoliday ? 'Holiday' : null;

      // If record exists, override with specific status
      if (attendanceDoc) {
        const record = attendanceDoc.records.find((r) => r.studentId?.toString() === s._id.toString());
        if (record) {
          status = record.status;
        }
      }

      return {
        id: s._id.toString(),
        name: s.name,
        rollNumber: s.rollNumber || "",
        registrationNumber: s.registrationNumber,
        photo: s.photo || "",
        currentStatus: status,
        remarks: "",
        fatherName: s.parents?.father?.name || ""
      }
    })

    return { success: true, students: result, isHoliday, holidayReason }
  } catch (error: unknown) {
    logger.error(error, "Error fetching students for attendance")
    return { success: false, error: `Failed to fetch students: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

interface SaveAttendanceParams {
  date: string
  classId: string
  section: string
  records: {
    studentId: string
    status: 'Present' | 'Absent' | 'Late' | 'Holiday'
    remarks?: string
  }[]
  markedBy: string
  isHoliday?: boolean
  holidayReason?: string
}

export async function saveAttendance({
  date,
  classId,
  section,
  records,
  markedBy,
  isHoliday = false,
  holidayReason
}: SaveAttendanceParams) {
  try {
    await dbConnect()

    const attendanceDate = new Date(date)
    const { startUtc: start, endUtc: end } = await getSchoolDateBoundaries(attendanceDate)

    const updateData = {
      date: attendanceDate,
      classId,
      section,
      records: records.map((r) => ({
        studentId: r.studentId,
        status: r.status,
        remarks: r.remarks
      })),
      markedBy,
      isHoliday,
      holidayReason: isHoliday ? holidayReason : undefined
    }

    await Attendance.findOneAndUpdate(
      {
        classId: classId,
        section: section,
        date: { $gte: start, $lte: end }
      },
      updateData,
      { upsert: true, new: true }
    )

    revalidatePath("/attendance/dashboard")
    return { success: true }
  } catch (error: unknown) {
    logger.error(error, "Error saving attendance")
    return { success: false, error: "Failed to save attendance" }
  }
}

export async function getClassesForAttendance() {
  try {
    await dbConnect();
    const classes = await Class.find({ isActive: true }).select('name sections').lean();
    return (classes as unknown as ClassDoc[]).map((c) => ({
      id: c._id.toString(),
      name: c.name
    }));
  } catch (error: unknown) {
    logger.error(error, "Error fetching classes")
    return [];
  }
}
