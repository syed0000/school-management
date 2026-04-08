"use server"

import dbConnect from "@/lib/db"
import FeeTransaction from "@/models/FeeTransaction"
import Student from "@/models/Student"
import ClassFee from "@/models/ClassFee"
// Ensure Class model is registered
import "@/models/Class"
import Expense from "@/models/Expense"
import Attendance from "@/models/Attendance"
import Setting from "@/models/Setting"
import { startOfMonth, endOfMonth, eachMonthOfInterval, format, subMonths, subWeeks, subDays } from "date-fns"
import { Types } from "mongoose"
import logger from "@/lib/logger"
import { unstable_cache } from "next/cache"
import { getCurrentSessionRange } from "@/lib/utils"
import { getSchoolDateBoundaries } from "@/lib/tz-utils"

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
    title?: string;
    month?: string;
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
    title?: string;
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
    expense: number;
    profit: number;
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

interface SaleDocExtended extends SaleDoc {
    feeType: string;
    month?: number;
    year: number;
    transactionDate: Date;
}

async function calculateUnpaidStats(monthsToCheck: Date[], classIdFilter?: string) {
    const [admSetting, regSetting] = await Promise.all([
        Setting.findOne({ key: "admission_fee_includes_april" }).lean(),
        Setting.findOne({ key: "registration_fee_includes_april" }).lean()
    ]);
    const admIncludesApril = admSetting ? admSetting.value === true : true;
    const regIncludesApril = regSetting ? regSetting.value === true : true;

    // 2. Efficiently Fetch Students and Fees
    const studentQuery: Record<string, unknown> = { isActive: true };
    if (classIdFilter && classIdFilter !== "all") {
        studentQuery.classId = classIdFilter;
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
                        y: "$year",
                        title: "$examType"
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
            } else if (p.type === 'examination' && p.title) {
                set.add(`${p.type}-${p.title}-${p.y}`);
            } else {
                set.add(`${p.type}-${p.y}`);
            }
        });
        studentPaidMap.set(i._id.toString(), set);
    });

    const unpaidList: UnpaidStudent[] = [];
    let totalUnpaid = 0;
    let totalExpected = 0;
    const monthlyUnpaidMap = new Map<string, number>(); // "Month-Year" -> Amount

    // Helper to check payment using the Map (O(1))
    const hasPaidFeeFast = (studentId: string, type: string, month: number | undefined, year: number, title?: string) => {
        const paidSet = studentPaidMap.get(studentId);
        if (!paidSet) return false;
        if (type === 'monthly') return paidSet.has(`${type}-${month}-${year}`);
        if (type === 'examination' && title) return paidSet.has(`${type}-${title}-${year}`);
        return paidSet.has(`${type}-${year}`);
    };

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
                    let isPaid = hasPaidFeeFast(studentId, 'monthly', m, y);
                    
                    if (m === 4 && !isPaid) {
                        const paidAdm = hasPaidFeeFast(studentId, 'admission', undefined, y) || hasPaidFeeFast(studentId, 'admissionFees', undefined, y);
                        const paidReg = hasPaidFeeFast(studentId, 'registrationFees', undefined, y);
                        
                        if ((admIncludesApril && paidAdm) || (regIncludesApril && paidReg)) {
                            isPaid = true;
                        }
                    }

                    totalExpected += monthlyAmount;

                    if (!isPaid) {
                        studentUnpaidAmount += monthlyAmount;
                        studentUnpaidDetails.push(`${format(monthDate, 'MMM')} ${y}`);

                        // Accumulate monthly unpaid for overview
                        const current = monthlyUnpaidMap.get(monthKey) || 0;
                        monthlyUnpaidMap.set(monthKey, current + monthlyAmount);
                    }
                }
            }
        }

        const examFeesConfig = studentFees.filter(f => f.type === 'examination');
        for (const examFeeConfig of examFeesConfig) {
            if (examFeeConfig.effectiveFrom) {
                const examDate = new Date(examFeeConfig.effectiveFrom);
                const examMonth = examDate.getMonth() + 1;
                const examYear = examDate.getFullYear();

                // Check if this exam falls within the filter period
                const isDueInPeriod = monthsToCheck.some(d =>
                    d.getMonth() + 1 === examMonth && d.getFullYear() === examYear
                );
                const isStudentEligible = (examYear > admYear) || (examYear === admYear && examMonth >= admMonth);

                if (isDueInPeriod && isStudentEligible) {
                    totalExpected += examFeeConfig.amount;

                    // Check if specific exam (by title and year) is paid
                    if (!hasPaidFeeFast(studentId, 'examination', undefined, examYear, examFeeConfig.title)) {
                        studentUnpaidAmount += examFeeConfig.amount;
                        studentUnpaidDetails.push(`${examFeeConfig.title || 'Examination Fee'} (${examYear})`);

                        const examMonthKey = `${examMonth}-${examYear}`;
                        const current = monthlyUnpaidMap.get(examMonthKey) || 0;
                        monthlyUnpaidMap.set(examMonthKey, current + examFeeConfig.amount);
                    }
                }
            }
        }

        // Admission Fee Logic (simplified)
        const isAdmissionInPeriod = monthsToCheck.some(d =>
            d.getMonth() + 1 === admMonth && d.getFullYear() === admYear
        )

        if (isAdmissionInPeriod) {
            // Check if ANY entrance fee has been paid (Admission or Registration)
            const hasPaidAdmission = hasPaidFeeFast(studentId, 'admission', undefined, admYear) || 
                                    hasPaidFeeFast(studentId, 'admissionFees', undefined, admYear);
            const hasPaidRegistration = hasPaidFeeFast(studentId, 'registrationFees', undefined, admYear);

            if (!hasPaidAdmission && !hasPaidRegistration) {
                // Not paid any. See what we should expect.
                const admissionFeeConfig = studentFees.find(f => f.type === 'admission' || f.type === 'admissionFees');
                const registrationFeeConfig = studentFees.find(f => f.type === 'registrationFees');
                
                // Only expect ONE (prefer Admission if both configured, or whichever exists)
                const entranceConfig = admissionFeeConfig || registrationFeeConfig;

                if (entranceConfig) {
                    totalExpected += entranceConfig.amount;
                    studentUnpaidAmount += entranceConfig.amount;
                    studentUnpaidDetails.push(entranceConfig.type === 'registrationFees' ? 'Registration Fee' : 'Admission Fee');

                    const admKey = `${admMonth}-${admYear}`;
                    const current = monthlyUnpaidMap.get(admKey) || 0;
                    monthlyUnpaidMap.set(admKey, current + entranceConfig.amount);
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

    return { unpaidList, totalUnpaid, totalExpected, monthlyUnpaidMap };
}

export const getDashboardStats = unstable_cache(
    async (filter: DashboardFilter) => {
    try {
        await dbConnect();

        const query: FeeQuery = {};

        if (filter.startDate && filter.endDate) {
            // Adjust to timezone boundaries for UTC servers
            const { startUtc } = await getSchoolDateBoundaries(filter.startDate);
            const { endUtc: finalEndUtc } = await getSchoolDateBoundaries(filter.endDate);
            
            query.transactionDate = {
                $gte: startUtc,
                $lte: finalEndUtc
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

        const { from: sessionStart, to: sessionEnd } = getCurrentSessionRange();
        const start = filter.startDate || sessionStart;
        const end = filter.endDate || sessionEnd;
        const monthsToCheck = eachMonthOfInterval({ start, end });

        // 1. Get Monthly Collected/Pending Stats via Aggregation
        const monthlyStatsMap = new Map<string, { collected: number, pending: number, expense: number }>();
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

        // Aggregate monthly expenses
        const monthlyExpenseAgg = await Expense.aggregate([
            {
                $match: {
                    status: 'active',
                    expenseDate: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$expenseDate" },
                        year: { $year: "$expenseDate" }
                    },
                    total: { $sum: "$amount" }
                }
            }
        ]);

        monthlyAgg.forEach((item: MonthlyAggResult) => {
            const key = `${item._id.month}-${item._id.year}`;
            const current = monthlyStatsMap.get(key) || { collected: 0, pending: 0, expense: 0 };
            monthlyStatsMap.set(key, { ...current, collected: item.collected, pending: item.pending });
        });

        monthlyExpenseAgg.forEach((item: { _id: { month: number, year: number }, total: number }) => {
            const key = `${item._id.month}-${item._id.year}`;
            const current = monthlyStatsMap.get(key) || { collected: 0, pending: 0, expense: 0 };
            monthlyStatsMap.set(key, { ...current, expense: item.total });
        });

        const { unpaidList, totalUnpaid, totalExpected, monthlyUnpaidMap } = await calculateUnpaidStats(monthsToCheck, filter.classId);

        const processedOverview: OverviewData[] = monthsToCheck.map(month => {
            const m = month.getMonth() + 1;
            const y = month.getFullYear();
            const key = `${m}-${y}`;
            const stats = monthlyStatsMap.get(key) || { collected: 0, pending: 0, expense: 0 };
            const unpaid = monthlyUnpaidMap.get(key) || 0;

            return {
                name: format(month, 'MMM'),
                collected: stats.collected,
                pending: stats.pending,
                unpaid: unpaid,
                expense: stats.expense,
                profit: stats.collected - stats.expense
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
            const { startUtc } = await getSchoolDateBoundaries(filter.startDate);
            const { endUtc: finalEndUtc } = await getSchoolDateBoundaries(filter.endDate);
            
            expenseQuery.expenseDate = {
                $gte: startUtc,
                $lte: finalEndUtc
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
        } else if (revenueLastWeek === 0 && revenueThisWeek === 0) {
            revenueChange = 0;
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
        } else if (pendingLastMonth === 0 && pendingThisMonth === 0) {
            pendingChange = 0;
        }


        return {
            collected,
            pending,
            totalExpenses,
            netProfit,
            unpaid: totalUnpaid,
            collectable: totalExpected,
            recentSales: recentSales.map((sale: unknown) => {
                const s = sale as SaleDocExtended;
                return {
                    id: s._id.toString(),
                    amount: s.amount,
                    studentName: s.studentId?.name || 'Unknown',
                    contactNumber: s.studentId?.contacts?.mobile?.[0] || 'N/A',
                    studentPhoto: s.studentId?.photo,
                    status: s.status,
                    type: s.feeType,
                    month: s.month,
                    year: s.year,
                    transactionDate: s.transactionDate
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
}, ['dashboard-stats'], { revalidate: 3600, tags: ['dashboard'] })

export const getAttendanceStats = unstable_cache(async () => {
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
}, ['attendance-stats'], { revalidate: 300, tags: ['attendance'] })

export const getStaffDashboardStats = unstable_cache(async (userId: string) => {
    await dbConnect();

    const { startUtc: todayStart, endUtc: todayEnd } = await getSchoolDateBoundaries(new Date());
    const { startUtc: monthStart } = await getSchoolDateBoundaries(startOfMonth(new Date()));
    const { endUtc: monthEnd } = await getSchoolDateBoundaries(endOfMonth(new Date()));

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
    // NOTE: This is GLOBAL pending, not just for this user, as requested layout shows "Global Pending Fees"
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
        {
            $group: {
                _id: "$status",
                total: { $sum: "$amount" },
                count: { $sum: 1 }
            }
        }
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

    const { startUtc: yesterdayStart, endUtc: yesterdayEnd } = await getSchoolDateBoundaries(subDays(new Date(), 1));
    const collectionYesterdayResult = await FeeTransaction.aggregate([
        { $match: { collectedBy: new Types.ObjectId(userId), transactionDate: { $gte: yesterdayStart, $lte: yesterdayEnd }, status: 'verified' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const myCollectionYesterday = collectionYesterdayResult[0]?.total || 0;

    // 9. Unpaid Students (For Staff Dashboard)
    // Using current year as default range for unpaid calculation
    const currentYearStart = startOfMonth(new Date(new Date().getFullYear(), 0, 1));
    const currentMonthEnd = endOfMonth(new Date());
    const monthsForUnpaid = eachMonthOfInterval({ start: currentYearStart, end: currentMonthEnd });
    
    const { unpaidList } = await calculateUnpaidStats(monthsForUnpaid);


    return {
        myCollectionToday,
        myCollectionMonth,
        myCollectionLastMonth,
        myCollectionYesterday,
        myPendingCount,
        studentsAdmittedToday,
        recentTransactions: recentTransactions.map((sale: unknown) => {
            const s = sale as SaleDocExtended;
            return {
                id: s._id.toString(),
                amount: s.amount,
                studentName: s.studentId?.name || 'Unknown',
                contactNumber: s.studentId?.contacts?.mobile?.[0] || 'N/A',
                studentPhoto: s.studentId?.photo,
                status: s.status,
                type: s.feeType,
                month: s.month,
                year: s.year,
                transactionDate: s.transactionDate
            };
        }),
        monthlyCollections,
        globalPendingTrend,
        totalCollected,
        totalPending,
        totalRejected,
        unpaidStudents: unpaidList.sort((a, b) => b.amount - a.amount)
    };
}, ['staff-dashboard-stats'], { revalidate: 300, tags: ['dashboard'] })
