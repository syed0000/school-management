"use server"

import dbConnect from "@/lib/db"
import Attendance from "@/models/Attendance"
import { startOfDay, endOfDay } from "date-fns"
import logger from "@/lib/logger"

interface AttendanceReportFilter {
  startDate?: Date;
  endDate?: Date;
  classId?: string;
  studentId?: string;
}

interface AttendanceHistoryItem {
  id: string
  date: string
  className: string
  classId: string
  section: string
  totalStudents: number
  presentCount: number
  absentCount: number
  holidayCount: number
  markedBy: string
  updatedAt: string
}

interface AttendanceRecordLean {
  status?: string
}

interface AttendanceClassLean {
  _id?: { toString(): string } | string
  name?: string
}

interface AttendanceUserLean {
  name?: string
}

interface AttendanceDocLean {
  _id: { toString(): string }
  date: Date
  classId?: AttendanceClassLean | { toString(): string } | string
  section?: string
  records?: AttendanceRecordLean[]
  markedBy?: AttendanceUserLean | { toString(): string } | string
  isHoliday?: boolean
  updatedAt: Date
}

export async function getAttendanceReport(filter: AttendanceReportFilter): Promise<AttendanceHistoryItem[]> {
  try {
    await dbConnect();
    
    const query: Record<string, unknown> = {};
    
    if (filter.startDate && filter.endDate) {
      query.date = {
        $gte: startOfDay(filter.startDate),
        $lte: endOfDay(filter.endDate)
      };
    } else if (filter.startDate) {
        query.date = {
            $gte: startOfDay(filter.startDate),
            $lte: endOfDay(filter.startDate)
        };
    }
    
    if (filter.classId && filter.classId !== 'all') {
      query.classId = filter.classId;
    }

    const attendanceRecords = (await Attendance.find(query)
      .populate('classId', 'name')
      .populate('markedBy', 'name')
      .sort({ date: -1 })
      .lean()) as unknown as AttendanceDocLean[];
      
    return attendanceRecords.map((record) => {
      const records = record.records ?? []
      const presentCount = records.filter((r) => r.status === "Present").length
      const absentCount = records.filter((r) => r.status === "Absent").length
      const holidayCount = records.filter((r) => r.status === "Holiday").length

      const effectiveHolidayCount = record.isHoliday ? records.length : holidayCount
      const effectivePresentCount = record.isHoliday ? 0 : presentCount
      const effectiveAbsentCount = record.isHoliday ? 0 : absentCount

      const classDoc =
        record.classId && typeof record.classId === "object" ? (record.classId as AttendanceClassLean) : null

      return {
        id: record._id.toString(),
        date: record.date.toISOString(),
        className: classDoc?.name || "Unknown",
        classId:
          classDoc?._id && typeof classDoc._id === "object"
            ? classDoc._id.toString()
            : classDoc?._id?.toString?.() || String(record.classId || ""),
        section: record.section || "",
        totalStudents: records.length,
        presentCount: effectivePresentCount,
        absentCount: effectiveAbsentCount,
        holidayCount: effectiveHolidayCount,
        markedBy:
          record.markedBy && typeof record.markedBy === "object"
            ? (record.markedBy as AttendanceUserLean).name || "Unknown"
            : "Unknown",
        updatedAt: record.updatedAt.toISOString(),
      }
    });
  } catch (error: unknown) {
    logger.error(error, "Error fetching attendance report");
    return [];
  }
}
