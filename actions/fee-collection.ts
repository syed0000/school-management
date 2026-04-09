"use server"

import dbConnect from "@/lib/db"
import FeeTransaction from "@/models/FeeTransaction"
import ClassFee from "@/models/ClassFee"
import Student from "@/models/Student"
import Class from "@/models/Class"
import Counter from "@/models/Counter"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getYearForMonth } from "@/lib/utils"
import User from "@/models/User"
import { sendWhatsAppReceipt } from "@/lib/whatsapp-receipt"
import { sendAppNotification } from "./notification"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { demoWriteSuccess, isDemoSession } from "@/lib/demo-guard"
import { normalizeFeeType } from "@/lib/fee-type"
import { coerceBoolean } from "@/lib/setting-coerce"

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
  transactionDate: z.string().optional(),
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
      type: normalizeFeeType(fee.type),
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
    const session = await getServerSession(authOptions);
    const isDemo = isDemoSession(session);
    await dbConnect();

    const student = await Student.findById(data.studentId).populate('classId', 'name').lean();
    if (!student) throw new Error("Student not found");

    const submissionDate = data.transactionDate ? new Date(data.transactionDate) : new Date();

    const submissionUser = await User.findById(userId).lean();
    const isActuallyAdmin = submissionUser?.role === 'admin';
    const initialStatus = isActuallyAdmin ? 'verified' : 'pending';

    const baseReceiptNumber = isDemo ? `DEMO-${Date.now()}` : await generateReceiptNumber();
    let totalAmount = 0;
    const transactionDocs: TransactionDoc[] = [];

    // Process each fee item
    for (let i = 0; i < data.fees.length; i++) {
      const feeItem = data.fees[i];
      const normalizedFeeType = normalizeFeeType(feeItem.feeType);
      totalAmount += feeItem.amount;

      // Validation logic for monthly fees
      const monthsToProcess = feeItem.months ? feeItem.months : [];
      if (normalizedFeeType === 'monthly' && monthsToProcess.length > 0) {
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

          // Check if it's April and covered by Admission/Registration
          if (dbMonth === 4) {
            const [admSetting, regSetting] = await Promise.all([
              import('@/models/Setting').then(m => m.default.findOne({ key: "admission_fee_includes_april" }).lean()),
              import('@/models/Setting').then(m => m.default.findOne({ key: "registration_fee_includes_april" }).lean())
            ]);
            const admIncludesApril = coerceBoolean((admSetting as { value?: unknown } | null)?.value, true)
            const regIncludesApril = coerceBoolean((regSetting as { value?: unknown } | null)?.value, true)

            if (admIncludesApril || regIncludesApril) {
              const paidAdm = await FeeTransaction.findOne({
                studentId: data.studentId,
                feeType: 'admissionFees',
                year: actualYear,
                status: { $ne: 'rejected' }
              });
              const paidReg = await FeeTransaction.findOne({
                studentId: data.studentId,
                feeType: 'registrationFees',
                year: actualYear,
                status: { $ne: 'rejected' }
              });

              if ((admIncludesApril && paidAdm) || (regIncludesApril && paidReg)) {
                return {
                  success: false,
                  error: `April ${actualYear} fee is already included in ${paidAdm ? 'Admission' : 'Registration'} fee payment.`
                };
              }
            }
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
            status: initialStatus,
            transactionDate: submissionDate,
          });
        }
      } else {
        // Other fees
        // Check duplicates
        if (normalizedFeeType === 'examination') {
          const existing = await FeeTransaction.findOne({
            studentId: data.studentId,
            feeType: 'examination',
            examType: feeItem.examType,
            year: feeItem.year,
            status: { $ne: 'rejected' }
          });
          if (existing) return { success: false, error: `Fee for ${feeItem.examType} ${feeItem.year} already paid/pending.` };
        } else if (['admissionFees', 'registrationFees'].includes(normalizedFeeType)) {
          const existing = await FeeTransaction.findOne({
            studentId: data.studentId,
            feeType: normalizedFeeType,
            year: feeItem.year,
            status: { $ne: 'rejected' }
          });
          if (existing) return { success: false, error: `${normalizedFeeType} for ${feeItem.year} already paid/pending.` };
        }

        const uniqueSuffix = transactionDocs.length + 1;
        const receiptNumber = `${baseReceiptNumber}-${uniqueSuffix}`;

        transactionDocs.push({
          receiptNumber,
          studentId: data.studentId,
          feeType: normalizedFeeType,
          amount: feeItem.amount,
          year: feeItem.year,
          examType: feeItem.examType,
          title: feeItem.title,
          remarks: feeItem.remarks,
          collectedBy: userId,
          status: initialStatus,
          transactionDate: submissionDate,
        });
      }
    }

    if (!isDemo) {
      await FeeTransaction.insertMany(transactionDocs);
    }

    revalidatePath("/fees/collect");

    try {
      if (!isDemo && initialStatus === 'verified') {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const getSessionRank = (m: number) => (m - 3 + 12) % 12; // April (3) becomes rank 0

        const uniqueMonths = Array.from(new Set(
          data.fees
            .filter(f => f.feeType === 'monthly' && f.months)
            .flatMap(f => f.months!)
        )).sort((a, b) => getSessionRank(a) - getSessionRank(b));

        const otherTypes = Array.from(new Set(
          data.fees
            .filter(f => f.feeType !== 'monthly')
            .map(f => {
              const ft = normalizeFeeType(f.feeType)
              if (ft === 'examination' && f.examType) return `${f.examType} Exam`;
              if (ft === 'admissionFees') return "Admission";
              if (ft === 'registrationFees') return "Registration";
              if (ft === 'annual' || ft === 'annualFees') return "Annual";
              return ft.charAt(0).toUpperCase() + ft.slice(1);
            })
        ));

        const monthsStr = [
          ...uniqueMonths.map(m => monthNames[m]),
          ...otherTypes
        ].join(", ") || "Current";

        const remarksStr = data.fees.map(f => f.remarks).filter(Boolean).join(" | ");

        await sendWhatsAppReceipt({
          student,
          totalAmount,
          receiptNumber: baseReceiptNumber,
          monthsStr,
          transactionDate: submissionDate,
          remarks: remarksStr
        });
      }

      // Always trigger in-app push notification if verified, independent of WhatsApp setting
      if (!isDemo && initialStatus === 'verified') {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const getSessionRank = (m: number) => (m - 3 + 12) % 12;

        const uniqueMonths = Array.from(new Set(
          data.fees
            .filter(f => f.feeType === 'monthly' && f.months)
            .flatMap(f => f.months!)
        )).sort((a, b) => getSessionRank(a) - getSessionRank(b));

        const otherTypes = Array.from(new Set(
          data.fees
            .filter(f => f.feeType !== 'monthly')
            .map(f => {
              const ft = normalizeFeeType(f.feeType)
              if (ft === 'examination' && f.examType) return `${f.examType} Exam`;
              if (ft === 'admissionFees') return "Admission";
              if (ft === 'registrationFees') return "Registration";
              if (ft === 'annual' || ft === 'annualFees') return "Annual";
              return ft.charAt(0).toUpperCase() + ft.slice(1);
            })
        ));

        const monthsStr = [
          ...uniqueMonths.map(m => monthNames[m]),
          ...otherTypes
        ].join(", ") || "Current";

        await sendAppNotification({
          title: "Fee Payment Received",
          body: `A payment of ₹${totalAmount} (Receipt: #${baseReceiptNumber}) has been successful for ${student.name}. Fees for: ${monthsStr}`,
          targetStudentIds: [data.studentId]
        });
      }
    } catch (error) {
      console.error("Failed to trigger WhatsApp receipt helper:", error);
    }

    return {
      success: true,
      receiptNumber: baseReceiptNumber,
      ...(isDemo
        ? demoWriteSuccess({
            demoReceipt: {
              receiptNumber: baseReceiptNumber,
              studentName: (student as { name?: string })?.name || "Unknown",
              studentRegNo: (student as { registrationNumber?: string })?.registrationNumber || "N/A",
              rollNumber: (student as { rollNumber?: string })?.rollNumber || "N/A",
              className: (student as { classId?: { name?: string } })?.classId?.name || "N/A",
              section: (student as { section?: string })?.section || "A",
              date: submissionDate,
              totalAmount,
              items: data.fees.map((f: { feeType: string; amount: number; months?: number[]; year?: number; examType?: string; title?: string; remarks?: string }) => ({
                feeType: f.feeType,
                amount: f.amount,
                months: Array.isArray(f.months) ? f.months.map((m: number) => m + 1) : [],
                year: f.year,
                examType: f.examType,
                title: f.title,
                remarks: f.remarks,
              })),
            },
          })
        : {}),
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
