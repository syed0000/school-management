'use server';

import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import Attendance from '@/models/Attendance';
import FeeTransaction from '@/models/FeeTransaction';
import ClassFee from '@/models/ClassFee';
import Setting from '@/models/Setting';
import Holiday from '@/models/Holiday';
import { format, eachDayOfInterval, isBefore, isAfter, startOfMonth, endOfMonth } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { getSchoolDateBoundaries, getSchoolTimezone, listYmdRange } from '@/lib/tz-utils';
import logger from "@/lib/logger";
import { Types } from "mongoose";
import { normalizeFeeType } from '@/lib/fee-type';
import { coerceBoolean } from '@/lib/setting-coerce';
import { unstable_cache } from "next/cache";
import { withConcurrencyLimit } from "@/lib/backpressure";
import { getEnvInt } from "@/lib/env";

// --- Interfaces ---

interface AttendanceReportParams {
  startDate: Date | string;
  endDate: Date | string;
  classId?: string;
  section?: string;
  studentId?: string;
}

interface StudentStat {
  id: string;
  name: string;
  rollNumber: string;
  className: string;
  section: string;
  present: number;
  absent: number;
  total: number;
  percentage: number | string;
  history: { date: string; status: string }[];
}

interface DailyStat {
  date: string;
  percentage: string;
  present: number;
  total: number;
}

interface AttendanceRecordDoc {
  date: Date;
  classId: { name: string };
  records: {
    studentId: { _id: Types.ObjectId; name: string; rollNumber: string };
    status: string;
  }[];
}

interface FeeReportParams {
  startDate: Date | string;
  endDate: Date | string;
  classId?: string;
  section?: string;
  studentId?: string;
}

const REPORT_CACHE_SECONDS = getEnvInt("REPORT_CACHE_SECONDS", 60)
const REPORT_CONCURRENCY = getEnvInt("REPORT_CONCURRENCY", 2)

interface StudentReportDoc {
  _id: Types.ObjectId;
  name: string;
  rollNumber: string;
  classId: { _id: Types.ObjectId; name: string };
  section: string;
  dateOfAdmission?: Date;
}

interface FeeTransactionDoc {
  studentId: Types.ObjectId;
  amount: number;
  feeType: string;
  month?: number;
  year?: number;
  transactionDate: Date;
  examType?: string;
}

interface ClassFeeDoc {
  classId: Types.ObjectId;
  type: string;
  amount: number;
  title?: string;
  month?: string;
}

// --- Attendance Reporting ---

async function getAttendanceReportImpl({
  startDate,
  endDate,
  classId,
  section,
  studentId,
}: AttendanceReportParams) {
  await dbConnect();

  try {
    const tz = await getSchoolTimezone();
    const startYmd = typeof startDate === "string" ? startDate : formatInTimeZone(startDate, tz, "yyyy-MM-dd")
    const endYmd = typeof endDate === "string" ? endDate : formatInTimeZone(endDate, tz, "yyyy-MM-dd")
    const { startUtc: startOfStartDate } = await getSchoolDateBoundaries(startYmd);
    const { endUtc: endOfEndDate } = await getSchoolDateBoundaries(endYmd);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {
      date: {
        $gte: startOfStartDate,
        $lte: endOfEndDate,
      },
    };

    if (classId && classId !== 'all') query.classId = classId;
    if (section && section !== 'all') query.section = section;

    const attendanceRecords = await Attendance.find(query)
      .populate({ path: 'classId', select: 'name', options: { lean: true } })
      .populate({ path: 'records.studentId', select: 'name rollNumber', options: { lean: true } })
      .lean() as unknown as AttendanceRecordDoc[];

    let totalPresent = 0;
    const studentStats: Record<string, StudentStat> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentQuery: any = { isActive: true };
    if (classId && classId !== 'all') studentQuery.classId = classId;
    if (section && section !== 'all') studentQuery.section = section;
    if (studentId) studentQuery._id = studentId;

    const students = await Student.find(studentQuery)
      .populate({ path: 'classId', select: 'name', options: { lean: true } })
      .select('name rollNumber classId section')
      .lean();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    students.forEach((student: any) => {
      studentStats[student._id.toString()] = {
        id: student._id.toString(),
        name: student.name,
        rollNumber: student.rollNumber,
        className: student.classId?.name || 'N/A',
        section: student.section,
        present: 0,
        absent: 0,
        total: 0,
        percentage: 0,
        history: [],
      };
    });

    // 1. Get all days in the interval
    const daysInterval = eachDayOfInterval({
      start: typeof startDate === "string" ? new Date(`${startDate}T00:00:00.000Z`) : startDate,
      end: typeof endDate === "string" ? new Date(`${endDate}T00:00:00.000Z`) : endDate,
    });
    const totalCalendarDays = daysInterval.length;

    // 2. Get holidays from DB
    const dbHolidays = await Holiday.find({
      $or: [
        { startDate: { $gte: startOfStartDate, $lte: endOfEndDate } },
        { endDate: { $gte: startOfStartDate, $lte: endOfEndDate } },
        { startDate: { $lte: startOfStartDate }, endDate: { $gte: endOfEndDate } }
      ]
    }).lean();

    // 3. Helper to get stats per class
    const classStatsCache: Record<string, { workingDaysCount: number, holidaysCount: number, isWorkingDate: (d: Date) => boolean }> = {};
    
    const getStatsForClass = (cId: string) => {
      if (classStatsCache[cId]) return classStatsCache[cId];
      
      const relevantHolidays = dbHolidays.filter((h: { affectedClasses?: { toString: () => string }[] }) => 
        !h.affectedClasses || 
        h.affectedClasses.length === 0 || 
        h.affectedClasses.some((ac) => ac.toString() === cId)
      );

      const isWorkingDate = (d: Date) => {
        if (d.getDay() === 0) return false;
        return !relevantHolidays.some((h: { startDate?: Date; endDate?: Date }) => {
          if (!h.startDate || !h.endDate) return false;
          const hStart = new Date(h.startDate).getTime();
          const hEnd = new Date(h.endDate).getTime();
          return d.getTime() >= hStart && d.getTime() <= hEnd;
        });
      };

      const workingDaysCount = daysInterval.filter(isWorkingDate).length;
      
      classStatsCache[cId] = {
        workingDaysCount,
        holidaysCount: totalCalendarDays - workingDaysCount,
        isWorkingDate
      };
      return classStatsCache[cId];
    };

    // 4. Process Attendance Records
    attendanceRecords.forEach((record) => {
      const dateStr = format(new Date(record.date), 'yyyy-MM-dd');
      
      record.records.forEach((studentRec) => {
        if (!studentRec.studentId) return;
        const sId = studentRec.studentId._id.toString();
        if (studentId && sId !== studentId) return;

        if (studentStats[sId]) {
          const status = studentRec.status;
          if (status === 'Present') {
              studentStats[sId].present += 1;
              totalPresent += 1;
          } else if (status === 'Absent') {
              studentStats[sId].absent += 1;
          }
          studentStats[sId].history.push({ date: dateStr, status });
        }
      });
    });

    // 5. Finalize Statistics (Per Student)
    const studentReport = students.map((s: { _id?: { toString: () => string }; classId?: { _id?: { toString: () => string } } }) => {
      const sId = s._id?.toString() || 'unknown';
      const cId = s.classId?._id?.toString() || 'unknown';
      const stats = getStatsForClass(cId);
      
      return {
        ...studentStats[sId],
        totalDays: totalCalendarDays,
        workingDays: stats.workingDaysCount,
        holidays: stats.holidaysCount,
        absent: stats.workingDaysCount - studentStats[sId].present,
        percentage: stats.workingDaysCount > 0 ? ((studentStats[sId].present / stats.workingDaysCount) * 100).toFixed(1) : 0,
      };
    });

    // For Daily Stats - using a global/default working day check or filtering
    
    const dailyStats: DailyStat[] = [];
    const attendanceByDate: Record<string, AttendanceRecordDoc[]> = {};
    const presentByDate: Record<string, Set<string>> = {};
    attendanceRecords.forEach((record) => {
      const d = formatInTimeZone(new Date(record.date), tz, 'yyyy-MM-dd');
      if (!attendanceByDate[d]) attendanceByDate[d] = [];
      attendanceByDate[d].push(record);

      if (!presentByDate[d]) presentByDate[d] = new Set<string>();
      const set = presentByDate[d];
      record.records.forEach((r) => {
        const sid = r.studentId?._id?.toString();
        if (!sid) return;
        if (r.status === 'Present') set.add(sid);
      });
    });

    daysInterval.forEach((day) => {
      const dateStr = formatInTimeZone(day, tz, 'yyyy-MM-dd');
      const presentSet = presentByDate[dateStr];
      
      let dayPresent = 0;
      let dayTotal = 0;

      students.forEach((s: { _id?: { toString: () => string }; classId?: { _id?: { toString: () => string } } }) => {
         const stats = getStatsForClass(s.classId?._id?.toString() || 'unknown');
         if (stats.isWorkingDate(day)) {
            dayTotal++;
            const sid = s._id?.toString();
            if (sid && presentSet?.has(sid)) dayPresent++;
         }
      });

      if (dayTotal > 0) {
        dailyStats.push({
          date: dateStr,
          percentage: ((dayPresent / dayTotal) * 100).toFixed(1),
          present: dayPresent,
          total: dayTotal,
        });
      }
    });

    // Use aggregate summary from first student or calculate averages
    const firstStudent = studentReport[0] || { workingDays: 0, holidays: 0 };

    return {
      summary: {
        totalDays: totalCalendarDays,
        totalWorkingDays: firstStudent.workingDays, 
        totalHolidays: firstStudent.holidays,
        averageAttendance: totalPresent > 0 ? ((totalPresent / studentReport.reduce((acc, s) => acc + (s as { workingDays?: number }).workingDays!, 0)) * 100).toFixed(1) : 0,
        totalPresent,
        totalAbsent: studentReport.reduce((acc, s) => acc + (s as { absent?: number }).absent!, 0),
      },
      dailyStats,
      studentReport,
      timezone: tz,
    };

  } catch (error) {
    logger.error(error, 'Error fetching attendance report');
    throw new Error('Failed to fetch attendance report');
  }
}

export const getAttendanceReport =
  REPORT_CACHE_SECONDS > 0
    ? unstable_cache(
        async (params: AttendanceReportParams) =>
          withConcurrencyLimit("report:attendance", REPORT_CONCURRENCY, () => getAttendanceReportImpl(params)),
        ["report-attendance"],
        { revalidate: REPORT_CACHE_SECONDS, tags: ["reports", "attendance-report"] },
      )
    : async (params: AttendanceReportParams) =>
        withConcurrencyLimit("report:attendance", REPORT_CONCURRENCY, () => getAttendanceReportImpl(params))

// --- Fee Reporting ---

async function getFeeReportImpl({
  startDate,
  endDate,
  classId,
  section,
  studentId,
}: FeeReportParams) {
  await dbConnect();

  try {
    const tz = await getSchoolTimezone();
    const [admSetting, regSetting] = await Promise.all([
        Setting.findOne({ key: "admission_fee_includes_april" }).lean(),
        Setting.findOne({ key: "registration_fee_includes_april" }).lean()
    ]);
    const admIncludesApril = coerceBoolean((admSetting as { value?: unknown } | null)?.value, true)
    const regIncludesApril = coerceBoolean((regSetting as { value?: unknown } | null)?.value, true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentQuery: any = {};
    if (classId && classId !== 'all') studentQuery.classId = classId;
    if (section && section !== 'all') studentQuery.section = section;
    if (studentId) studentQuery._id = studentId;

    const students = await Student.find(studentQuery)
      .populate({ path: 'classId', select: 'name', options: { lean: true } })
      .select('name rollNumber classId section dateOfAdmission')
      .lean();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentIds = students.map((s: any) => s._id);

    const startYmd = typeof startDate === "string" ? startDate : formatInTimeZone(startDate, tz, "yyyy-MM-dd")
    const endYmd = typeof endDate === "string" ? endDate : formatInTimeZone(endDate, tz, "yyyy-MM-dd")
    const { startUtc: startOfStartDate, endUtc: endOfEndDate } = await Promise.all([
      getSchoolDateBoundaries(startYmd).then(res => ({ startUtc: res.startUtc })),
      getSchoolDateBoundaries(endYmd).then(res => ({ endUtc: res.endUtc }))
    ]).then(res => ({ ...res[0], ...res[1] }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactionQuery: any = {
      studentId: { $in: studentIds },
      status: { $in: ['verified', 'pending'] },
      transactionDate: {
        $gte: startOfStartDate,
        $lte: endOfEndDate,
      },
    };

    const transactions = await FeeTransaction.find(transactionQuery).lean() as unknown as FeeTransactionDoc[];

    const allTransactions = await FeeTransaction.find({
      studentId: { $in: studentIds },
      status: { $in: ['verified', 'pending'] },
    }).lean() as unknown as FeeTransactionDoc[];

    const classFees = await ClassFee.find({ isActive: true }).lean() as unknown as ClassFeeDoc[];

    const getFeeForClass = (cId: string | undefined, type: string) => {
      if (!cId) return 0;
      const fee = classFees.find((f) => f.classId.toString() === cId.toString() && f.type === type);
      return fee ? fee.amount : 0;
    };

    const getExamsForClass = (cId: string | undefined) => {
      if (!cId) return [];
      return classFees.filter((f) => f.classId.toString() === cId.toString() && f.type === 'examination');
    };

    const monthNameToNumber = (monthName: string | undefined) => {
      if (!monthName) return -1;
      const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
      return months.indexOf(monthName.toLowerCase());
    };

    const totalCollectedPeriod = transactions.reduce((s, t) => s + t.amount, 0);
    let totalExpectedPeriod = 0;
    let totalDuePeriod = 0;

    const studentReport = students.map((s: unknown) => {
      const student = s as StudentReportDoc;
      const sId = student._id.toString();
      const cId = student.classId?._id.toString();

      const studentAllTxns = allTransactions.filter((t) => t.studentId.toString() === sId);
      const normalizedStudentTxns = studentAllTxns.map((t) => ({
        ...t,
        feeType: normalizeFeeType(t.feeType),
      })) as unknown as FeeTransactionDoc[];

      const monthlyTxnByKey = new Map<string, FeeTransactionDoc>();
      const admTxnByYear = new Map<number, FeeTransactionDoc>();
      const regTxnByYear = new Map<number, FeeTransactionDoc>();
      const examTxnByYear = new Map<number, FeeTransactionDoc>();
      for (const t of normalizedStudentTxns) {
        if (t.feeType === 'monthly') {
          if (typeof t.year !== "number") continue;
          if (typeof t.month !== "number") continue;
          const key = `${t.year}:${t.month}`;
          if (!monthlyTxnByKey.has(key)) monthlyTxnByKey.set(key, t);
        } else if (t.feeType === 'admissionFees') {
          if (typeof t.year !== "number") continue;
          if (!admTxnByYear.has(t.year)) admTxnByYear.set(t.year, t);
        } else if (t.feeType === 'registrationFees') {
          if (typeof t.year !== "number") continue;
          if (!regTxnByYear.has(t.year)) regTxnByYear.set(t.year, t);
        } else if (t.feeType === 'examination') {
          if (typeof t.year !== "number") continue;
          if (!examTxnByYear.has(t.year)) examTxnByYear.set(t.year, t);
        }
      }

      let expectedAmount = 0;
      let paidAmount = 0;
      const monthlyFee = getFeeForClass(cId, 'monthly');
      const admissionFee = getFeeForClass(cId, 'admissionFees');
      const registrationFee = getFeeForClass(cId, 'registrationFees');
      const exams = getExamsForClass(cId);

      const dueMonthsList: string[] = [];
      const feeStatuses: Record<string, { status: string; date?: string }> = {};

      // 1. Monthly Fees in Period
      const currentIterDate = startOfMonth(startDate);
      const endIterDate = endOfMonth(endDate);

    const admissionDate = student.dateOfAdmission ? new Date(student.dateOfAdmission) : new Date(0);
      const effectiveStart = isAfter(admissionDate, currentIterDate) ? startOfMonth(admissionDate) : currentIterDate;

      const tempIterDate = new Date(effectiveStart);
      while (tempIterDate <= endIterDate) {
        const y = tempIterDate.getFullYear();
        const m = tempIterDate.getMonth() + 1; // 1-12
        const monthHeader = tempIterDate.toLocaleString('default', { month: 'short' }) + " " + y;

        const paidTxn = monthlyTxnByKey.get(`${y}:${m}`);
        
        const isAprilIncluded = (() => {
          if (m === 4) {
            const admTxn = admTxnByYear.get(y);
            const regTxn = regTxnByYear.get(y);
            if ((admIncludesApril && admTxn) || (regIncludesApril && regTxn)) {
              return admTxn || regTxn;
            }
          }
          return null;
        })();

        if (isAprilIncluded) {
          if (paidTxn) {
            paidAmount += paidTxn.amount;
          }
          const dateSource = paidTxn || isAprilIncluded;
          feeStatuses[monthHeader] = { 
            status: 'paid',
            date: format(new Date(dateSource.transactionDate || (dateSource as { createdAt?: Date }).createdAt || new Date()), 'dd-MM-yy') 
          };
        } else {
            expectedAmount += monthlyFee;
            if (paidTxn) {
              paidAmount += paidTxn.amount;
              feeStatuses[monthHeader] = { 
                status: 'paid', 
                date: format(new Date(paidTxn.transactionDate || (paidTxn as { createdAt?: Date }).createdAt || new Date()), 'dd-MM-yy') 
              };
            } else {
              feeStatuses[monthHeader] = { status: 'unpaid' };
              dueMonthsList.push(monthHeader);
            }
        }

        tempIterDate.setMonth(tempIterDate.getMonth() + 1);
      }

      // 2. Admission / Registration Fee in Period
      if (isAfter(admissionDate, startOfStartDate) && isBefore(admissionDate, endOfEndDate)) {
        const entryTxn = normalizedStudentTxns.find(
          (t) => t.feeType === 'admissionFees' || t.feeType === 'registrationFees',
        );

        const resolvedType =
          entryTxn?.feeType === 'registrationFees'
            ? 'registrationFees'
            : entryTxn
              ? 'admissionFees'
              : admissionFee
                ? 'admissionFees'
                : 'registrationFees';

        const headerName = resolvedType === 'registrationFees' ? "Registration" : "Admission";
        const entryFeeAmount = resolvedType === 'registrationFees' ? registrationFee : admissionFee;

        if (entryTxn) {
          const expectedEntry = entryFeeAmount > 0 ? entryFeeAmount : entryTxn.amount;
          expectedAmount += expectedEntry;
          paidAmount += entryTxn.amount;

          const remaining = Math.max(0, expectedEntry - entryTxn.amount);
          feeStatuses[headerName] = {
            status: remaining > 0 ? 'partial' : 'paid',
            date: format(new Date(entryTxn.transactionDate || (entryTxn as { createdAt?: Date }).createdAt || new Date()), 'dd-MM-yy'),
          };
          if (remaining > 0) dueMonthsList.push(headerName);
        } else {
          expectedAmount += entryFeeAmount;
          if (entryFeeAmount > 0) {
            feeStatuses[headerName] = { status: 'unpaid' };
            dueMonthsList.push(headerName);
          }
        }
      }

      // 3. Examination Fees in Period
      exams.forEach((exam) => {
        const examMonthNum = monthNameToNumber(exam.month);
        if (examMonthNum !== -1) {
          // Check if this exam falls in any year of the selected period
          const examIterDate = startOfMonth(startDate);
          while (examIterDate <= endIterDate) {
            if (examIterDate.getMonth() === examMonthNum) {
              const y = examIterDate.getFullYear();
              const headerName = exam.title || "Exam";
              expectedAmount += exam.amount;

              const paidExamTxn = examTxnByYear.get(y);

              if (paidExamTxn) {
                paidAmount += paidExamTxn.amount;
                feeStatuses[headerName] = { 
                  status: 'paid', 
                  date: format(new Date(paidExamTxn.transactionDate || (paidExamTxn as { createdAt?: Date }).createdAt || new Date()), 'dd-MM-yy') 
                };
              } else {
                feeStatuses[headerName] = { status: 'unpaid' };
                dueMonthsList.push(headerName);
              }
            }
            examIterDate.setMonth(examIterDate.getMonth() + 1);
          }
        }
      });

      const dueAmount = expectedAmount - paidAmount > 0 ? expectedAmount - paidAmount : 0;

      totalExpectedPeriod += expectedAmount;
      totalDuePeriod += dueAmount;

      let periodStr = "-";
      if (dueMonthsList.length > 0) {
        if (dueMonthsList.length <= 3) {
          periodStr = dueMonthsList.join(", ");
        } else {
          const monthsOnly = dueMonthsList.filter(m => !m.includes("Fee") && !m.includes("Exam") && !m.includes("Admission") && !m.includes("Registration"));
          if (monthsOnly.length > 0) {
            periodStr = `${monthsOnly[0]} - ${monthsOnly[monthsOnly.length - 1]} (${monthsOnly.length} Others)`;
          }
          if (dueMonthsList.includes("Admission") || dueMonthsList.includes("Registration")) {
            periodStr += " + Entry";
          }
          const examDues = dueMonthsList.filter(m => m.includes("Exam") || m.includes("Term"));
          if (examDues.length > 0) {
            periodStr += ` + Exams`;
          }
        }
      }

      return {
        id: sId,
        name: student.name,
        rollNumber: student.rollNumber,
        className: student.classId?.name || 'N/A',
        section: student.section,
        collectedPeriod: paidAmount,
        expectedPeriod: expectedAmount,
        dueAmount,
        status: dueAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Due',
        period: periodStr,
        feeStatuses,
        lastPaymentDate: studentAllTxns.length > 0 ? studentAllTxns.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())[0].transactionDate : null,
      };
    });

    // Chart Data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectionTrend: any[] = [];
    const days = listYmdRange(startYmd, endYmd);
    const txnsByDate: Record<string, number> = {};
    transactions.forEach((txn) => {
      const d = formatInTimeZone(new Date(txn.transactionDate), tz, 'yyyy-MM-dd');
      txnsByDate[d] = (txnsByDate[d] || 0) + txn.amount;
    });
    days.forEach((d) => {
      collectionTrend.push({ date: d, amount: txnsByDate[d] || 0 });
    });

    return {
      summary: {
        totalCollected: totalCollectedPeriod,
        totalExpected: totalExpectedPeriod,
        totalPending: totalDuePeriod,
        collectionRate: totalExpectedPeriod > 0 ? ((totalCollectedPeriod / totalExpectedPeriod) * 100).toFixed(1) : 0,
      },
      trend: collectionTrend,
      studentReport,
      timezone: tz,
    };

  } catch (error) {
    logger.error(error, 'Error fetching fee report');
    throw new Error('Failed to fetch fee report');
  }
}

export const getFeeReport =
  REPORT_CACHE_SECONDS > 0
    ? unstable_cache(
        async (params: FeeReportParams) =>
          withConcurrencyLimit("report:fees", REPORT_CONCURRENCY, () => getFeeReportImpl(params)),
        ["report-fees"],
        { revalidate: REPORT_CACHE_SECONDS, tags: ["reports", "fee-report"] },
      )
    : async (params: FeeReportParams) =>
        withConcurrencyLimit("report:fees", REPORT_CONCURRENCY, () => getFeeReportImpl(params))
