"use server"

import dbConnect from "@/lib/db"
import FeeTransaction from "@/models/FeeTransaction"
import Student from "@/models/Student"
import ClassFee from "@/models/ClassFee"
import Expense from "@/models/Expense"
import Attendance from "@/models/Attendance"
import { startOfDay, endOfDay, startOfMonth, endOfMonth, eachMonthOfInterval, format, subMonths, subWeeks, subDays } from "date-fns"
import { Types } from "mongoose"
import logger from "@/lib/logger"

interface DashboardFilter {
    startDate?: Date;
    endDate?: Date;
    classId?: string;
}

interface FeeQuery {
    transactionDate?: {
        $gte: Date;
        $lte: Date;
    };
    studentId?: { $in: string[] };
}

interface FeeConfig {
    _id: { toString: () => string };
    classId: { toString: () => string };
    type: string;
    amount: number;
    effectiveFrom?: Date;
    isActive: boolean;
}

interface MonthlyAggResult {
    _id: {
        month: number;
        year: number;
    };
    collected: number;
    pending: number;
}

interface PaidFeeItem {
    type: string;
    m?: number;
    y: number;
}

interface PaidFeeAggResult {
    _id: { toString: () => string };
    paid: PaidFeeItem[];
}

interface UnpaidStudent {
    id: string;
    name: string;
    className: string;
    amount: number;
    months: string[];
    photo?: string;
    mobile: string[];
    email: string[];
    registrationNumber?: string;
    rollNumber?: string;
}

interface OverviewData {
    name: string;
    collected: number;
    pending: number;
    unpaid: number;
}

interface StudentDoc {
    _id: Types.ObjectId;
    name: string;
    registrationNumber?: string;
    classId: { _id: Types.ObjectId; name: string };
    admissionDate?: Date;
    createdAt: Date;
    rollNumber?: string;
    photo?: string;
    contacts?: { mobile?: string[]; email?: string[] };
    mobile?: string[];
    email?: string[];
}

interface SaleDoc {
    _id: { toString: () => string };
    amount: number;
    studentId?: {
        name: string;
        contacts?: { mobile?: string[] };
        photo?: string;
    };
    status: string;
}

interface ClassWiseDoc {
    _id: string;
    collected: number;
    pending: number;
}

export async function getDashboardStats(filter: DashboardFilter) {
    try {
    await dbConnect();

    const query: FeeQuery = {};

    if (filter.startDate && filter.endDate) {
        query.transactionDate = {
            $gte: startOfDay(filter.startDate),
            $lte: endOfDay(filter.endDate)
        };
    }

    let studentIds: string[] | null = null;
    if (filter.classId && filter.classId !== "all") {
        const studentsInClass = await Student.find({ classId: filter.classId }).select('_id');
        studentIds = studentsInClass.map(s => s._id.toString());
        query.studentId = { $in: studentIds };
    }

    const statsResult = await FeeTransaction.aggregate([
        { $match: { ...query, status: { $in: ['verified', 'pending'] } } },
        {
            $group: {
                _id: null,
                collected: { $sum: { $cond: [{ $eq: ["$status", "verified"] }, "$amount", 0] } },
                pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] } }
            }
        }
    ]);

    const collected = statsResult[0]?.collected || 0;
    const pending = statsResult[0]?.pending || 0;

    const end = filter.endDate || endOfMonth(new Date());
    const start = filter.startDate || startOfMonth(new Date(new Date().getFullYear(), 0, 1));
    const monthsToCheck = eachMonthOfInterval({ start, end });

    // 1. Get Monthly Collected/Pending Stats via Aggregation
    const monthlyStatsMap = new Map<string, { collected: number, pending: number }>();
    const monthlyAgg = await FeeTransaction.aggregate([
        { 
            $match: { 
                status: { $in: ['verified', 'pending'] },
                transactionDate: { $gte: start, $lte: end }
            } 
        },
        {
            $group: {
                _id: { 
                    month: { $month: "$transactionDate" }, 
                    year: { $year: "$transactionDate" } 
                },
                collected: { $sum: { $cond: [{ $eq: ["$status", "verified"] }, "$amount", 0] } },
                pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] } }
            }
        }
    ]);

    monthlyAgg.forEach((item: MonthlyAggResult) => {
        const key = `${item._id.month}-${item._id.year}`;
        monthlyStatsMap.set(key, { collected: item.collected, pending: item.pending });
    });

    // 2. Efficiently Fetch Students and Fees
    const studentQuery: Record<string, unknown> = { isActive: true };
    if (filter.classId && filter.classId !== "all") {
        studentQuery.classId = filter.classId;
    }
    const allStudents = await Student.find(studentQuery)
        .select('name classId admissionDate createdAt photo contacts registrationNumber rollNumber mobile email')
        .populate('classId', 'name')
        .lean();
        
    const activeStudentIds = allStudents.map(s => (s as StudentDoc)._id);

    const classFees = await ClassFee.find({ isActive: true }).lean();
    const feeMap = new Map<string, FeeConfig[]>();
    classFees.forEach((fee: unknown) => {
        const f = fee as FeeConfig;
        const cid = f.classId.toString();
        if (!feeMap.has(cid)) feeMap.set(cid, []);
        feeMap.get(cid)?.push(f);
    });

    // 3. Aggregate Paid Fees per Student (One doc per student with array of paid items)
    // This replaces fetching ALL transactions individually
    const yearsToCheck = new Set(monthsToCheck.map(m => m.getFullYear()));
    const paidFeesAgg = await FeeTransaction.aggregate([
        {
            $match: {
                studentId: { $in: activeStudentIds },
                status: { $in: ['verified', 'pending'] },
                year: { $in: Array.from(yearsToCheck) }
            }
        },
        {
            $group: {
                _id: "$studentId",
                paid: {
                    $push: {
                        type: "$feeType",
                        m: "$month",
                        y: "$year"
                    }
                }
            }
        }
    ]);

    // Create a fast lookup map: StudentID -> Set of "Type-Month-Year"
    const studentPaidMap = new Map<string, Set<string>>();
    paidFeesAgg.forEach((item: unknown) => {
        const i = item as PaidFeeAggResult;
        const set = new Set<string>();
        i.paid.forEach((p) => {
            if (p.type === 'monthly') {
                set.add(`${p.type}-${p.m}-${p.y}`);
            } else {
                set.add(`${p.type}-${p.y}`);
            }
        });
        studentPaidMap.set(i._id.toString(), set);
    });

    const unpaidList: UnpaidStudent[] = [];
    let totalUnpaid = 0;
    let totalExpected = 0;
    
    // Helper to check payment using the Map (O(1))
    const hasPaidFeeFast = (studentId: string, type: string, month: number | undefined, year: number) => {
        const paidSet = studentPaidMap.get(studentId);
        if (!paidSet) return false;
        if (type === 'monthly') return paidSet.has(`${type}-${month}-${year}`);
        return paidSet.has(`${type}-${year}`);
    };

    const monthlyUnpaidMap = new Map<string, number>(); // "Month-Year" -> Amount

    for (const s of allStudents) {
        const student = s as StudentDoc;
        const studentId = student._id.toString();
        const studentFees = feeMap.get(student.classId._id.toString()) || [];
        const admissionDate = new Date(student.admissionDate || student.createdAt);
        const admMonth = admissionDate.getMonth() + 1;
        const admYear = admissionDate.getFullYear();

        let studentUnpaidAmount = 0;
        const studentUnpaidDetails: string[] = [];

        const monthlyFeeConfig = studentFees.find(f => f.type === 'monthly');
        if (monthlyFeeConfig) {
            const monthlyAmount = monthlyFeeConfig.amount;

            for (const monthDate of monthsToCheck) {
                const m = monthDate.getMonth() + 1;
                const y = monthDate.getFullYear();
                const monthKey = `${m}-${y}`;
                const isAfterAdmission = (y > admYear) || (y === admYear && m >= admMonth);

                if (isAfterAdmission) {
                    totalExpected += monthlyAmount;

                    if (!hasPaidFeeFast(studentId, 'monthly', m, y)) {
                        studentUnpaidAmount += monthlyAmount;
                        studentUnpaidDetails.push(`${format(monthDate, 'MMM')} ${y}`);
                        
                        // Accumulate monthly unpaid for overview
                        const current = monthlyUnpaidMap.get(monthKey) || 0;
                        monthlyUnpaidMap.set(monthKey, current + monthlyAmount);
                    }
                }
            }
        }

        const examFeeConfig = studentFees.find(f => f.type === 'examination');
        if (examFeeConfig && examFeeConfig.effectiveFrom) {
            const examDate = new Date(examFeeConfig.effectiveFrom);
            const examMonth = examDate.getMonth() + 1;
            const examYear = examDate.getFullYear();

            const isDueInPeriod = monthsToCheck.some(d =>
                d.getMonth() + 1 === examMonth && d.getFullYear() === examYear
            );
            const isStudentEligible = (examYear > admYear) || (examYear === admYear && examMonth >= admMonth);

            if (isDueInPeriod && isStudentEligible) {
                totalExpected += examFeeConfig.amount;

                if (!hasPaidFeeFast(studentId, 'examination', undefined, examYear)) {
                    studentUnpaidAmount += examFeeConfig.amount;
                    studentUnpaidDetails.push(`Exam Fee (${format(examDate, 'MMM')})`);
                    // Note: Exam fees don't easily map to a specific month in "Overview" chart unless we force it.
                    // Usually Overview is Monthly Fees. Let's ignore Exam Fee in Monthly Overview Unpaid for now to match typical logic,
                    // or add it to the exam month.
                    const examMonthKey = `${examMonth}-${examYear}`;
                    if (monthlyUnpaidMap.has(examMonthKey)) {
                         const current = monthlyUnpaidMap.get(examMonthKey) || 0;
                         monthlyUnpaidMap.set(examMonthKey, current + examFeeConfig.amount);
                    }
                }
            }
        }

        // Admission Fee Logic (simplified)
        const isAdmissionInPeriod = monthsToCheck.some(d =>
            d.getMonth() + 1 === admMonth && d.getFullYear() === admYear
        );

        if (isAdmissionInPeriod) {
            const admissionFeeConfig = studentFees.find(f => f.type === 'admission');

            if (admissionFeeConfig) {
                totalExpected += admissionFeeConfig.amount;

                if (!hasPaidFeeFast(studentId, 'admission', undefined, admYear)) {
                    studentUnpaidAmount += admissionFeeConfig.amount;
                    studentUnpaidDetails.push(`Admission Fee`);
                    
                    const admKey = `${admMonth}-${admYear}`;
                     if (monthlyUnpaidMap.has(admKey)) {
                         const current = monthlyUnpaidMap.get(admKey) || 0;
                         monthlyUnpaidMap.set(admKey, current + admissionFeeConfig.amount);
                    }
                }
            }
        }

        if (studentUnpaidAmount > 0) {
            const toStringArray = (value: unknown) =>
                Array.isArray(value)
                    ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
                    : [];

            const mergedMobile = Array.from(new Set([
                ...toStringArray(student.contacts?.mobile),
                ...toStringArray(student.mobile)
            ]));
            const mergedEmail = Array.from(new Set([
                ...toStringArray(student.contacts?.email),
                ...toStringArray(student.email)
            ]));

            totalUnpaid += studentUnpaidAmount;
            unpaidList.push({
                id: student._id.toString(),
                name: student.name,
                className: student.classId.name,
                amount: studentUnpaidAmount,
                months: studentUnpaidDetails,
                photo: student.photo,
                mobile: mergedMobile,
                email: mergedEmail,
                registrationNumber: student.registrationNumber,
                rollNumber: student.rollNumber
            });
        }
    }

    const processedOverview: OverviewData[] = monthsToCheck.map(month => {
        const m = month.getMonth() + 1;
        const y = month.getFullYear();
        const key = `${m}-${y}`;
        const stats = monthlyStatsMap.get(key) || { collected: 0, pending: 0 };
        
        return {
            name: format(month, 'MMM'),
            collected: stats.collected,
            pending: stats.pending,
            unpaid: monthlyUnpaidMap.get(key) || 0
        };
    });

    const recentSales = await FeeTransaction.find({
        ...query,
        status: { $in: ['verified', 'pending'] }
    })
        .sort({ transactionDate: -1 })
        .limit(5)
        .populate('studentId', 'name contacts photo')
        .lean();



    const classWiseData = await FeeTransaction.aggregate([
        { $match: { ...query } },
        {
            $lookup: {
                from: "students",
                localField: "studentId",
                foreignField: "_id",
                as: "student"
            }
        },
        { $unwind: "$student" },
        {
            $lookup: {
                from: "classes",
                localField: "student.classId",
                foreignField: "_id",
                as: "class"
            }
        },
        { $unwind: "$class" },
        {
            $group: {
                _id: "$class.name",
                collected: {
                    $sum: {
                        $cond: [{ $eq: ["$status", "verified"] }, "$amount", 0]
                    }
                },
                pending: {
                    $sum: {
                        $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0]
                    }
                }
            }
        },
        { $sort: { collected: -1 } }
    ]);

    // Calculate Expenses
    const expenseQuery: Record<string, unknown> = { status: 'active' };
    if (filter.startDate && filter.endDate) {
        expenseQuery.expenseDate = {
            $gte: startOfDay(filter.startDate),
            $lte: endOfDay(filter.endDate)
        };
    }

    const expenseResult = await Expense.aggregate([
        { $match: expenseQuery },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const totalExpenses = expenseResult[0]?.total || 0;
    const netProfit = collected - totalExpenses;

    // Calculate Revenue Change (Current vs Last Week)
    // For simplicity, we compare "current period" vs "previous period of same duration"
    // But UI says "from last week". Let's calculate Last Week vs This Week for now if no filter, or Period vs Previous Period.
    // Default filter is last 30 days. Let's assume standard behavior:
    // "Revenue" usually means collected.
    // Compare (EndDate - 7 days) to EndDate VS (EndDate - 14 days) to (EndDate - 7 days)
    
    const today = new Date();
    const lastWeekStart = subWeeks(today, 1);
    const twoWeeksAgoStart = subWeeks(today, 2);

    const revenueThisWeekResult = await FeeTransaction.aggregate([
        { $match: { transactionDate: { $gte: lastWeekStart, $lte: today }, status: 'verified' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const revenueLastWeekResult = await FeeTransaction.aggregate([
        { $match: { transactionDate: { $gte: twoWeeksAgoStart, $lt: lastWeekStart }, status: 'verified' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const revenueThisWeek = revenueThisWeekResult[0]?.total || 0;
    const revenueLastWeek = revenueLastWeekResult[0]?.total || 0;
    
    let revenueChange = 0;
    if (revenueLastWeek > 0) {
        revenueChange = Math.round(((revenueThisWeek - revenueLastWeek) / revenueLastWeek) * 100);
    } else if (revenueThisWeek > 0) {
        revenueChange = 100;
    }

    // Calculate Expense Change (Current vs Last Week)
    const expenseThisWeekResult = await Expense.aggregate([
        { $match: { expenseDate: { $gte: lastWeekStart, $lte: today }, status: 'active' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const expenseLastWeekResult = await Expense.aggregate([
        { $match: { expenseDate: { $gte: twoWeeksAgoStart, $lt: lastWeekStart }, status: 'active' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const expenseThisWeek = expenseThisWeekResult[0]?.total || 0;
    const expenseLastWeek = expenseLastWeekResult[0]?.total || 0;
    
    let expenseChange = 0;
    if (expenseLastWeek > 0) {
        expenseChange = Math.round(((expenseThisWeek - expenseLastWeek) / expenseLastWeek) * 100);
    } else if (expenseThisWeek > 0) {
        expenseChange = 100;
    }

    // Calculate Pending Change (Current Month vs Last Month)
    const thisMonthStart = startOfMonth(today);
    const lastMonthStart = startOfMonth(subMonths(today, 1));
    const lastMonthEnd = endOfMonth(subMonths(today, 1));

    const pendingThisMonthResult = await FeeTransaction.aggregate([
        { $match: { transactionDate: { $gte: thisMonthStart, $lte: today }, status: 'pending' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const pendingLastMonthResult = await FeeTransaction.aggregate([
        { $match: { transactionDate: { $gte: lastMonthStart, $lte: lastMonthEnd }, status: 'pending' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const pendingThisMonth = pendingThisMonthResult[0]?.total || 0;
    const pendingLastMonth = pendingLastMonthResult[0]?.total || 0;

    let pendingChange = 0;
    if (pendingLastMonth > 0) {
        pendingChange = Math.round(((pendingThisMonth - pendingLastMonth) / pendingLastMonth) * 100);
    } else if (pendingThisMonth > 0) {
        pendingChange = 100;
    }


    return {
        collected,
        pending,
        totalExpenses,
        netProfit,
        unpaid: totalUnpaid,
        collectable: totalExpected,
        recentSales: recentSales.map((sale: unknown) => {
            const s = sale as SaleDoc;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sAny = s as any; 
            return {
                id: s._id.toString(),
                amount: s.amount,
                studentName: s.studentId?.name || 'Unknown',
                contactNumber: s.studentId?.contacts?.mobile?.[0] || 'N/A',
                studentPhoto: s.studentId?.photo,
                status: s.status,
                type: sAny.feeType,
                month: sAny.month,
                year: sAny.year,
                transactionDate: sAny.transactionDate
            };
        }),
        overview: processedOverview,
        classWise: classWiseData.map((c: unknown) => {
            const cls = c as ClassWiseDoc;
            return {
                name: cls._id,
                collected: cls.collected,
                pending: cls.pending
            };
        }),
        unpaidStudents: unpaidList.sort((a, b) => b.amount - a.amount),
        revenueChange,
        pendingChange,
        expenseChange
    };
    } catch (error) {
        logger.error(error, "Failed to get dashboard stats");
        // Return default/empty stats instead of crashing
        return {
            collected: 0,
            pending: 0,
            totalExpenses: 0,
            netProfit: 0,
            unpaid: 0,
            collectable: 0,
            recentSales: [],
            overview: [],
            classWise: [],
            unpaidStudents: [],
            revenueChange: 0,
            pendingChange: 0,
            expenseChange: 0
        };
    }
}

export async function getAttendanceStats() {
    await dbConnect();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const totalStudents = await Student.countDocuments({ isActive: true });
    
    // Get attendance for today
    const attendanceDocs = await Attendance.find({
        date: { $gte: today, $lt: tomorrow }
    }).populate('classId', 'name').lean();

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalHoliday = 0;
    
    interface ClassStats {
        present: number;
        absent: number;
        holiday: number;
        total: number;
    }

    interface AttendanceDoc {
        classId: { name: string };
        records: { status: string }[];
    }

    const classWiseAttendance: Record<string, ClassStats> = {};

    attendanceDocs.forEach((doc: unknown) => {
        const d = doc as AttendanceDoc;
        const className = d.classId?.name || 'Unknown';
        if (!classWiseAttendance[className]) {
            classWiseAttendance[className] = { present: 0, absent: 0, holiday: 0, total: 0 };
        }

        d.records.forEach((record) => {
            if (record.status === 'Present') {
                totalPresent++;
                classWiseAttendance[className].present++;
            } else if (record.status === 'Absent') {
                totalAbsent++;
                classWiseAttendance[className].absent++;
            } else if (record.status === 'Holiday') {
                totalHoliday++;
                classWiseAttendance[className].holiday++;
            }
            classWiseAttendance[className].total++;
        });
    });

    return {
        totalStudents,
        totalPresent,
        totalAbsent,
        totalHoliday,
        classWise: Object.entries(classWiseAttendance).map(([name, stats]) => ({
            name,
            ...stats
        }))
    };
}

export async function getStaffDashboardStats(userId: string) {
    await dbConnect();

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    // 1. My Collection Today
    const collectionTodayResult = await FeeTransaction.aggregate([
        { $match: { collectedBy: new Types.ObjectId(userId), transactionDate: { $gte: todayStart, $lte: todayEnd }, status: 'verified' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const myCollectionToday = collectionTodayResult[0]?.total || 0;

    // 2. My Collection This Month
    const collectionMonthResult = await FeeTransaction.aggregate([
        { $match: { collectedBy: new Types.ObjectId(userId), transactionDate: { $gte: monthStart, $lte: monthEnd }, status: 'verified' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const myCollectionMonth = collectionMonthResult[0]?.total || 0;

    // 3. My Pending Count
    const myPendingCount = await FeeTransaction.countDocuments({
        collectedBy: userId,
        status: 'pending'
    });

    // 4. Students Admitted Today (Global)
    const studentsAdmittedToday = await Student.countDocuments({
        createdAt: { $gte: todayStart, $lte: todayEnd }
    });

    // 5. Recent Transactions
    const recentTransactions = await FeeTransaction.find({ collectedBy: userId })
        .sort({ transactionDate: -1 })
        .limit(5)
        .populate('studentId', 'name contacts photo')
        .lean();

    // 6. Monthly Collections (Last 12 Months) for Line Chart
    const end = new Date();
    const start = subMonths(new Date(), 11);
    const monthsToCheck = eachMonthOfInterval({ start, end });

    const monthlyCollections = await Promise.all(monthsToCheck.map(async (date) => {
        const s = startOfMonth(date);
        const e = endOfMonth(date);
        const result = await FeeTransaction.aggregate([
            { $match: { collectedBy: new Types.ObjectId(userId), transactionDate: { $gte: s, $lte: e }, status: 'verified' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        return {
            name: format(date, 'MMM'),
            value: result[0]?.total || 0
        };
    }));

    // 7. Global Pending Trend (Last 12 Months) for Line Chart
    // NOTE: This is GLOBAL pending, not just for this user, as requested layout shows "Global Pending Fees Breakdown"
    const globalPendingTrend = await Promise.all(monthsToCheck.map(async (date) => {
        const s = startOfMonth(date);
        const e = endOfMonth(date);
        const result = await FeeTransaction.aggregate([
            { $match: { transactionDate: { $gte: s, $lte: e }, status: 'pending' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        return {
            name: format(date, 'MMM'),
            value: result[0]?.total || 0
        };
    }));

    // 8. Total Stats for User (Lifetime)
    const totalStats = await FeeTransaction.aggregate([
        { $match: { collectedBy: new Types.ObjectId(userId) } },
        { $group: { 
            _id: "$status", 
            total: { $sum: "$amount" },
            count: { $sum: 1 }
        }}
    ]);

    const totalCollected = totalStats.find(s => s._id === 'verified')?.total || 0;
    const totalPending = totalStats.find(s => s._id === 'pending')?.total || 0;
    const totalRejected = totalStats.find(s => s._id === 'rejected')?.total || 0;

    // Comparisons for Staff
    const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
    const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));
    const collectionLastMonthResult = await FeeTransaction.aggregate([
        { $match: { collectedBy: new Types.ObjectId(userId), transactionDate: { $gte: lastMonthStart, $lte: lastMonthEnd }, status: 'verified' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const myCollectionLastMonth = collectionLastMonthResult[0]?.total || 0;

    const yesterdayStart = startOfDay(subDays(new Date(), 1));
    const yesterdayEnd = endOfDay(subDays(new Date(), 1));
    const collectionYesterdayResult = await FeeTransaction.aggregate([
        { $match: { collectedBy: new Types.ObjectId(userId), transactionDate: { $gte: yesterdayStart, $lte: yesterdayEnd }, status: 'verified' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const myCollectionYesterday = collectionYesterdayResult[0]?.total || 0;


    return {
        myCollectionToday,
        myCollectionMonth,
        myCollectionLastMonth,
        myCollectionYesterday,
        myPendingCount,
        studentsAdmittedToday,
        recentTransactions: recentTransactions.map((sale: unknown) => {
             const s = sale as SaleDoc;
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const sAny = s as any; 
             return {
                 id: s._id.toString(),
                 amount: s.amount,
                 studentName: s.studentId?.name || 'Unknown',
                 contactNumber: s.studentId?.contacts?.mobile?.[0] || 'N/A',
                 studentPhoto: s.studentId?.photo,
                 status: s.status,
                 type: sAny.feeType,
                 month: sAny.month,
                 year: sAny.year,
                 transactionDate: sAny.transactionDate
             };
         }),
        monthlyCollections,
        globalPendingTrend,
        totalCollected,
        totalPending,
        totalRejected
    };
}
