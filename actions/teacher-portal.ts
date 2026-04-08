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
import { demoWriteSuccess, isDemoSession } from '@/lib/demo-guard';

// ---------------------------------------------------------------------------
// Internal interfaces
// ---------------------------------------------------------------------------

interface AssignedClassDoc {
  classId: { _id: Types.ObjectId; name: string } | Types.ObjectId;
  section: string;
  attendanceAccess: boolean;
  feeAccess: boolean;
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
          feeAccess: ac.feeAccess ?? false,
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
): Promise<{ allowed: boolean; attendanceAccess: boolean; feeAccess: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session) return { allowed: false, attendanceAccess: false, feeAccess: false };

  // Admins bypass all checks
  if (session.user.role === 'admin') return { allowed: true, attendanceAccess: true, feeAccess: true };

  const classes = await getTeacherClassAccess(teacherSessionId);
  const entry = classes.find((c) => c.classId === classId && c.section === section);
  return {
    allowed: !!entry,
    attendanceAccess: entry?.attendanceAccess ?? false,
    feeAccess: entry?.feeAccess ?? false,
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
  const { allowed, feeAccess } = await validateTeacherClassAccess(teacherSessionId, classId, section);
  if (!allowed) return { success: false, error: 'Access denied to this class' };
  if (!feeAccess && session.user.role !== 'admin') {
    return { success: false, error: 'You do not have fee report access for this class.' };
  }

  try {
    const data = await getFeeReport({ startDate, endDate, classId, section });
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'getTeacherClassFeeReport failed');
    return { success: false, error: 'Failed to fetch fee report' };
  }
}

export async function updateTeacherProfilePhoto(formData: FormData) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'teacher') return { success: false, error: 'Unauthorized' };
    if (isDemoSession(session)) return demoWriteSuccess();

    const photoFile = formData.get('photo') as File;
    if (!photoFile || photoFile.size === 0) return { success: false, error: 'No photo provided' };

    const { saveFile } = await import('@/lib/upload');
    const photoUrl = await saveFile(photoFile, 'teachers/photos');
    
    // Using import('@/models/Teacher').then(m => m.default) since it might not be imported at top level
    const Teacher = (await import('@/models/Teacher')).default;
    await Teacher.findByIdAndUpdate(session.user.id, { photo: photoUrl });
    
    return { success: true, photoUrl };
  } catch (error) {
    logger.error(error, "Error updating teacher photo");
    return { success: false, error: "An error occurred while updating photo" };
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
  if (isDemoSession(session)) return demoWriteSuccess();

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
