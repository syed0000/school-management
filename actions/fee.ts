"use server"

import dbConnect from "@/lib/db"
import FeeTransaction from "@/models/FeeTransaction"
// Ensure Student and Class models are registered before populating
import "@/models/Student"
import "@/models/Class"
import { revalidatePath } from "next/cache"
import { sendWhatsAppReceipt } from "@/lib/whatsapp-receipt"
import { sendAppNotification } from "./notification"

export async function getPendingFees() {
  await dbConnect();
  
  const transactionsWithDetails = await FeeTransaction.find({ status: 'pending' })
    .populate({
      path: 'studentId',
      select: 'name registrationNumber classId',
      populate: { path: 'classId', select: 'name' }
    })
    .populate('collectedBy', 'name')
    .sort({ transactionDate: -1 })
    .lean();

  interface TransactionDoc {
      _id: { toString: () => string };
      studentId?: {
          name: string;
          registrationNumber: string;
          classId?: {
              name: string;
          }
      };
      collectedBy?: {
          name: string;
      };
      amount: number;
      feeType: string;
      month?: number;
      year: number;
      transactionDate: Date;
      receiptNumber: string;
  }

  return transactionsWithDetails.map((t: unknown) => {
    const tx = t as TransactionDoc;
    return {
        id: tx._id.toString(),
        studentName: tx.studentId?.name || 'Unknown',
        regNo: tx.studentId?.registrationNumber || 'N/A',
        className: tx.studentId?.classId?.name || 'N/A',
        collectedBy: tx.collectedBy?.name || 'Unknown',
        amount: tx.amount,
        feeType: tx.feeType,
        month: tx.month,
        year: tx.year,
        date: tx.transactionDate,
        receiptNumber: tx.receiptNumber
    };
  });
}

import logger from "@/lib/logger"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { demoWriteSuccess, isDemoSession } from "@/lib/demo-guard"

export async function verifyFee(transactionId: string, action: 'approve' | 'reject') {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user.role !== 'admin') throw new Error('Unauthorized');
    if (isDemoSession(session)) return demoWriteSuccess();

    await dbConnect();
    
    const status = action === 'approve' ? 'verified' : 'rejected';
    
    const updatedTransaction = await FeeTransaction.findByIdAndUpdate(transactionId, {
      status,
      verifiedAt: new Date(),
      verifiedBy: session.user.id
    }, { returnDocument: "after" }).populate({
      path: 'studentId',
      populate: { path: 'classId' }
    }).lean();

    if (action === 'approve' && updatedTransaction) {
      // Trigger WhatsApp Receipt
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      let monthsStr = "Current";
      if (updatedTransaction.feeType === 'monthly' && updatedTransaction.month) {
        monthsStr = monthNames[updatedTransaction.month - 1];
      } else if (updatedTransaction.feeType === 'examination') {
        monthsStr = `${updatedTransaction.examType} Exam`;
      } else {
        monthsStr = updatedTransaction.feeType.charAt(0).toUpperCase() + updatedTransaction.feeType.slice(1);
      }

      await sendWhatsAppReceipt({
        student: updatedTransaction.studentId,
        totalAmount: updatedTransaction.amount,
        receiptNumber: updatedTransaction.receiptNumber,
        monthsStr: monthsStr,
        transactionDate: updatedTransaction.transactionDate
      });
        
      // Trigger in-app push notification upon approval
      await sendAppNotification({
        title: "Fee Payment Approved",
        body: `A payment of ₹${updatedTransaction.amount} (Receipt: #${updatedTransaction.receiptNumber}) for ${updatedTransaction.studentId.name} has been verified & approved.`,
        targetStudentIds: [updatedTransaction.studentId._id.toString()]
      });
    }
    
    revalidatePath("/admin/fees/verify");
    revalidatePath("/admin/dashboard"); // Update stats
    
    return { success: true };
  } catch (error: unknown) {
    logger.error(error, `Failed to verify fee transaction ${transactionId}`);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}
