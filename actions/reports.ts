'use server';

import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import Attendance from '@/models/Attendance';
import FeeTransaction from '@/models/FeeTransaction';
import ClassFee from '@/models/ClassFee';
import Setting from '@/models/Setting';
import Holiday from '@/models/Holiday';
import { startOfDay, endOfDay, format, eachDayOfInterval, isBefore, isAfter, startOfMonth, endOfMonth } from 'date-fns';
import logger from "@/lib/logger";
import { Types } from "mongoose";

// --- Interfaces ---

interface AttendanceReportParams {
  startDate: Date;
  endDate: Date;
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
  startDate: Date;
  endDate: Date;
  classId?: string;
  section?: string;
  studentId?: string;
}

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

export async function getAttendanceReport({
  startDate,
  endDate,
  classId,
  section,
  studentId,
}: AttendanceReportParams) {
  await dbConnect();

  try {
    // Build Query for Attendance Records
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {
      date: {
        $gte: startOfDay(startDate),
        $lte: endOfDay(endDate),
      },
    };

    if (classId && classId !== 'all') query.classId = classId;
    if (section && section !== 'all') query.section = section;

    const attendanceRecords = await Attendance.find(query)
      .populate('classId', 'name')
      .populate('records.studentId', 'name rollNumber')
      .lean() as unknown as AttendanceRecordDoc[];

    let totalDays = 0;
    let totalPresent = 0;
    let totalAbsent = 0;

    const studentStats: Record<string, StudentStat> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentQuery: any = { isActive: true };
    if (classId && classId !== 'all') studentQuery.classId = classId;
    if (section && section !== 'all') studentQuery.section = section;
    if (studentId) studentQuery._id = studentId;

    const students = await Student.find(studentQuery)
      .populate('classId', 'name')
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
    const daysInterval = eachDayOfInterval({ start: startDate, end: endDate });
    const totalCalendarDays = daysInterval.length;

    // 2. Get holidays from DB
    const dbHolidays = await Holiday.find({
      $or: [
        { startDate: { $gte: startOfDay(startDate), $lte: endOfDay(endDate) } },
        { endDate: { $gte: startOfDay(startDate), $lte: endOfDay(endDate) } },
        { startDate: { $lte: startOfDay(startDate) }, endDate: { $gte: endOfDay(endDate) } }
      ]
    }).lean();

    // 3. Helper to get stats per class
    const classStatsCache: Record<string, { workingDaysCount: number, holidaysCount: number, isWorkingDate: (d: Date) => boolean }> = {};
    
    const getStatsForClass = (cId: string) => {
      if (classStatsCache[cId]) return classStatsCache[cId];
      
      const relevantHolidays = dbHolidays.filter((h: any) => 
        !h.affectedClasses || 
        h.affectedClasses.length === 0 || 
        h.affectedClasses.some((ac: any) => ac.toString() === cId)
      );

      const isWorkingDate = (d: Date) => {
        if (d.getDay() === 0) return false;
        return !relevantHolidays.some((h: any) => {
          const hStart = startOfDay(new Date(h.startDate));
          const hEnd = endOfDay(new Date(h.endDate));
          return d >= hStart && d <= hEnd;
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
    const studentReport = students.map((s: any) => {
      const sId = s._id.toString();
      const cId = s.classId?._id.toString() || 'unknown';
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
    const globalStats = getStatsForClass('global'); // Fallback logic
    
    const dailyStats: DailyStat[] = [];
    const attendanceByDate: Record<string, AttendanceRecordDoc[]> = {};
    attendanceRecords.forEach((record) => {
      const d = format(new Date(record.date), 'yyyy-MM-dd');
      if (!attendanceByDate[d]) attendanceByDate[d] = [];
      attendanceByDate[d].push(record);
    });

    daysInterval.forEach((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const recordsForDay = attendanceByDate[dateStr];
      
      let dayPresent = 0;
      let dayTotal = 0;

      students.forEach((s: any) => {
         const stats = getStatsForClass(s.classId?._id.toString() || 'unknown');
         if (stats.isWorkingDate(day)) {
            dayTotal++;
            const studentAttendance = recordsForDay?.flatMap(r => r.records).find(rec => rec.studentId?._id.toString() === s._id.toString());
            if (studentAttendance?.status === 'Present') dayPresent++;
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
        averageAttendance: totalPresent > 0 ? ((totalPresent / studentReport.reduce((acc, s) => acc + (s as any).workingDays, 0)) * 100).toFixed(1) : 0,
        totalPresent,
        totalAbsent: studentReport.reduce((acc, s) => acc + (s as any).absent, 0),
      },
      dailyStats,
      studentReport,
    };

  } catch (error) {
    logger.error(error, 'Error fetching attendance report');
    throw new Error('Failed to fetch attendance report');
  }
}

// --- Fee Reporting ---

export async function getFeeReport({
  startDate,
  endDate,
  classId,
  section,
  studentId,
}: FeeReportParams) {
  await dbConnect();

  try {
    const [admSetting, regSetting] = await Promise.all([
        Setting.findOne({ key: "admission_fee_includes_april" }).lean(),
        Setting.findOne({ key: "registration_fee_includes_april" }).lean()
    ]);
    const admIncludesApril = admSetting ? admSetting.value === true : true;
    const regIncludesApril = regSetting ? regSetting.value === true : true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentQuery: any = {};
    if (classId && classId !== 'all') studentQuery.classId = classId;
    if (section && section !== 'all') studentQuery.section = section;
    if (studentId) studentQuery._id = studentId;

    const students = await Student.find(studentQuery)
      .populate('classId', 'name')
      .select('name rollNumber classId section dateOfAdmission')
      .lean();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentIds = students.map((s: any) => s._id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactionQuery: any = {
      studentId: { $in: studentIds },
      status: 'verified',
      transactionDate: {
        $gte: startOfDay(startDate),
        $lte: endOfDay(endDate),
      },
    };

    const transactions = await FeeTransaction.find(transactionQuery).lean() as unknown as FeeTransactionDoc[];

    const allTransactions = await FeeTransaction.find({
      studentId: { $in: studentIds },
      status: 'verified',
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

    let totalCollectedPeriod = 0;
    let totalExpectedPeriod = 0;
    let totalDuePeriod = 0;

    const studentReport = students.map((s: unknown) => {
      const student = s as StudentReportDoc;
      const sId = student._id.toString();
      const cId = student.classId?._id.toString();

      const studentAllTxns = allTransactions.filter((t) => t.studentId.toString() === sId);

      let expectedAmount = 0;
      let paidAmount = 0;
      const monthlyFee = getFeeForClass(cId, 'monthly');
      const admissionFee = getFeeForClass(cId, 'admissionFees');
      const registrationFee = getFeeForClass(cId, 'registrationFees');
      const exams = getExamsForClass(cId);

      const dueMonthsList: string[] = [];
      const feeStatuses: Record<string, any> = {};

      // 1. Monthly Fees in Period
      const currentIterDate = startOfMonth(startDate);
      const endIterDate = endOfMonth(endDate);

      const admissionDate = student.dateOfAdmission ? new Date(student.dateOfAdmission) : new Date();
      const effectiveStart = isAfter(admissionDate, currentIterDate) ? startOfMonth(admissionDate) : currentIterDate;

      const tempIterDate = new Date(effectiveStart);
      while (tempIterDate <= endIterDate) {
        const y = tempIterDate.getFullYear();
        const m = tempIterDate.getMonth() + 1; // 1-12
        const monthHeader = tempIterDate.toLocaleString('default', { month: 'short' }) + " " + y;

        const paidTxn = studentAllTxns.find(t => t.feeType === 'monthly' && t.month === m && t.year === y);
        
        const isAprilIncluded = (() => {
            if (m === 4 && !paidTxn) {
                 const admTxn = studentAllTxns.find(t => (t.feeType === 'admission' || t.feeType === 'admissionFees') && t.year === y);
                 const regTxn = studentAllTxns.find(t => t.feeType === 'registrationFees' && t.year === y);
                 if ((admIncludesApril && admTxn) || (regIncludesApril && regTxn)) {
                     return admTxn || regTxn;
                 }
            }
            return null;
        })();

        if (isAprilIncluded) {
             feeStatuses[monthHeader] = { 
                 status: 'paid', // visually looks paid
                 date: format(new Date(isAprilIncluded.transactionDate || (isAprilIncluded as any).createdAt), 'dd-MM-yy') 
             };
        } else {
            expectedAmount += monthlyFee;
            if (paidTxn) {
              paidAmount += paidTxn.amount;
              feeStatuses[monthHeader] = { 
                status: 'paid', 
                date: format(new Date(paidTxn.transactionDate || (paidTxn as any).createdAt), 'dd-MM-yy') 
              };
            } else {
              feeStatuses[monthHeader] = { status: 'unpaid' };
              dueMonthsList.push(monthHeader);
            }
        }

        tempIterDate.setMonth(tempIterDate.getMonth() + 1);
      }

      // 2. Admission / Registration Fee in Period
      if (isAfter(admissionDate, startOfDay(startDate)) && isBefore(admissionDate, endOfDay(endDate))) {
        // Check if they paid EITHER admission OR registration (anywhere in studentAllTxns)
        const admissionTxn = studentAllTxns.find(t =>
          t.feeType === 'admission' ||
          t.feeType === 'admissionFees' ||
          t.feeType === 'registrationFees'
        );

        const headerName = admissionFee ? "Admission" : "Registration";
        if (admissionTxn) {
          // If they paid either, then it's expected and paid.
          expectedAmount += admissionTxn.amount;
          paidAmount += admissionTxn.amount;
          feeStatuses[headerName] = { 
            status: 'paid', 
            date: format(new Date(admissionTxn.transactionDate || (admissionTxn as any).createdAt), 'dd-MM-yy') 
          };
        } else {
          // If not paid, expect either the admission fee or the registration fee.
          const entryFeeAmount = admissionFee || registrationFee;
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

              const paidExamTxn = studentAllTxns.find(t =>
                t.feeType === 'examination' &&
                t.year === y &&
                (t.examType === exam.title || t.feeType === 'examination') // Fallback check
              );

              if (paidExamTxn) {
                paidAmount += paidExamTxn.amount;
                feeStatuses[headerName] = { 
                  status: 'paid', 
                  date: format(new Date(paidExamTxn.transactionDate || (paidExamTxn as any).createdAt), 'dd-MM-yy') 
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

      totalCollectedPeriod += paidAmount;
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
        status: dueAmount <= 0 ? 'Paid' : 'Due',
        period: periodStr,
        feeStatuses,
        lastPaymentDate: studentAllTxns.length > 0 ? studentAllTxns.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())[0].transactionDate : null,
      };
    });

    // Chart Data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectionTrend: any[] = [];
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const txnsByDate: Record<string, number> = {};
    transactions.forEach((txn) => {
      const d = format(new Date(txn.transactionDate), 'yyyy-MM-dd');
      txnsByDate[d] = (txnsByDate[d] || 0) + txn.amount;
    });
    days.forEach((day) => {
      const d = format(day, 'yyyy-MM-dd');
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
    };

  } catch (error) {
    logger.error(error, 'Error fetching fee report');
    throw new Error('Failed to fetch fee report');
  }
}
