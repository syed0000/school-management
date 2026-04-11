"use server"

import dbConnect from "@/lib/db"
import FeeTransaction from "@/models/FeeTransaction"
import Student from "@/models/Student"
import ClassFee from "@/models/ClassFee"
import { getSchoolDateBoundaries } from "@/lib/tz-utils"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import logger from "@/lib/logger"
import { demoWriteSuccess, isDemoSession } from "@/lib/demo-guard"
import { unstable_cache } from "next/cache"
import { withConcurrencyLimit } from "@/lib/backpressure"
import { getEnvInt } from "@/lib/env"

interface TransactionFilter {
  startDate?: Date | string
  endDate?: Date | string
  classId?: string
  studentId?: string
  feeType?: string
  status?: string
  searchQuery?: string
  month?: number
  year?: number
}

const TXN_LIST_CONCURRENCY = getEnvInt("TXN_LIST_CONCURRENCY", 10)
const TXN_STATS_CACHE_SECONDS = getEnvInt("TXN_STATS_CACHE_SECONDS", 60)

export async function getFeeTransactions(filter: TransactionFilter, page: number = 1, limit: number = 20) {
  return withConcurrencyLimit("list:fee-transactions", TXN_LIST_CONCURRENCY, async () => {
    await dbConnect()

  const query: Record<string, unknown> = {}

  if (filter.startDate && filter.endDate) {
    const { startUtc } = await getSchoolDateBoundaries(filter.startDate)
    const { endUtc: finalEndUtc } = await getSchoolDateBoundaries(filter.endDate)
    query.transactionDate = {
      $gte: startUtc,
      $lte: finalEndUtc
    }
  }

  if (filter.feeType && filter.feeType !== 'all') {
    query.feeType = filter.feeType
  }

  if (filter.status && filter.status !== 'all') {
    query.status = filter.status
  }

  if (filter.month && filter.month > 0) {
    query.month = filter.month
  }

  if (filter.year && filter.year > 0) {
    query.year = filter.year
  }

  if (filter.studentId) {
    query.studentId = filter.studentId
  }

  let studentIds: string[] | undefined

  if (filter.classId && filter.classId !== 'all') {
    const students = await Student.find({ classId: filter.classId }).select('_id')
    studentIds = students.map(s => s._id.toString())
    query.studentId = { $in: studentIds }
  }

  if (filter.searchQuery) {
    const students = await Student.find({
      $or: [
        { name: { $regex: filter.searchQuery, $options: 'i' } },
        { registrationNumber: { $regex: filter.searchQuery, $options: 'i' } }
      ]
    }).select('_id')
    
    const searchStudentIds = students.map(s => s._id.toString())
    
    if (studentIds) {
      query.studentId = { $in: studentIds.filter(id => searchStudentIds.includes(id)) }
    } else {
      query.studentId = { $in: searchStudentIds }
    }
  }

  const skip = (page - 1) * limit

  interface TransactionDoc {
    _id: { toString: () => string }
    receiptNumber: string
    studentId?: {
      name: string
      registrationNumber: string
      section?: string
      photo?: string
      classId?: {
        name: string
      }
    }
    feeType: string
    month?: number
    year: number
    examType?: string
    amount: number
    status: string
    transactionDate: Date
    collectedBy?: {
      name: string
    }
    remarks?: string
  }

  const [transactions, total] = await Promise.all([
    FeeTransaction.find(query)
      .populate({
        path: 'studentId',
        select: 'name registrationNumber photo classId section',
        options: { lean: true },
        populate: {
          path: 'classId',
          select: 'name',
          options: { lean: true },
        }
      })
      .populate({ path: 'collectedBy', select: 'name', options: { lean: true } })
      .sort({ transactionDate: -1 })
      //.skip(skip) // Skip/Limit on raw documents won't work well with grouping if we want to page by receipts.
      // But if we return all transactions and group on client, we fetch too much.
      // If we group here, we need to adjust skip/limit.
      // For now, let's keep page based on transactions, but user asked about reprinting "multiple transactions receipt".
      // The current UI allows selecting multiple transactions.
      // So if the user selects all parts of a split receipt, they can reprint.
      // But ideally, the list should show one entry per receipt if they were collected together.
      // However, the request was "allow multiple type of fees collection in single receipt".
      // And now "will the user be able to re print multiple transacitons receipt".
      // The current logic in TransactionContent.tsx `handlePrint` handles grouping selected transactions.
      // So YES, they can reprint if they select the rows.
      // But finding them might be hard if they are scattered?
      // No, they are inserted together so they should be adjacent in date sort.
      .skip(skip)
      .limit(limit)
      .lean(),
    FeeTransaction.countDocuments(query)
  ])

  const totalPages = Math.ceil(total / limit)

  return {
    transactions: transactions.map((t: unknown) => {
      const tx = t as TransactionDoc;
      return {
        id: tx._id.toString(),
        receiptNumber: tx.receiptNumber,
        studentName: tx.studentId?.name || 'Unknown',
        studentRegNo: tx.studentId?.registrationNumber || 'N/A',
        studentPhoto: tx.studentId?.photo,
        className: tx.studentId?.classId?.name || 'Unknown',
        section: tx.studentId?.section || 'A',
        feeType: tx.feeType,
        month: tx.month,
        year: tx.year,
        examType: tx.examType,
        amount: tx.amount,
        status: tx.status,
        transactionDate: tx.transactionDate,
        collectedBy: tx.collectedBy?.name || 'System',
        remarks: tx.remarks
      };
    }),
    pagination: {
      currentPage: page,
      totalPages,
      totalRecords: total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  }
  })
}

async function getTransactionStatsImpl(filter: TransactionFilter) {
  await dbConnect()

  const query: Record<string, unknown> = {}

  if (filter.startDate && filter.endDate) {
    const { startUtc } = await getSchoolDateBoundaries(filter.startDate)
    const { endUtc: finalEndUtc } = await getSchoolDateBoundaries(filter.endDate)
    query.transactionDate = {
      $gte: startUtc,
      $lte: finalEndUtc
    }
  }

  if (filter.classId && filter.classId !== 'all') {
    const studentIds = await Student.distinct('_id', { classId: filter.classId })
    query.studentId = { $in: studentIds }
  }

  const stats = await FeeTransaction.aggregate([
    { $match: query },
    { $group: { _id: "$status", total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]) as Array<{ _id: string; total?: number; count?: number }>

  const statByStatus = new Map(stats.map((s) => [s._id, s]))
  const verified = statByStatus.get('verified')
  const pending = statByStatus.get('pending')
  const rejected = statByStatus.get('rejected')

  return {
    verified: {
      amount: verified?.total || 0,
      count: verified?.count || 0
    },
    pending: {
      amount: pending?.total || 0,
      count: pending?.count || 0
    },
    rejected: {
      amount: rejected?.total || 0,
      count: rejected?.count || 0
    }
  }
}

export const getTransactionStats =
  TXN_STATS_CACHE_SECONDS > 0
    ? unstable_cache(
        async (filter: TransactionFilter) => getTransactionStatsImpl(filter),
        ["fee-transaction-stats"],
        { revalidate: TXN_STATS_CACHE_SECONDS, tags: ["reports", "fee-transaction-stats"] },
      )
    : async (filter: TransactionFilter) => getTransactionStatsImpl(filter)

export async function deleteFeeTransaction(transactionId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return { success: false, error: "Unauthorized" }
    }
    if (isDemoSession(session)) return demoWriteSuccess();

    await dbConnect()

    const transaction = await FeeTransaction.findByIdAndDelete(transactionId)

    if (!transaction) {
      return { success: false, error: "Transaction not found" }
    }

    revalidatePath('/fees/transactions')
    return { success: true }
  } catch (error: unknown) {
    logger.error(error, "Error deleting transaction")
    return { success: false, error: "Failed to delete transaction" }
  }
}

type EntryFeeType = 'admissionFees' | 'registrationFees'

interface FeeConflictPreviewItem {
  transactionId: string
  receiptNumber: string
  studentName: string
  studentRegNo: string
  className: string
  year: number
  amount: number
  admissionFee: number
  registrationFee: number
  transactionDate: Date
  currentFeeType: string
}

function appendRemark(existing: string | undefined, toAppend: string) {
  const base = (existing || "").trim()
  if (!base) return toAppend
  return `${base} | ${toAppend}`
}

export async function scanAdmissionRegistrationConflicts(options?: { limit?: number }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return { success: false, error: "Unauthorized" }
    }
    if (isDemoSession(session)) {
      return demoWriteSuccess({ conflicts: [], scanned: 0, matched: 0 })
    }

    const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000)

    await dbConnect()

    type ClassFeeDoc = { classId: unknown; type: EntryFeeType; amount: number; effectiveFrom: Date }
    const classFees = await ClassFee.find({
      isActive: true,
      type: { $in: ['admissionFees', 'registrationFees'] },
    }).sort({ effectiveFrom: -1 }).lean() as unknown as ClassFeeDoc[]

    const feeMap = new Map<string, { admissionFee?: number; registrationFee?: number }>()
    for (const f of classFees) {
      const classId = String(f.classId)
      const entry = feeMap.get(classId) || {}
      if (f.type === 'admissionFees' && entry.admissionFee === undefined) {
        entry.admissionFee = f.amount
      }
      if (f.type === 'registrationFees' && entry.registrationFee === undefined) {
        entry.registrationFee = f.amount
      }
      feeMap.set(classId, entry)
    }

    interface TxDoc {
      _id: { toString(): string }
      receiptNumber: string
      feeType: string
      amount: number
      year: number
      status: string
      transactionDate: Date
      studentId?: { name: string; registrationNumber: string; classId?: { _id: unknown; name: string } }
    }

    const scannedTxns = await FeeTransaction.find({
      feeType: 'admissionFees',
      status: { $ne: 'rejected' },
    })
      .sort({ transactionDate: -1 })
      .limit(limit)
      .populate({
        path: 'studentId',
        select: 'name registrationNumber classId',
        populate: { path: 'classId', select: 'name' },
      })
      .lean() as unknown as TxDoc[]

    const conflicts: FeeConflictPreviewItem[] = []
    for (const tx of scannedTxns) {
      const classObj = tx.studentId?.classId as unknown as { _id: unknown; name: string } | undefined
      const classId = classObj?._id ? String(classObj._id) : ""
      const fee = classId ? feeMap.get(classId) : undefined
      const admissionFee = fee?.admissionFee ?? 0
      const registrationFee = fee?.registrationFee ?? 0

      if (admissionFee > 0 && registrationFee > 0 && tx.amount < admissionFee && tx.amount <= registrationFee) {
        conflicts.push({
          transactionId: tx._id.toString(),
          receiptNumber: tx.receiptNumber,
          studentName: tx.studentId?.name || "Unknown",
          studentRegNo: tx.studentId?.registrationNumber || "N/A",
          className: classObj?.name || "Unknown",
          year: tx.year,
          amount: tx.amount,
          admissionFee,
          registrationFee,
          transactionDate: tx.transactionDate,
          currentFeeType: tx.feeType,
        })
      }
    }

    return { success: true, conflicts, scanned: scannedTxns.length, matched: conflicts.length }
  } catch (error: unknown) {
    logger.error(error, "Error scanning admission/registration conflicts")
    return { success: false, error: "Failed to scan conflicts" }
  }
}

export async function reclassifyAdmissionConflictsToRegistration(transactionIds: string[]) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return { success: false, error: "Unauthorized" }
    }
    if (isDemoSession(session)) {
      return demoWriteSuccess({ updated: 0, skipped: 0 })
    }

    await dbConnect()

    const ids = Array.isArray(transactionIds) ? transactionIds.filter(Boolean) : []
    if (ids.length === 0) return { success: false, error: "No transactions selected" }
    if (ids.length > 5000) return { success: false, error: "Too many transactions selected" }

    type ClassFeeDoc = { classId: unknown; type: EntryFeeType; amount: number; effectiveFrom: Date }
    const classFees = await ClassFee.find({
      isActive: true,
      type: { $in: ['admissionFees', 'registrationFees'] },
    }).sort({ effectiveFrom: -1 }).lean() as unknown as ClassFeeDoc[]

    const feeMap = new Map<string, { admissionFee?: number; registrationFee?: number }>()
    for (const f of classFees) {
      const classId = String(f.classId)
      const entry = feeMap.get(classId) || {}
      if (f.type === 'admissionFees' && entry.admissionFee === undefined) {
        entry.admissionFee = f.amount
      }
      if (f.type === 'registrationFees' && entry.registrationFee === undefined) {
        entry.registrationFee = f.amount
      }
      feeMap.set(classId, entry)
    }

    interface TxDoc {
      _id: { toString(): string }
      feeType: string
      amount: number
      status: string
      remarks?: string
      studentId?: { classId?: { _id: unknown } }
    }

    const txns = await FeeTransaction.find({
      _id: { $in: ids },
      feeType: 'admissionFees',
      status: { $ne: 'rejected' },
    })
      .populate({ path: 'studentId', select: 'classId', populate: { path: 'classId', select: '_id' } })
      .lean() as unknown as TxDoc[]

    const nowIso = new Date().toISOString()
    const adminLabel = session.user.name ? `${session.user.name}` : `${session.user.id}`
    const remarkSuffix = `Reclassified to registrationFees by ${adminLabel} on ${nowIso}`

    let updated = 0
    let skipped = 0

    for (const tx of txns) {
      const classObj = tx.studentId?.classId as unknown as { _id: unknown } | undefined
      const classId = classObj?._id ? String(classObj._id) : ""
      const fee = classId ? feeMap.get(classId) : undefined
      const admissionFee = fee?.admissionFee ?? 0
      const registrationFee = fee?.registrationFee ?? 0

      if (!(admissionFee > 0 && registrationFee > 0 && tx.amount < admissionFee && tx.amount <= registrationFee)) {
        skipped++
        continue
      }

      const newRemarks = appendRemark(tx.remarks, remarkSuffix)
      await FeeTransaction.updateOne(
        { _id: tx._id },
        { $set: { feeType: 'registrationFees', remarks: newRemarks } },
      )
      updated++
    }

    revalidatePath('/fees/transactions')
    revalidatePath('/parent/fees')

    return { success: true, updated, skipped }
  } catch (error: unknown) {
    logger.error(error, "Error reclassifying admission conflicts to registration")
    return { success: false, error: "Failed to reclassify conflicts" }
  }
}

export async function normalizeLegacyEntryFeeTypes() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return { success: false, error: "Unauthorized" }
    }
    if (isDemoSession(session)) {
      return demoWriteSuccess({ updatedFeeTransactions: 0, updatedClassFees: 0 })
    }

    await dbConnect()

    const [txAdmission, txRegistration, feeAdmission, feeRegistration] = await Promise.all([
      FeeTransaction.updateMany({ feeType: 'admission' }, { $set: { feeType: 'admissionFees' } }),
      FeeTransaction.updateMany({ feeType: 'registration' }, { $set: { feeType: 'registrationFees' } }),
      ClassFee.updateMany({ type: 'admission' }, { $set: { type: 'admissionFees' } }),
      ClassFee.updateMany({ type: 'registration' }, { $set: { type: 'registrationFees' } }),
    ])

    revalidatePath('/fees/collect')
    revalidatePath('/fees/transactions')
    revalidatePath('/fees/unpaid')
    revalidatePath('/admin/classes')
    revalidatePath('/admin/dashboard')
    revalidatePath('/parent/fees')

    return {
      success: true,
      updatedFeeTransactions:
        (txAdmission.modifiedCount || 0) + (txRegistration.modifiedCount || 0),
      updatedClassFees: (feeAdmission.modifiedCount || 0) + (feeRegistration.modifiedCount || 0),
    }
  } catch (error: unknown) {
    logger.error(error, "Error normalizing legacy entry fee types")
    return { success: false, error: "Failed to normalize fee types" }
  }
}
