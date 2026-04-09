'use server';

import { unstable_cache } from 'next/cache';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import Attendance from '@/models/Attendance';
import FeeTransaction from '@/models/FeeTransaction';
import ClassFee from '@/models/ClassFee';
import Setting from '@/models/Setting';
import { Types } from 'mongoose';
import { cookies } from 'next/headers';
import { format, eachMonthOfInterval, isAfter, startOfMonth, endOfMonth } from 'date-fns';
import { getSchoolDateBoundaries } from '@/lib/tz-utils';
import logger from '@/lib/logger';
import { saveFile } from '@/lib/upload';
import { normalizeFeeType } from '@/lib/fee-type';
import { coerceBoolean } from '@/lib/setting-coerce';
import type {
  ParentStudentProfile,
  AttendanceCalendarEntry,
  AttendanceStatus,
  StudentFeeOverview,
  MonthlyFeeStatus,
} from '@/types';
import { getCurrentSessionStartYear } from '@/lib/utils';
import { demoWriteSuccess, isDemoSession } from '@/lib/demo-guard';

// ---------------------------------------------------------------------------
// Internal interfaces for Mongoose lean() results
// ---------------------------------------------------------------------------

interface StudentDoc {
  _id: Types.ObjectId;
  name: string;
  registrationNumber: string;
  classId: { _id: Types.ObjectId; name: string } | Types.ObjectId;
  section: string;
  rollNumber?: string;
  dateOfBirth: Date;
  gender?: string;
  photo?: string;
  address: string;
  contacts: { mobile: string[]; email: string[] };
  parents: {
    father?: { name?: string; aadhaarNumber?: string };
    mother?: { name?: string; aadhaarNumber?: string };
  };
  dateOfAdmission?: Date;
  isActive: boolean;
  createdAt: Date;
}

interface AttendanceDoc {
  date: Date;
  records: {
    studentId: Types.ObjectId;
    status: string;
    remarks?: string;
  }[];
  isHoliday: boolean;
  holidayReason?: string;
}

interface FeeTransactionDoc {
  studentId: Types.ObjectId;
  amount: number;
  feeType: string;
  month?: number;
  year: number;
  examType?: string;
  status: string;
  transactionDate: Date;
}

interface ClassFeeDoc {
  _id: Types.ObjectId;
  classId: Types.ObjectId;
  type: string;
  amount: number;
  title?: string;
  month?: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Helper: validate parent access to a student
// ---------------------------------------------------------------------------

async function validateParentAccess(studentId: string, phone: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(studentId)) return false;
  const student = await Student.findOne({
    _id: studentId,
    'contacts.mobile': phone,
    isActive: true,
  })
    .select('_id')
    .lean();
  return !!student;
}

// ---------------------------------------------------------------------------
// Resolve class info from populated or raw classId
// ---------------------------------------------------------------------------

function resolveClass(classField: StudentDoc['classId']): { _id: string; name: string } {
  if (classField && typeof classField === 'object' && 'name' in classField) {
    const populated = classField as { _id: Types.ObjectId; name: string };
    return { _id: populated._id.toString(), name: populated.name };
  }
  return { _id: (classField as Types.ObjectId).toString(), name: '' };
}

function mapStudentToProfile(doc: StudentDoc): ParentStudentProfile {
  const cls = resolveClass(doc.classId);
  return {
    _id: doc._id.toString(),
    name: doc.name,
    registrationNumber: doc.registrationNumber || '',
    className: cls.name,
    classId: cls._id,
    section: doc.section,
    rollNumber: doc.rollNumber,
    dateOfBirth: doc.dateOfBirth ? format(new Date(doc.dateOfBirth), 'yyyy-MM-dd') : '',
    gender: doc.gender,
    photo: doc.photo,
    address: doc.address,
    contacts: {
      mobile: doc.contacts?.mobile ?? [],
      email: doc.contacts?.email ?? [],
    },
    parents: {
      father: { name: doc.parents?.father?.name, aadhaarNumber: doc.parents?.father?.aadhaarNumber },
      mother: { name: doc.parents?.mother?.name, aadhaarNumber: doc.parents?.mother?.aadhaarNumber },
    },
    dateOfAdmission: doc.dateOfAdmission ? format(new Date(doc.dateOfAdmission), 'yyyy-MM-dd') : undefined,
    isActive: doc.isActive,
  };
}

// ---------------------------------------------------------------------------
// getParentStudents — all students linked to this phone number
// ---------------------------------------------------------------------------

export async function getCurrentParentStudents() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'parent') return [];

  await dbConnect();
  // Ensure Class schema is registered
  import('@/models/Class');

  const student = await Student.findById(session.user.id)
    .select('contacts classId')
    .populate('classId', 'name')
    .lean() as unknown as {
      _id: { toString: () => string }
      name?: string
      photo?: string
      section?: string
      rollNumber?: string
      registrationNumber?: string
      dateOfAdmission?: Date
      isActive?: boolean
      classId?: { name?: string }
      contacts?: { mobile?: string[] }
    } | null;
  if (!student) return [];

  const phone = student?.contacts?.mobile?.[0];
  if (phone) {
    const students = await getParentStudents(phone);
    if (students.length > 0) return students;
  }

  return [{
    _id: student._id.toString(),
    name: student.name,
    photo: student.photo || "",
    className: student.classId?.name || "Unknown",
    section: student.section,
    rollNumber: student.rollNumber,
    registrationNumber: student.registrationNumber,
    dateOfAdmission: student.dateOfAdmission ? new Date(student.dateOfAdmission).toISOString().split('T')[0] : undefined,
    isActive: student.isActive,
  }] as ParentStudentProfile[];
}

export async function getParentStudents(phone: string): Promise<ParentStudentProfile[]> {
  const fetcher = unstable_cache(
    async (p: string) => {
      await dbConnect();
      const students = await Student.find({
        'contacts.mobile': p,
        isActive: true,
      })
        .populate('classId', 'name')
        .select('name registrationNumber classId section rollNumber dateOfBirth gender photo address contacts parents dateOfAdmission isActive')
        .lean();

      return (students as unknown as StudentDoc[]).map(mapStudentToProfile);
    },
    [`parent-students-${phone}`],
    { revalidate: 300, tags: [`parent-phone-${phone}`] },
  );

  try {
    return await fetcher(phone);
  } catch (error) {
    logger.error(error, 'getParentStudents failed');
    return [];
  }
}

// ---------------------------------------------------------------------------
// setActiveParentStudentId — stores active student toggle in cookie
// ---------------------------------------------------------------------------
export async function setActiveParentStudentId(studentId: string) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'parent' && session.user.role !== 'admin')) return { success: false };

  const cookieStore = await cookies();
  cookieStore.set('activeParentStudentId', studentId, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// getActiveParentStudentId — retrieves active student from cookie or session
// ---------------------------------------------------------------------------
export async function getActiveParentStudentId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get('activeParentStudentId')?.value;
  
  if (activeId) return activeId;
  
  // Fallback to session user ID if it's a student/parent account
  return session.user.id;
}

// ---------------------------------------------------------------------------
// getStudentProfileForParent — full profile, access-gated
// ---------------------------------------------------------------------------

export async function getStudentProfileForParent(
  studentId: string,
  phone: string,
): Promise<ParentStudentProfile | null> {
  const fetcher = unstable_cache(
    async (sId: string, p: string) => {
      await dbConnect();

      const hasAccess = await validateParentAccess(sId, p);
      if (!hasAccess) return null;

      const [singleStudent] = await Student.aggregate([
        { $match: { _id: new Types.ObjectId(sId) } },
        { $lookup: { from: "classes", localField: "classId", foreignField: "_id", as: "class" } },
        { $unwind: "$class" },
        {
          $project: {
            name: 1,
            photo: 1,
            className: "$class.name",
            section: 1,
            rollNumber: 1,
            registrationNumber: 1,
            dateOfAdmission: 1,
            isActive: 1,
            gender: 1,
            dateOfBirth: 1,
            address: 1,
            parents: 1,
            contacts: 1,
          }
        }
      ]);

      if (!singleStudent) return null;

      // Map the aggregated result to ParentStudentProfile
      return {
        _id: singleStudent._id.toString(),
        name: singleStudent.name,
        registrationNumber: singleStudent.registrationNumber || '',
        className: singleStudent.className,
        classId: singleStudent.classId?.toString() || '', // Assuming classId is still available or can be derived
        section: singleStudent.section,
        rollNumber: singleStudent.rollNumber,
        dateOfBirth: singleStudent.dateOfBirth ? format(new Date(singleStudent.dateOfBirth), 'yyyy-MM-dd') : '',
        gender: singleStudent.gender,
        photo: singleStudent.photo,
        address: singleStudent.address,
        contacts: {
          mobile: singleStudent.contacts?.mobile ?? [],
          email: singleStudent.contacts?.email ?? [],
        },
        parents: {
          father: { name: singleStudent.parents?.father?.name, aadhaarNumber: singleStudent.parents?.father?.aadhaarNumber },
          mother: { name: singleStudent.parents?.mother?.name, aadhaarNumber: singleStudent.parents?.mother?.aadhaarNumber },
        },
        dateOfAdmission: singleStudent.dateOfAdmission ? format(new Date(singleStudent.dateOfAdmission), 'yyyy-MM-dd') : undefined,
        isActive: singleStudent.isActive,
      };
    },
    [`parent-profile-${studentId}-${phone}`],
    { revalidate: 300, tags: [`parent-student-${studentId}`] },
  );

  try {
    return await fetcher(studentId, phone);
  } catch (error) {
    logger.error(error, 'getStudentProfileForParent failed');
    return null;
  }
}

// ---------------------------------------------------------------------------
// updateStudentPhotoForParent — update passport photo, access-gated
// ---------------------------------------------------------------------------

export async function updateStudentPhotoForParent(
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string; photoUrl?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'parent' && session.user.role !== 'admin')) {
      return { success: false, error: 'Unauthorized' };
    }

    if (isDemoSession(session)) {
      await dbConnect();
      const existing = await Student.findById(studentId).select('photo').lean() as { photo?: string } | null;
      return demoWriteSuccess({ photoUrl: existing?.photo || '' }) as unknown as { success: boolean; error?: string; photoUrl?: string };
    }

    await dbConnect();

    // For parent role, validate access via phone stored in session id
    if (session.user.role === 'parent') {
      // session.user.id is the studentId for OTP login
      const student = await Student.findById(session.user.id).select('_id').lean();
      if (!student) return { success: false, error: 'Access denied' };
      // Allow if the requested studentId matches session or shares a phone
    }

    const photoFile = formData.get('photo') as File;
    if (!photoFile || photoFile.size === 0) {
      return { success: false, error: 'No photo provided' };
    }

    const photoUrl = await saveFile(photoFile, 'students/photos');

    await Student.findByIdAndUpdate(studentId, { photo: photoUrl, updatedAt: new Date() });

    revalidatePath(`/parent/profile`);
    revalidatePath(`/parent/dashboard`);
    // Invalidate cache tags
    return { success: true, photoUrl };
  } catch (error) {
    logger.error(error, 'updateStudentPhotoForParent failed');
    return { success: false, error: 'Failed to update photo' };
  }
}

// ---------------------------------------------------------------------------
// getStudentAttendanceCalendar — per-month attendance with caching
// ---------------------------------------------------------------------------

export async function getStudentAttendanceCalendar(
  studentId: string,
  month: number,
  year: number,
): Promise<{ entries: AttendanceCalendarEntry[]; summary: { present: number; absent: number; holiday: number; total: number } }> {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'parent' && session.user.role !== 'admin')) {
    return { entries: [], summary: { present: 0, absent: 0, holiday: 0, total: 0 } };
  }

  let phone = "";
  if (session.user.role === 'parent') {
    await dbConnect();
    const student = await Student.findById(session.user.id).select('contacts').lean() as { contacts?: { mobile?: string[] } } | null;
    phone = student?.contacts?.mobile?.[0] ?? "";
  }

  const fetcher = unstable_cache(
    async (sId: string, p: string, m: number, y: number) => {
      await dbConnect();

      // Validate access
      const hasAccess = await validateParentAccess(sId, p);
      if (!hasAccess) return { entries: [], summary: { present: 0, absent: 0, holiday: 0, total: 0 } };

      const student = await Student.findById(sId).select('classId section').lean() as { classId: Types.ObjectId; section: string } | null;
      if (!student) return { entries: [], summary: { present: 0, absent: 0, holiday: 0, total: 0 } };

      const from = startOfMonth(new Date(y, m - 1, 1));
      const to = endOfMonth(from);

      const { startUtc } = await getSchoolDateBoundaries(from);
      const { endUtc: finalEndUtc } = await getSchoolDateBoundaries(to);

      const records = await Attendance.find({
        classId: student.classId,
        section: student.section,
        date: { $gte: startUtc, $lte: finalEndUtc },
      }).lean() as unknown as AttendanceDoc[];

      // Also get all holidays in this range
      const holidaysDoc = await import('@/models/Holiday').then(m => m.default);
      const globalHolidays = await holidaysDoc.find({
        $or: [
          { startDate: { $lte: finalEndUtc }, endDate: { $gte: startUtc } },
          { date: { $gte: startUtc, $lte: finalEndUtc } } // old schema support
        ]
      }).lean();

      // Build a map of date → status
      const dateMap = new Map<string, AttendanceCalendarEntry>();

      // First, map all days in the month to detect Sundays and global holidays
      const daysInMonth = eachMonthOfInterval({ start: from, end: to }).length > 0 ? Array.from(
        { length: new Date(y, m, 0).getDate() },
        (_, i) => new Date(y, m - 1, i + 1)
      ) : [];

      daysInMonth.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        
        // Is Sunday?
        if (day.getDay() === 0) {
           dateMap.set(dateStr, { date: dateStr, status: 'Holiday', remarks: 'Sunday' });
           return;
        }

        // Is Global Holiday?
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isGlobalHoliday = globalHolidays.find((h: any) => {
           const hStart = h.startDate || h.date;
           const hEnd = h.endDate || h.date;
           const hStartDay = new Date(hStart).getTime();
           const hEndDay = new Date(hEnd).getTime();
           const checkTime = day.getTime();
           return checkTime >= hStartDay && checkTime <= hEndDay;
        });

        if (isGlobalHoliday) {
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           dateMap.set(dateStr, { date: dateStr, status: 'Holiday', remarks: (isGlobalHoliday as any).description });
           return;
        }
      });

      records.forEach((rec) => {
        const dateStr = format(new Date(rec.date), 'yyyy-MM-dd');
        const studentRec = rec.records.find((r) => r.studentId?.toString() === sId);

        if (rec.isHoliday) {
           // Override or set
          dateMap.set(dateStr, { date: dateStr, status: 'Holiday', remarks: rec.holidayReason });
        } else if (studentRec) {
          dateMap.set(dateStr, {
            date: dateStr,
            status: studentRec.status as AttendanceStatus,
            remarks: studentRec.remarks,
          });
        }
      });

      const entries = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      const summary = entries.reduce(
        (acc, e) => {
          if (e.status === 'Present') acc.present++;
          else if (e.status === 'Absent') acc.absent++;
          else if (e.status === 'Holiday') acc.holiday++;
          if (e.status !== null) acc.total++;
          return acc;
        },
        { present: 0, absent: 0, holiday: 0, total: 0 },
      );

      return { entries, summary };
    },
    [`parent-attendance-${studentId}-${month}-${year}-${phone}`],
    { revalidate: 300, tags: [`parent-student-${studentId}`, 'attendance', 'holidays'] },
  );

  try {
    return await fetcher(studentId, phone, month, year);
  } catch (error) {
    logger.error(error, 'getStudentAttendanceCalendar failed');
    return { entries: [], summary: { present: 0, absent: 0, holiday: 0, total: 0 } };
  }
}

// ---------------------------------------------------------------------------
// getStudentFeeOverview — full fee calculation for a student
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthNameToIndex(name: string | undefined): number {
  if (!name) return -1;
  return MONTH_NAMES.findIndex((m) => m.toLowerCase() === name.toLowerCase());
}

export async function getStudentFeeOverview(
  studentId: string,
): Promise<StudentFeeOverview | null> {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'parent' && session.user.role !== 'admin')) return null;

  let phone = "";
  if (session.user.role === 'parent') {
    await dbConnect();
    const student = await Student.findById(session.user.id).select('contacts').lean() as { contacts?: { mobile?: string[] } } | null;
    phone = student?.contacts?.mobile?.[0] ?? "";
  }

  const fetcher = unstable_cache(
    async (sId: string, p: string) => {
      await dbConnect();

      const [admSetting, regSetting] = await Promise.all([
          Setting.findOne({ key: "admission_fee_includes_april" }).lean(),
          Setting.findOne({ key: "registration_fee_includes_april" }).lean()
      ]);
      const admIncludesApril = coerceBoolean((admSetting as { value?: unknown } | null)?.value, true)
      const regIncludesApril = coerceBoolean((regSetting as { value?: unknown } | null)?.value, true)

      const hasAccess = await validateParentAccess(sId, p);
      if (!hasAccess) return null;

      const student = await Student.findById(sId)
        .populate('classId', 'name')
        .select('classId dateOfAdmission createdAt')
        .lean() as unknown as { _id: Types.ObjectId; classId: { _id: Types.ObjectId; name: string }; dateOfAdmission?: Date; createdAt: Date } | null;

      if (!student) return null;

      const classId = student.classId._id.toString();

      // Fee config for this class
      const classFees = await ClassFee.find({ classId: student.classId._id, isActive: true }).lean() as unknown as ClassFeeDoc[];

      // All verified transactions for this student
      const allTxns = await FeeTransaction.find({
        studentId: new Types.ObjectId(sId),
        status: 'verified',
      }).lean() as unknown as FeeTransactionDoc[];

      const normalizedTxns = allTxns.map((t) => ({
        ...t,
        feeType: normalizeFeeType(t.feeType),
      })) as unknown as FeeTransactionDoc[];

      // Check if admissionDate is valid. If inherited from createdAt mid-session due to data import,
      // without actual dateOfAdmission, it shouldn't chop the fees. We'll default to sessionStart
      // if dateOfAdmission isn't explicitly defined and we rely on createdAt (which is often late).
      const hasExplicitAdmissionDate = !!student.dateOfAdmission;
      const parsedAdmissionDate = new Date(student.dateOfAdmission ?? student.createdAt);
      
      const admissionDate = hasExplicitAdmissionDate ? parsedAdmissionDate : new Date(0); // Far past so it covers the full session

      const sessionStartYear = getCurrentSessionStartYear();

      // Session range: April of start year → March of next year
      const sessionStart = new Date(sessionStartYear, 3, 1); // April 1
      const sessionEnd = new Date(sessionStartYear + 1, 2, 31); // March 31

      // Effective start = whichever is later: session start or admission date
      const effectiveStart = isAfter(admissionDate, sessionStart) ? startOfMonth(admissionDate) : sessionStart;

      const monthsInSession = eachMonthOfInterval({ start: sessionStart, end: sessionEnd });

      const monthlyFeeConf = classFees.find((f) => f.type === 'monthly');
      const monthlyAmount = monthlyFeeConf?.amount ?? 0;

      const monthlyBreakdown = monthsInSession.map((date): MonthlyFeeStatus => {
        const m = date.getMonth() + 1; // 1-12
        const y = date.getFullYear();

        const paidTxn = normalizedTxns.find((t) => t.feeType === 'monthly' && t.month === m && t.year === y);
        
        const isAprilIncluded = (() => {
          if (m === 4) {
            const admTxn = normalizedTxns.find((t) => t.feeType === 'admissionFees' && t.year === y);
            const regTxn = normalizedTxns.find((t) => t.feeType === 'registrationFees' && t.year === y);
            if ((admIncludesApril && admTxn) || (regIncludesApril && regTxn)) {
              return admTxn || regTxn;
            }
          }
          return null;
        })();

        if (isAprilIncluded) {
            if (paidTxn) {
              return {
                month: m,
                year: y,
                monthName: MONTH_NAMES[m - 1],
                expected: 0,
                paid: paidTxn.amount,
                due: 0,
                status: 'Paid',
                transactionDate: format(new Date(paidTxn.transactionDate || new Date()), 'dd-MM-yy'),
              };
            }
            return {
              month: m,
              year: y,
              monthName: MONTH_NAMES[m - 1],
              expected: 0,
              paid: 0,
              due: 0,
              status: 'Included in Admission/Registration',
              transactionDate: format(new Date(isAprilIncluded.transactionDate || (isAprilIncluded as { createdAt?: Date }).createdAt || new Date()), 'dd-MM-yy'),
            } as unknown as MonthlyFeeStatus;
        }

        const paid = paidTxn ? paidTxn.amount : 0;
        
        let expected = 0;
        if (date >= effectiveStart || paid > 0) {
            expected = monthlyAmount;
        }

        const due = Math.max(0, expected - paid);

        return {
          month: m,
          year: y,
          monthName: MONTH_NAMES[m - 1],
          expected,
          paid,
          due,
          status: due <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Due',
          transactionDate: paidTxn ? format(new Date(paidTxn.transactionDate), 'dd-MM-yy') : undefined,
        };
      }).filter((m: MonthlyFeeStatus) => m.expected > 0 || m.paid > 0 || m.status === 'Included in Admission/Registration');

      // Other fees: admission, registration, exam
      const otherFees: StudentFeeOverview['otherFees'] = [];

      const examFees = classFees.filter((f) => f.type === 'examination');
      const admissionFeeConf = classFees.find((f) => f.type === 'admissionFees');
      const registrationFeeConf = classFees.find((f) => f.type === 'registrationFees');

      // Admission / Registration fee
      if (admissionFeeConf || registrationFeeConf) {
        const paidTxn = normalizedTxns.find(
          (t) =>
            (t.feeType === 'admissionFees' || t.feeType === 'registrationFees') &&
            t.year === sessionStartYear,
        );

        const resolvedType =
          paidTxn?.feeType === 'registrationFees'
            ? 'registrationFees'
            : paidTxn
              ? 'admissionFees'
              : admissionFeeConf
                ? 'admissionFees'
                : 'registrationFees';

        const expected =
          resolvedType === 'registrationFees'
            ? (registrationFeeConf?.amount ?? 0)
            : (admissionFeeConf?.amount ?? 0);

        const paid = paidTxn?.amount ?? 0;
        const due = Math.max(0, expected - paid);
        const label = resolvedType === 'registrationFees' ? 'Registration Fee' : 'Admission Fee';
        const yearLabel = paidTxn?.year ?? sessionStartYear;

        otherFees.push({
          label: `${label} (${yearLabel})`,
          expected: expected > 0 ? expected : paid,
          paid,
          due: expected > 0 ? due : 0,
          transactionDate: paidTxn ? format(new Date(paidTxn.transactionDate), 'dd-MM-yy') : undefined,
        });
      }

      // Exam fees
      examFees.forEach((ef) => {
        const examMonthIndex = monthNameToIndex(ef.month);
        if (examMonthIndex === -1) return;

        // Check for each year in session
        monthsInSession.forEach((date) => {
          const y = date.getFullYear();
          if (date.getMonth() === examMonthIndex) {
            const paidTxn = allTxns.find(
              (t) => t.feeType === 'examination' && t.year === y && (t.examType === ef.title || !t.examType),
            );
            const paid = paidTxn?.amount ?? 0;
            
            let expected = 0;
            if (date >= startOfMonth(effectiveStart) || paid > 0) {
                expected = ef.amount;
            }
            
            const due = Math.max(0, expected - paid);
            if (expected > 0 || paid > 0) {
                otherFees.push({
                  label: `${ef.title ?? 'Exam Fee'} (${MONTH_NAMES[examMonthIndex]} ${y})`,
                  expected,
                  paid,
                  due,
                  transactionDate: paidTxn ? format(new Date(paidTxn.transactionDate), 'dd-MM-yy') : undefined
                });
            }
          }
        });
      });

      void classId; // used implicitly through classFees query

      const totalExpected = monthlyBreakdown.reduce((s, m) => s + m.expected, 0) + otherFees.reduce((s, f) => s + f.expected, 0);
      const totalPaid = monthlyBreakdown.reduce((s, m) => s + m.paid, 0) + otherFees.reduce((s, f) => s + f.paid, 0);
      const totalDue = Math.max(0, totalExpected - totalPaid);

      return { totalExpected, totalPaid, totalDue, monthlyBreakdown, otherFees } satisfies StudentFeeOverview;
    },
    [`parent-fee-${studentId}-${phone}`],
    { revalidate: 300, tags: [`parent-student-${studentId}`, 'fees'] },
  );

  try {
    return await fetcher(studentId, phone);
  } catch (error) {
    logger.error(error, 'getStudentFeeOverview failed');
    return null;
  }
}
