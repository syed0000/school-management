"use server"

import dbConnect from "@/lib/db"
import FeeTransaction from "@/models/FeeTransaction"
import ClassFee from "@/models/ClassFee"
import Student from "@/models/Student"
import Class from "@/models/Class"
import Counter from "@/models/Counter"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { whatsappConfig } from "@/lib/whatsapp-config"
import { format } from "date-fns"
import { getYearForMonth } from "@/lib/utils"

const feeItemSchema = z.object({
  feeType: z.string().min(1, "Fee type is required"),
  amount: z.number().min(0, "Amount must be positive"),
  months: z.array(z.number()).optional(),
  year: z.number().min(2000),
  examType: z.string().optional(),
  title: z.string().optional(),
  remarks: z.string().optional(),
})

const collectFeesSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  fees: z.array(feeItemSchema).min(1, "At least one fee is required"),
})

export async function getStudentFeeDetails(studentId: string) {
  await dbConnect();
  const student = await Student.findById(studentId).populate('classId').lean();
  if (!student) return null;

  // Get current active fees for the class
  const fees = await ClassFee.find({
    classId: student.classId._id,
    isActive: true
  }).lean();

  // Get exam list from class
  const classData = await Class.findById(student.classId._id).lean();

  // Map fees to expected format
  const mappedFees = fees.map((f: unknown) => {
    // Define an interface for the fee object from database
    interface DBFee {
        type: string;
        amount: number;
        _id: { toString(): string };
        title?: string;
        month?: number;
    }
    const fee = f as DBFee;
    return {
      type: fee.type,
      amount: fee.amount,
      id: fee._id.toString(),
      // Include title and month for examination fees
      ...(fee.type === 'examination' ? {
        title: fee.title,
        month: fee.month
      } : {})
    };
  });

  return {
    classId: student.classId._id.toString(),
    className: student.classId.name,
    exams: classData.exams || [],
    fees: mappedFees
  };
}

// Helper function to generate sequential receipt number
async function generateReceiptNumber(): Promise<string> {
  // Ensure counter exists
  const counter = await Counter.findById('receiptNumber');
  if (!counter) {
    try {
      // Initialize with 1200 so the first increment gives 1201
      await Counter.create({ _id: 'receiptNumber', seq: 1200 });
    } catch (error) {
      console.error("Error initializing receipt number counter:", error);
      // Ignore duplicate key error in case of race condition
    }
  }

  // Increment and get next
  let updatedCounter = await Counter.findByIdAndUpdate(
    'receiptNumber',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  let receiptNo = String(updatedCounter.seq);

  // Collision check: Check if receiptNo exists as exact match or prefix (for monthly fees like 1201-1)
  let attempts = 0;
  while (attempts < 5) {
    const exists = await FeeTransaction.findOne({
      receiptNumber: { $regex: new RegExp(`^${receiptNo}(-|$)`) }
    });

    if (!exists) break;

    // Collision found, increment again
    updatedCounter = await Counter.findByIdAndUpdate(
      'receiptNumber',
      { $inc: { seq: 1 } },
      { new: true }
    );
    receiptNo = String(updatedCounter.seq);
    attempts++;
  }

  if (attempts >= 5) {
    throw new Error("Failed to generate unique receipt number after multiple attempts");
  }

  return receiptNo;
}

interface TransactionDoc {
    receiptNumber: string;
    studentId: string;
    feeType: string;
    amount: number;
    month?: number;
    year: number;
    remarks?: string;
    collectedBy: string;
    status: string;
    transactionDate: Date;
    examType?: string;
    title?: string;
}

export async function collectFees(data: z.infer<typeof collectFeesSchema>, userId: string) {
  try {
    collectFeesSchema.parse(data);
    await dbConnect();

    const student = await Student.findById(data.studentId).populate('classId', 'name').lean();
    if (!student) throw new Error("Student not found");

    const baseReceiptNumber = await generateReceiptNumber();
    let totalAmount = 0;
    const transactionDocs: TransactionDoc[] = [];

    // Process each fee item
    for (let i = 0; i < data.fees.length; i++) {
      const feeItem = data.fees[i];
      totalAmount += feeItem.amount;

      // Validation logic for monthly fees
      const monthsToProcess = feeItem.months ? feeItem.months : [];
      if (feeItem.feeType === 'monthly' && monthsToProcess.length > 0) {
        // Validate duplicates
        for (const m of monthsToProcess) {
          const dbMonth = m + 1;
          const actualYear = getYearForMonth(m, feeItem.year);
          const existing = await FeeTransaction.findOne({
            studentId: data.studentId,
            feeType: 'monthly',
            month: dbMonth,
            year: actualYear,
            status: { $ne: 'rejected' }
          });
          if (existing) {
             return { success: false, error: `Fee for month ${dbMonth}/${actualYear} already paid/pending.` };
          }
        }
        
        // Create transactions per month
        const amountPerMonth = feeItem.amount / monthsToProcess.length;
        for (const m of monthsToProcess) {
            const dbMonth = m + 1;
            const actualYear = getYearForMonth(m, feeItem.year);
            // Use unique suffix for each transaction part of this receipt
            const uniqueSuffix = transactionDocs.length + 1;
            const receiptNumber = `${baseReceiptNumber}-${uniqueSuffix}`;
            
            transactionDocs.push({
                receiptNumber,
                studentId: data.studentId,
                feeType: 'monthly',
                amount: amountPerMonth,
                month: dbMonth,
                year: actualYear,
                remarks: feeItem.remarks,
                collectedBy: userId,
                status: 'verified',
                transactionDate: new Date(),
            });
        }
      } else {
        // Other fees
        // Check duplicates
        if (feeItem.feeType === 'examination') {
             const existing = await FeeTransaction.findOne({
                studentId: data.studentId,
                feeType: 'examination',
                examType: feeItem.examType,
                year: feeItem.year,
                status: { $ne: 'rejected' }
              });
              if (existing) return { success: false, error: `Fee for ${feeItem.examType} ${feeItem.year} already paid/pending.` };
        } else if (['admission', 'admissionFees', 'registrationFees'].includes(feeItem.feeType)) {
             const existing = await FeeTransaction.findOne({
                studentId: data.studentId,
                feeType: feeItem.feeType,
                year: feeItem.year,
                status: { $ne: 'rejected' }
              });
              if (existing) return { success: false, error: `${feeItem.feeType} for ${feeItem.year} already paid/pending.` };
        }

        const uniqueSuffix = transactionDocs.length + 1;
        const receiptNumber = `${baseReceiptNumber}-${uniqueSuffix}`;

        transactionDocs.push({
            receiptNumber,
            studentId: data.studentId,
            feeType: feeItem.feeType,
            amount: feeItem.amount,
            year: feeItem.year,
            examType: feeItem.examType,
            title: feeItem.title,
            remarks: feeItem.remarks,
            collectedBy: userId,
            status: 'verified',
            transactionDate: new Date(),
        });
      }
    }

    // Save all transactions
    await FeeTransaction.insertMany(transactionDocs);

    revalidatePath("/fees/collect");

    // Send WhatsApp Receipt (Consolidated)
    try {
        if (whatsappConfig.enabled && student?.contacts?.mobile?.[0]) {
          const mobile = student.contacts.mobile[0];
          // We can't put all details in URL params efficiently.
          // Just put basic info and total amount.
          const queryParams = new URLSearchParams({
            studentName: student.name,
            studentRegNo: student.registrationNumber || 'N/A',
            rollNumber: student.rollNumber || 'N/A',
            className: student.classId?.name || 'N/A',
            section: student.section || 'A',
            amount: totalAmount.toString(),
            date: new Date().toISOString(),
            // Just indicate multiple
            feeType: 'Multiple Fees',
            year: new Date().getFullYear().toString(),
          });

          const receiptUrl = `${whatsappConfig.appUrl}/api/receipt/image?receiptNumber=${baseReceiptNumber}&${queryParams.toString()}`;
          
          await sendWhatsAppMessage({
            to: mobile,
            userName: student.name,
            campaignName: whatsappConfig.templates.receipt.campaignName,
            params: [
              student.name,
              `₹${totalAmount}`,
              baseReceiptNumber,
              format(new Date(), 'dd MMM yyyy')
            ],
            mediaUrl: receiptUrl,
            mediaFilename: `Receipt-${baseReceiptNumber}.png`
          });
        }
    } catch (error) {
        console.error("Failed to send WhatsApp receipt:", error);
    }

    return {
        success: true,
        receiptNumber: baseReceiptNumber,
    };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}

export async function getReceiptDetails(receiptNumber: string) {
    await dbConnect();

    // Extract base receipt number if it contains a suffix (e.g., 1201-1 -> 1201)
    // Assuming base receipt number is numeric (from counter)
    const baseReceiptNumber = receiptNumber.split('-')[0];

    // Regex to match baseReceiptNumber (exact) or baseReceiptNumber-suffix
    const regex = new RegExp(`^${baseReceiptNumber}(-[0-9]+)?$`);
    
    const transactions = await FeeTransaction.find({ receiptNumber: { $regex: regex } })
        .populate({
            path: 'studentId',
            select: 'name registrationNumber rollNumber classId section',
            populate: { path: 'classId', select: 'name' }
        })
        .lean();

    if (!transactions || transactions.length === 0) {
        return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstTx = transactions[0] as any;
    const student = firstTx.studentId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = transactions.map((t: any) => ({
        feeType: t.feeType,
        amount: t.amount,
        months: t.month ? [t.month] : [],
        year: t.year,
        examType: t.examType,
        title: t.title,
        remarks: t.remarks
    }));

    // Consolidate monthly fees into one item if needed, or keep separate
    // For receipt display, maybe grouping monthly fees by year makes sense?
    // Let's do a simple grouping
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const consolidatedItems: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monthlyGroups: Record<string, any> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items.forEach((item: any) => {
        if (item.feeType === 'monthly') {
            const key = `${item.year}`;
            if (!monthlyGroups[key]) {
                monthlyGroups[key] = {
                    feeType: 'monthly',
                    amount: 0,
                    months: [],
                    year: item.year,
                    remarks: item.remarks // Take first remark?
                };
                consolidatedItems.push(monthlyGroups[key]);
            }
            monthlyGroups[key].amount += item.amount;
            monthlyGroups[key].months.push(...item.months);
        } else {
            consolidatedItems.push(item);
        }
    });

    // Sort months
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.values(monthlyGroups).forEach((group: any) => {
        group.months.sort((a: number, b: number) => a - b);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalAmount = transactions.reduce((sum: number, t: any) => sum + t.amount, 0);

    return {
        receiptNumber: baseReceiptNumber,
        studentName: student?.name || 'Unknown',
        studentRegNo: student?.registrationNumber || 'N/A',
        rollNumber: student?.rollNumber || 'N/A',
        className: student?.classId?.name || 'N/A',
        section: student?.section || 'A',
        date: firstTx.transactionDate,
        items: consolidatedItems,
        totalAmount
    };
}
