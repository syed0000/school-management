"use server"

import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import ClassFee from "@/models/ClassFee"
import FeeTransaction from "@/models/FeeTransaction"
import Setting from "@/models/Setting"
import { startOfMonth, endOfMonth, eachMonthOfInterval, format } from "date-fns"

interface UnpaidFilter {
    classId?: string
    searchQuery?: string
    startDate?: Date
    endDate?: Date
}

export interface UnpaidStudent {
    id: string;
    name: string;
    registrationNumber: string;
    className: string;
    amount: number;
    details: string[];
    photo?: string;
    contactNumber: string;
}

export async function getUnpaidStudents(filter: UnpaidFilter) {
    await dbConnect()

    // Use provided dates or default to current year
    const end = filter.endDate ? new Date(filter.endDate) : endOfMonth(new Date())
    const start = filter.startDate ? new Date(filter.startDate) : startOfMonth(new Date(new Date().getFullYear(), 0, 1))

    const monthsToCheck = eachMonthOfInterval({ start, end })

    const [admSetting, regSetting] = await Promise.all([
        Setting.findOne({ key: "admission_fee_includes_april" }).lean(),
        Setting.findOne({ key: "registration_fee_includes_april" }).lean()
    ])
    const admIncludesApril = admSetting ? admSetting.value === true : true;
    const regIncludesApril = regSetting ? regSetting.value === true : true;

    const studentQuery: Record<string, unknown> = { isActive: true }
    if (filter.classId && filter.classId !== "all") {
        studentQuery.classId = filter.classId
    }

    interface StudentDoc {
        _id: { toString: () => string };
        name: string;
        registrationNumber: string;
        classId: { _id: { toString: () => string }; name: string };
        admissionDate?: Date;
        createdAt: Date;
        photo?: string;
        contacts?: { mobile?: string[] };
    }

    let allStudents = await Student.find(studentQuery).populate('classId', 'name').lean()

    if (filter.searchQuery) {
        const searchLower = filter.searchQuery.toLowerCase()
        allStudents = allStudents.filter((s: unknown) => {
            const student = s as StudentDoc;
            return student.name.toLowerCase().includes(searchLower) ||
            student.registrationNumber?.toLowerCase().includes(searchLower)
        })
    }

    const activeStudentIds = allStudents.map((s: unknown) => (s as StudentDoc)._id.toString())

    interface FeeConfig {
        classId: { toString: () => string };
        type: string;
        amount: number;
        effectiveFrom?: Date;
    }

    const classFees = await ClassFee.find({ isActive: true }).lean()
    const feeMap = new Map<string, FeeConfig[]>()
    classFees.forEach((fee: unknown) => {
        const f = fee as FeeConfig;
        const cid = f.classId.toString()
        if (!feeMap.has(cid)) feeMap.set(cid, [])
        feeMap.get(cid)?.push(f)
    })

    interface TransactionDoc {
        studentId: { toString: () => string } | string;
        feeType: string;
        year: number;
        month?: number;
    }

    const yearsToCheck = new Set(monthsToCheck.map(m => m.getFullYear()))
    const allTransactions = await FeeTransaction.find({
        status: { $in: ['verified', 'pending'] },
        year: { $in: Array.from(yearsToCheck) },
        studentId: { $in: activeStudentIds }
    }).lean()

    const unpaidList: UnpaidStudent[] = []

    const hasPaidFee = (studentId: string, type: string, month: number | undefined, year: number) => {
        return allTransactions.some((tx: unknown) => {
            const transaction = tx as TransactionDoc;
            const txStudentId = transaction.studentId?.toString() || transaction.studentId
            if (txStudentId !== studentId) return false
            if (transaction.feeType !== type) return false
            if (transaction.year !== year) return false
            if (type === 'monthly') return transaction.month === month
            return true
        })
    }

    for (const s of allStudents) {
        const student = s as StudentDoc;
        const studentFees = feeMap.get(student.classId._id.toString()) || []
        const admissionDate = new Date(student.admissionDate || student.createdAt)
        const admMonth = admissionDate.getMonth() + 1
        const admYear = admissionDate.getFullYear()

        let studentUnpaidAmount = 0
        const studentUnpaidDetails: string[] = []

        const monthlyFeeConfig = studentFees.find(f => f.type === 'monthly')
        if (monthlyFeeConfig) {
            const monthlyAmount = monthlyFeeConfig.amount

            for (const monthDate of monthsToCheck) {
                const m = monthDate.getMonth() + 1
                const y = monthDate.getFullYear()
                const isAfterAdmission = (y > admYear) || (y === admYear && m >= admMonth)

                if (isAfterAdmission) {
                    let isPaid = hasPaidFee(student._id.toString(), 'monthly', m, y);
                    
                    if (m === 4 && !isPaid) {
                        const paidAdm = hasPaidFee(student._id.toString(), 'admission', undefined, y) || hasPaidFee(student._id.toString(), 'admissionFees', undefined, y);
                        const paidReg = hasPaidFee(student._id.toString(), 'registrationFees', undefined, y);
                        
                        if ((admIncludesApril && paidAdm) || (regIncludesApril && paidReg)) {
                            isPaid = true;
                        }
                    }

                    if (!isPaid) {
                        studentUnpaidAmount += monthlyAmount
                        studentUnpaidDetails.push(`${format(monthDate, 'MMM')} ${y}`)
                    }
                }
            }
        }

        const examFeeConfig = studentFees.find(f => f.type === 'examination')
        if (examFeeConfig && examFeeConfig.effectiveFrom) {
            const examDate = new Date(examFeeConfig.effectiveFrom)
            const examMonth = examDate.getMonth() + 1
            const examYear = examDate.getFullYear()

            const isDueInPeriod = monthsToCheck.some(d =>
                d.getMonth() + 1 === examMonth && d.getFullYear() === examYear
            )
            const isStudentEligible = (examYear > admYear) || (examYear === admYear && examMonth >= admMonth)

            if (isDueInPeriod && isStudentEligible) {
                if (!hasPaidFee(student._id.toString(), 'examination', undefined, examYear)) {
                    studentUnpaidAmount += examFeeConfig.amount
                    studentUnpaidDetails.push(`Exam Fee (${format(examDate, 'MMM')})`)
                }
            }
        }

        const isAdmissionInPeriod = monthsToCheck.some(d =>
            d.getMonth() + 1 === admMonth && d.getFullYear() === admYear
        )

        if (isAdmissionInPeriod) {
            const admissionFeeConfig = studentFees.find(f => f.type === 'admission')

            if (admissionFeeConfig) {
                if (!hasPaidFee(student._id.toString(), 'admission', undefined, admYear)) {
                    studentUnpaidAmount += admissionFeeConfig.amount
                    studentUnpaidDetails.push(`Admission Fee`)
                }
            }
        }

        if (studentUnpaidAmount > 0) {
            unpaidList.push({
                id: student._id.toString(),
                name: student.name,
                registrationNumber: student.registrationNumber,
                className: student.classId.name,
                amount: studentUnpaidAmount,
                details: studentUnpaidDetails,
                photo: student.photo,
                contactNumber: student.contacts?.mobile?.[0] || 'N/A'
            })
        }
    }

    return unpaidList.sort((a, b) => b.amount - a.amount)
}
