'use server';

import { unstable_cache } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Teacher from '@/models/Teacher';
import { Types } from 'mongoose';
import logger from '@/lib/logger';
import type { TeacherClassAccess } from '@/types';
import { getAttendanceReport, getFeeReport } from '@/actions/reports';
import { saveAttendance } from '@/actions/attendance';

// ---------------------------------------------------------------------------
// Internal interfaces
// ---------------------------------------------------------------------------

interface AssignedClassDoc {
  classId: { _id: Types.ObjectId; name: string } | Types.ObjectId;
  section: string;
  attendanceAccess: boolean;
}

interface TeacherDoc {
  _id: Types.ObjectId;
  assignedClasses: AssignedClassDoc[];
}

function resolveClassId(classField: AssignedClassDoc['classId']): { _id: string; name: string } {
  if (classField && typeof classField === 'object' && 'name' in classField) {
    const populated = classField as { _id: Types.ObjectId; name: string };
    return { _id: populated._id.toString(), name: populated.name };
  }
  return { _id: (classField as Types.ObjectId).toString(), name: '' };
}

// ---------------------------------------------------------------------------
// getTeacherClassAccess — returns the teacher's permitted class list
// ---------------------------------------------------------------------------

export async function getTeacherClassAccess(teacherSessionId: string): Promise<TeacherClassAccess[]> {
  const fetcher = unstable_cache(
    async (tid: string) => {
      await dbConnect();
      const teacher = await Teacher.findById(tid)
        .populate('assignedClasses.classId', 'name')
        .select('assignedClasses')
        .lean() as unknown as TeacherDoc | null;

      if (!teacher) return [];

      return teacher.assignedClasses.map((ac) => {
        const cls = resolveClassId(ac.classId);
        return {
          classId: cls._id,
          className: cls.name,
          section: ac.section,
          attendanceAccess: ac.attendanceAccess,
        } satisfies TeacherClassAccess;
      });
    },
    [`teacher-class-access-${teacherSessionId}`],
    { revalidate: 300, tags: [`teacher-${teacherSessionId}`] },
  );

  try {
    return await fetcher(teacherSessionId);
  } catch (error) {
    logger.error(error, 'getTeacherClassAccess failed');
    return [];
  }
}

// ---------------------------------------------------------------------------
// validateTeacherClassAccess — checks if teacher has access to classId+section
// ---------------------------------------------------------------------------

async function validateTeacherClassAccess(
  teacherSessionId: string,
  classId: string,
  section: string,
): Promise<{ allowed: boolean; attendanceAccess: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session) return { allowed: false, attendanceAccess: false };

  // Admins bypass all checks
  if (session.user.role === 'admin') return { allowed: true, attendanceAccess: true };

  const classes = await getTeacherClassAccess(teacherSessionId);
  const entry = classes.find((c) => c.classId === classId && c.section === section);
  return {
    allowed: !!entry,
    attendanceAccess: entry?.attendanceAccess ?? false,
  };
}

// ---------------------------------------------------------------------------
// getTeacherClassAttendanceReport — attendance report scoped to teacher's class
// ---------------------------------------------------------------------------

export async function getTeacherClassAttendanceReport(
  classId: string,
  section: string,
  startDate: Date,
  endDate: Date,
) {
  const session = await getServerSession(authOptions);
  if (!session) return { success: false, error: 'Unauthorized' };

  const teacherSessionId = session.user.id;
  const { allowed } = await validateTeacherClassAccess(teacherSessionId, classId, section);
  if (!allowed) return { success: false, error: 'Access denied to this class' };

  try {
    const data = await getAttendanceReport({ startDate, endDate, classId, section });
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'getTeacherClassAttendanceReport failed');
    return { success: false, error: 'Failed to fetch attendance report' };
  }
}

// ---------------------------------------------------------------------------
// getTeacherClassFeeReport — fee report scoped to teacher's class
// ---------------------------------------------------------------------------

export async function getTeacherClassFeeReport(
  classId: string,
  section: string,
  startDate: Date,
  endDate: Date,
) {
  const session = await getServerSession(authOptions);
  if (!session) return { success: false, error: 'Unauthorized' };

  const teacherSessionId = session.user.id;
  const { allowed } = await validateTeacherClassAccess(teacherSessionId, classId, section);
  if (!allowed) return { success: false, error: 'Access denied to this class' };

  try {
    const data = await getFeeReport({ startDate, endDate, classId, section });
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'getTeacherClassFeeReport failed');
    return { success: false, error: 'Failed to fetch fee report' };
  }
}

// ---------------------------------------------------------------------------
// saveTeacherAttendance — marks/edits attendance, access + permission gated
// ---------------------------------------------------------------------------

export async function saveTeacherAttendance(params: {
  date: string;
  classId: string;
  section: string;
  records: { studentId: string; status: 'Present' | 'Absent' | 'Holiday'; remarks?: string }[];
}) {
  const session = await getServerSession(authOptions);
  if (!session) return { success: false, error: 'Unauthorized' };

  const teacherSessionId = session.user.id;
  const { allowed, attendanceAccess } = await validateTeacherClassAccess(
    teacherSessionId,
    params.classId,
    params.section,
  );

  if (!allowed) return { success: false, error: 'You do not have access to this class' };
  if (!attendanceAccess && session.user.role !== 'admin') {
    return { success: false, error: 'You do not have attendance marking permission for this class' };
  }

  return saveAttendance({
    ...params,
    markedBy: teacherSessionId,
  });
}
