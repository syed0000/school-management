"use server"

import dbConnect from "@/lib/db"
import FeeTransaction from "@/models/FeeTransaction"
import Student from "@/models/Student"
import { getSchoolDateBoundaries } from "@/lib/tz-utils"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import logger from "@/lib/logger"

interface TransactionFilter {
  startDate?: Date
  endDate?: Date
  classId?: string
  studentId?: string
  feeType?: string
  status?: string
  searchQuery?: string
  month?: number
  year?: number
}

export async function getFeeTransactions(filter: TransactionFilter, page: number = 1, limit: number = 20) {
  await dbConnect()

  const query: Record<string, unknown> = {}

  if (filter.startDate && filter.endDate) {
    const { startUtc, endUtc } = await getSchoolDateBoundaries(filter.startDate)
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
        populate: {
          path: 'classId',
          select: 'name'
        }
      })
      .populate('collectedBy', 'name')
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
}

export async function getTransactionStats(filter: TransactionFilter) {
  await dbConnect()

  const query: Record<string, unknown> = {}

  if (filter.startDate && filter.endDate) {
    const { startUtc, endUtc } = await getSchoolDateBoundaries(filter.startDate)
    const { endUtc: finalEndUtc } = await getSchoolDateBoundaries(filter.endDate)
    query.transactionDate = {
      $gte: startUtc,
      $lte: finalEndUtc
    }
  }

  if (filter.classId && filter.classId !== 'all') {
    const students = await Student.find({ classId: filter.classId }).select('_id')
    query.studentId = { $in: students.map(s => s._id) }
  }

  const [verified, pending, rejected] = await Promise.all([
    FeeTransaction.aggregate([
      { $match: { ...query, status: 'verified' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]),
    FeeTransaction.aggregate([
      { $match: { ...query, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]),
    FeeTransaction.aggregate([
      { $match: { ...query, status: 'rejected' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ])
  ])

  return {
    verified: {
      amount: verified[0]?.total || 0,
      count: verified[0]?.count || 0
    },
    pending: {
      amount: pending[0]?.total || 0,
      count: pending[0]?.count || 0
    },
    rejected: {
      amount: rejected[0]?.total || 0,
      count: rejected[0]?.count || 0
    }
  }
}

export async function deleteFeeTransaction(transactionId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return { success: false, error: "Unauthorized" }
    }

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
