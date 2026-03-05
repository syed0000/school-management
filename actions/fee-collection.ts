"use server"

import dbConnect from "@/lib/db"
import FeeTransaction from "@/models/FeeTransaction"
import ClassFee from "@/models/ClassFee"
import Student from "@/models/Student"
import Class from "@/models/Class"
import Counter from "@/models/Counter"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const collectFeeSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  feeType: z.string().min(1, "Fee type is required"), // Changed from enum to string to support dynamic types
  amount: z.number().min(1, "Amount must be positive"),
  months: z.array(z.number()).optional(),
  year: z.number().min(2000),
  examType: z.string().optional(),
  title: z.string().optional(),
  remarks: z.string().optional(),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fee = f as any;
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

export async function collectFee(data: z.infer<typeof collectFeeSchema>, userId: string) {
  try {
    collectFeeSchema.parse(data);
    await dbConnect();

    // Use current session logic if needed, but here we rely on provided year
    const monthsToProcess = data.months ? data.months : []; // Removed +1 because month index from UI is 0-11

    // Server-side validation: Ensure total amount equals months * monthly-fee
    if (data.feeType === 'monthly' && monthsToProcess.length > 0) {
      const student = await Student.findById(data.studentId).select('classId');
      if (student) {
        const classFee = await ClassFee.findOne({
          classId: student.classId,
          type: 'monthly',
          isActive: true
        });

        if (classFee) {
          const expectedTotal = classFee.amount * monthsToProcess.length;
          // Allow for small floating point differences if any, though likely integers
          if (Math.abs(data.amount - expectedTotal) > 0.1) {
            return {
              success: false,
              error: `Invalid amount. Expected ₹${expectedTotal} for ${monthsToProcess.length} months, but got ₹${data.amount}.`
            };
          }
        }
      }
    }

    // Check for existing payments based on fee type
    if (data.feeType === 'monthly' && monthsToProcess.length > 0) {
      for (const m of monthsToProcess) {
        // Month index 0 = Jan? Or 0 = April? 
        // Standard JS Date: 0=Jan. UI sends 0=Jan usually.
        // But our Academic Session logic might differ.
        // Let's stick to Calendar Month (1=Jan, 12=Dec) for DB storage to be safe and consistent.
        // UI sends 0-11 index.
        const dbMonth = m + 1; // 1-12

        const existing = await FeeTransaction.findOne({
          studentId: data.studentId,
          feeType: 'monthly',
          month: dbMonth,
          year: data.year,
          status: { $ne: 'rejected' }
        });

        if (existing) {
          return {
            success: false,
            error: `Fee for month ${dbMonth}/${data.year} already paid/pending.`
          };
        }
      }
    } else if (data.feeType === 'examination') {
      const existing = await FeeTransaction.findOne({
        studentId: data.studentId,
        feeType: 'examination',
        // Match specific exam type (title)
        examType: data.examType,
        year: data.year,
        status: { $ne: 'rejected' }
      });
      if (existing) {
        return { success: false, error: `Fee for ${data.examType} ${data.year} already paid/pending.` };
      }
    } else if (['admission', 'admissionFees', 'registrationFees'].includes(data.feeType)) {
      // One-time fees per year or once per admission?
      // Usually admission is once, registration is annual.
      // Assuming annual checks for now based on 'year' field.
      const existing = await FeeTransaction.findOne({
        studentId: data.studentId,
        feeType: data.feeType,
        year: data.year,
        status: { $ne: 'rejected' }
      });
      if (existing) {
        return { success: false, error: `${data.feeType} for ${data.year} already paid/pending.` };
      }
    }

    // Process payment
    if (data.feeType === 'monthly' && monthsToProcess.length > 0) {
      const amountPerMonth = data.amount / monthsToProcess.length;
      const student = await Student.findById(data.studentId).populate('classId', 'name').lean();

      const baseReceiptNumber = await generateReceiptNumber();

      // Create a transaction for each month
      for (const m of monthsToProcess) {
        const dbMonth = m + 1;
        const receiptNumber = `${dbMonth}-${baseReceiptNumber}`;

        await FeeTransaction.create({
          receiptNumber,
          studentId: data.studentId,
          feeType: 'monthly',
          amount: amountPerMonth,
          month: dbMonth,
          year: data.year,
          remarks: data.remarks,
          collectedBy: userId,
          // Let's stick to 'verified' to simplify flow if collected by admin/staff directly.
          // Previous code had 'pending'. Let's check... it was 'pending'.
          // But dashboard stats rely on 'verified' for "collected".
          // If we set 'pending', it shows in "Pending Fees" not "Collected".
          // Usually "Fee Collection" form implies money received. So it should be 'verified'.
          // Let's change to 'verified' for immediate reflection in revenue.
          status: 'verified',
          transactionDate: new Date(),
        });
      }

      revalidatePath("/fees/collect");
      return {
        success: true,
        receiptNumber: baseReceiptNumber, // Group receipt number
        // Returning a generic receipt number for the batch
        receiptData: {
          studentName: student?.name || '',
          studentRegNo: student?.registrationNumber || '',
          className: student?.classId?.name || '',
          feeType: data.feeType,
          months: monthsToProcess.map(m => m + 1),
          year: data.year,
          amount: data.amount,
          title: data.title,
          examType: data.examType,
          date: new Date()
        }
      };

    } else {
      // Single transaction
      const receiptNumber = await generateReceiptNumber();
      const student = await Student.findById(data.studentId).populate('classId', 'name').lean();

      await FeeTransaction.create({
        receiptNumber,
        studentId: data.studentId,
        feeType: data.feeType,
        amount: data.amount,
        month: undefined,
        year: data.year,
        examType: data.examType, // Store exam name here
        remarks: data.remarks,
        collectedBy: userId,
        status: 'verified', // Changed to verified
        transactionDate: new Date(),
        title: data.title // Store custom title for 'other' or specific fees
      });

      revalidatePath("/fees/collect");
      return {
        success: true,
        receiptNumber,
        receiptData: {
          studentName: student?.name || '',
          studentRegNo: student?.registrationNumber || '',
          className: student?.classId?.name || '',
          feeType: data.feeType,
          year: data.year,
          examType: data.examType,
          title: data.title,
          amount: data.amount,
          date: new Date()
        }
      };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}
