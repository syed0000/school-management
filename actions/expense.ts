"use server"

import dbConnect from "@/lib/db"
import Expense from "@/models/Expense"
import Teacher from "@/models/Teacher"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSchoolDateBoundaries } from "@/lib/tz-utils"
import { Types } from "mongoose"

// Zod schema for validation
const expenseSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  amount: z.number().min(0, "Amount must be positive"),
  expenseDate: z.string().or(z.date()),
  category: z.enum(['Salary', 'Maintenance', 'Supplies', 'Utilities', 'Others']),
  teacherId: z.string().optional(),
  salaryMonth: z.number().min(1).max(12).optional(),
  salaryYear: z.number().min(2000).optional(),
  receipt: z.string().optional(),
}).refine((data) => {
  if (data.category !== 'Salary' && !data.title) {
    return false;
  }
  return true;
}, {
  message: "Title is required for non-salary expenses",
  path: ["title"],
});

interface ExpenseDoc {
    _id: Types.ObjectId;
    title?: string;
    description?: string;
    amount: number;
    expenseDate: Date;
    category: string;
    teacherId?: Types.ObjectId | { _id: Types.ObjectId; name: string } | null;
    salaryMonth?: number;
    salaryYear?: number;
    receipt?: string;
    status: string;
    createdBy?: Types.ObjectId | { _id: Types.ObjectId; name: string };
    auditLog: {
        action: string;
        performedBy: Types.ObjectId;
        date: Date;
        details: string;
        _id?: Types.ObjectId;
    }[];
}

// Define a type for the query object to avoid Mongoose version issues and 'any'
interface ExpenseQuery {
    status: string;
    $or?: Array<{ [key: string]: { $regex: string; $options: string } }>;
    expenseDate?: { $gte?: Date; $lte?: Date };
    category?: string;
}

interface ExpenseUpdates extends Partial<z.infer<typeof expenseSchema>> {
    auditLog: {
        action: string;
        performedBy: string;
        date: Date;
        details: string;
    }[];
    teacherId?: string | undefined;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExpenseUpdatesType = ExpenseUpdates;

import { saveFile } from "@/lib/upload";

export async function createExpense(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
        return { success: false, error: "Unauthorized" };
    }
    const userId = session.user.id;
    
    // Manual parsing
    const data: Partial<z.infer<typeof expenseSchema>> = {};
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const amount = formData.get('amount') as string;
    const expenseDate = formData.get('expenseDate') as string;
    const category = formData.get('category') as string;
    const teacherId = formData.get('teacherId') as string;
    const salaryMonth = formData.get('salaryMonth') as string;
    const salaryYear = formData.get('salaryYear') as string;

    if (title) data.title = title;
    if (description) data.description = description;
    if (amount) data.amount = parseFloat(amount);
    if (expenseDate) data.expenseDate = new Date(expenseDate);
    if (category) data.category = category as "Salary" | "Maintenance" | "Supplies" | "Utilities" | "Others";
    if (teacherId) data.teacherId = teacherId;
    if (salaryMonth) data.salaryMonth = parseInt(salaryMonth);
    if (salaryYear) data.salaryYear = parseInt(salaryYear);

    // Validate using Zod schema (Partial parse or reconstruct object)
    const validatedData = expenseSchema.parse(data);
    
    await dbConnect();
    
    // Mutable copy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expenseData: any = { ...validatedData };

    if (!expenseData.teacherId) {
        delete expenseData.teacherId;
    }

    // Receipt File
    const receiptFile = formData.get('receipt') as File;
    if (receiptFile && receiptFile.size > 0) {
        expenseData.receipt = await saveFile(receiptFile, 'expenses');
    }

    // Salary Duplicate Check
    if (validatedData.category === 'Salary') {
      if (!validatedData.teacherId || !validatedData.salaryMonth || !validatedData.salaryYear) {
        return { success: false, error: "Teacher, Month, and Year are required for Salary expenses" };
      }

      const existingSalary = await Expense.findOne({
        category: 'Salary',
        teacherId: validatedData.teacherId,
        salaryMonth: validatedData.salaryMonth,
        salaryYear: validatedData.salaryYear,
        status: 'active'
      });

      if (existingSalary) {
        return { success: false, error: "Salary already paid for this teacher for the selected month and year." };
      }

      // Auto-generate title if not provided
      if (!expenseData.title) {
        const teacher = await Teacher.findById(validatedData.teacherId);
        if (teacher) {
            const monthName = new Date(0, (validatedData.salaryMonth || 1) - 1).toLocaleString('default', { month: 'long' });
            expenseData.title = `Salary for ${teacher.name} - ${monthName} ${validatedData.salaryYear}`;
            expenseData.description = `Salary payment for ${monthName} ${validatedData.salaryYear}`;
        } else {
            expenseData.title = `Salary Payment - ${validatedData.salaryMonth}/${validatedData.salaryYear}`;
        }
      }
    }

    await Expense.create({
      ...expenseData,
      createdBy: userId,
      auditLog: [{
        action: 'Created',
        performedBy: userId,
        date: new Date(),
        details: 'Expense record created'
      }]
    });

    revalidatePath("/admin/expenses");
    revalidatePath("/admin/dashboard");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create expense";
      return { success: false, error: errorMessage };
  }
}

export async function updateExpense(id: string, formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
        return { success: false, error: "Unauthorized" };
    }
    const userId = session.user.id;

    await dbConnect();
    const expense = await Expense.findById(id);
    
    if (!expense) {
      return { success: false, error: "Expense not found" };
    }
    
    // Parse updates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: any = {};
    
    const title = formData.get('title') as string;
    if (title !== null) updates.title = title; // Allow empty string?
    
    const description = formData.get('description') as string;
    if (description !== null) updates.description = description;
    
    const amount = formData.get('amount') as string;
    if (amount) updates.amount = parseFloat(amount);
    
    const expenseDate = formData.get('expenseDate') as string;
    if (expenseDate) updates.expenseDate = new Date(expenseDate);
    
    const category = formData.get('category') as string;
    if (category) updates.category = category;
    
    const teacherId = formData.get('teacherId') as string;
    if (teacherId) updates.teacherId = teacherId;
    
    const salaryMonth = formData.get('salaryMonth') as string;
    if (salaryMonth) updates.salaryMonth = parseInt(salaryMonth);
    
    const salaryYear = formData.get('salaryYear') as string;
    if (salaryYear) updates.salaryYear = parseInt(salaryYear);

    // Receipt File
    const receiptFile = formData.get('receipt') as File;
    if (receiptFile && receiptFile.size > 0) {
        updates.receipt = await saveFile(receiptFile, 'expenses');
    }

    // If updating to salary, check duplicates again (excluding self)
    // We need to merge existing values to check properly
    const checkCategory = updates.category || expense.category;
    
    if (checkCategory === 'Salary') {
        const tId = updates.teacherId || expense.teacherId;
        const sMonth = updates.salaryMonth || expense.salaryMonth;
        const sYear = updates.salaryYear || expense.salaryYear;

        // Only check if we have enough info (might be incomplete update, but UI validates)
        if (tId && sMonth && sYear) {
            // Only run check if one of these fields CHANGED or we are switching category
            if (updates.category === 'Salary' || updates.teacherId || updates.salaryMonth || updates.salaryYear) {
                 const existingSalary = await Expense.findOne({
                    category: 'Salary',
                    teacherId: tId,
                    salaryMonth: sMonth,
                    salaryYear: sYear,
                    status: 'active',
                    _id: { $ne: id }
                });

                if (existingSalary) {
                    return { success: false, error: "Another salary record exists for this teacher/month/year." };
                }
            }
        }
    }

    // Audit Log
    const auditEntry = {
        action: 'Updated',
        performedBy: userId,
        date: new Date(),
        details: `Updated via form`
    };

    if (updates.teacherId === "") {
        delete updates.teacherId;
        updates.teacherId = undefined; 
    }

    await Expense.findByIdAndUpdate(id, {
        ...updates,
        $push: { auditLog: auditEntry }
    });
    
    revalidatePath("/admin/expenses");
    revalidatePath("/admin/dashboard");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard");
    return { success: true };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to update expense";
    return { success: false, error: errorMessage };
  }
}

export async function deleteExpense(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
        return { success: false, error: "Unauthorized" };
    }
    const userId = session.user.id;
    
    // Only admin can delete expenses
    if (session.user.role !== 'admin') {
      return { success: false, error: "Only admins can delete expenses" };
    }

    await dbConnect();
    const expense = await Expense.findById(id);
    if (!expense) return { success: false, error: "Expense not found" };

    await Expense.findByIdAndUpdate(id, {
        status: 'deleted',
        $push: {
            auditLog: {
                action: 'Deleted',
                performedBy: userId,
                date: new Date(),
                details: 'Soft deleted record'
            }
        }
    });

    revalidatePath("/admin/expenses");
    revalidatePath("/admin/dashboard");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete expense";
      return { success: false, error: errorMessage };
  }
}

export async function getExpenses({ 
  page = 1, 
  limit = 10, 
  search = "", 
  startDate, 
  endDate, 
  category 
}: {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
}) {
  await dbConnect();

  const query: ExpenseQuery = { status: 'active' };

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  if (startDate || endDate) {
    query.expenseDate = {};
    if (startDate) {
        const { startUtc } = await getSchoolDateBoundaries(new Date(startDate));
        query.expenseDate.$gte = startUtc;
    }
    if (endDate) {
        const { endUtc } = await getSchoolDateBoundaries(new Date(endDate));
        query.expenseDate.$lte = endUtc;
    }
  }

  if (category && category !== 'all') {
    query.category = category;
  }

  const skip = (page - 1) * limit;

  const expenses = await Expense.find(query)
    .sort({ expenseDate: -1 })
    .skip(skip)
    .limit(limit)
    .populate('teacherId', 'name')
    .populate('createdBy', 'name')
    .lean();

  const total = await Expense.countDocuments(query);

  return {
    expenses: (expenses as unknown as ExpenseDoc[]).map((e) => ({
        ...e,
        id: e._id.toString(),
        _id: e._id.toString(),
        teacherId: e.teacherId && typeof e.teacherId === 'object' && 'name' in e.teacherId ? { ...e.teacherId, _id: e.teacherId._id.toString() } : null,
        createdBy: e.createdBy && typeof e.createdBy === 'object' && 'name' in e.createdBy ? { ...e.createdBy, _id: e.createdBy._id.toString() } : null,
        auditLog: e.auditLog ? e.auditLog.map((log) => ({
            ...log,
            _id: log._id ? log._id.toString() : undefined,
            performedBy: log.performedBy ? log.performedBy.toString() : null
        })) : [],
    })),
    totalPages: Math.ceil(total / limit),
    total
  };
}

export async function getAllExpensesForExport({ 
  search = "", 
  startDate, 
  endDate, 
  category 
}: {
  search?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
}) {
  await dbConnect();

  const query: ExpenseQuery = { status: 'active' };

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  if (startDate || endDate) {
    query.expenseDate = {};
    if (startDate) {
        const { startUtc } = await getSchoolDateBoundaries(new Date(startDate));
        query.expenseDate.$gte = startUtc;
    }
    if (endDate) {
        const { endUtc } = await getSchoolDateBoundaries(new Date(endDate));
        query.expenseDate.$lte = endUtc;
    }
  }

  if (category && category !== 'all') {
    query.category = category;
  }

  const expenses = await Expense.find(query)
    .sort({ expenseDate: -1 })
    .populate('teacherId', 'name')
    .populate('createdBy', 'name')
    .lean();

  return (expenses as unknown as ExpenseDoc[]).map((e) => ({
      Date: new Date(e.expenseDate).toLocaleDateString(),
      Title: e.title,
      Category: e.category,
      Amount: e.amount,
      Description: e.description || '',
      'Teacher Name': e.teacherId && typeof e.teacherId === 'object' && 'name' in e.teacherId ? e.teacherId.name : '-',
      'Created By': e.createdBy && typeof e.createdBy === 'object' && 'name' in e.createdBy ? e.createdBy.name : '-'
  }));
}

export async function getExpenseStats(startDate?: string, endDate?: string) {
    await dbConnect();
    
    const query: ExpenseQuery = { status: 'active' };
    
    if (startDate || endDate) {
        query.expenseDate = {};
        if (startDate) {
            const { startUtc } = await getSchoolDateBoundaries(new Date(startDate));
            query.expenseDate.$gte = startUtc;
        }
        if (endDate) {
            const { endUtc } = await getSchoolDateBoundaries(new Date(endDate));
            query.expenseDate.$lte = endUtc;
        }
    }

    const result = await Expense.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    return result.length > 0 ? result[0].total : 0;
}
