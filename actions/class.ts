"use server"

import dbConnect from "@/lib/db"
import Class from "@/models/Class"
import ClassFee from "@/models/ClassFee"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const createClassSchema = z.object({
  name: z.string().min(1, "Name is required"),
  monthlyFee: z.coerce.number().min(0).optional(),
  admissionFee: z.coerce.number().min(0).optional(),
  registrationFee: z.coerce.number().min(0).optional(),
  effectiveFrom: z.string().min(1, "Effective Date is required").optional(),
  examFees: z.array(z.object({
    title: z.string().min(1, "Exam name is required"),
    month: z.string().min(1, "Month is required"),
    amount: z.coerce.number().min(0)
  })).optional(),
})

const updateClassWithFeesSchema = z.object({
  classId: z.string().min(1, "Class ID is required"),
  name: z.string().min(1, "Name is required"),
  monthlyFee: z.coerce.number().min(0).optional(),
  monthlyFeeEffectiveFrom: z.string().min(1, "Effective Date is required").optional(),
  admissionFee: z.coerce.number().min(0).optional(),
  admissionFeeEffectiveFrom: z.string().min(1, "Effective Date is required").optional(),
  registrationFee: z.coerce.number().min(0).optional(),
  registrationFeeEffectiveFrom: z.string().min(1, "Effective Date is required").optional(),
  examFees: z.array(z.object({
    title: z.string().min(1, "Exam name is required"),
    month: z.string().min(1, "Month is required"),
    amount: z.coerce.number().min(0),
    effectiveFrom: z.string().min(1, "Effective Date is required")
  })).optional(),
})

const feeSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  type: z.enum(['monthly', 'examination', 'admission', 'admissionFees', 'registrationFees']),
  amount: z.number().min(0, "Amount must be positive"),
  effectiveFrom: z.string().min(1, "Effective Date is required"), // YYYY-MM-DD
})

const updateExamsSchema = z.object({
  classId: z.string().min(1, "Class ID is required"),
  exams: z.array(z.string()).min(1, "At least one exam is required"),
})

export async function createClass(data: z.infer<typeof createClassSchema>) {
  try {
    createClassSchema.parse(data);
    await dbConnect();
    const existingClass = await Class.findOne({ name: data.name });
    if (existingClass) {
      return { success: false, error: "Class already exists" };
    }
    
    // Extract exam names from examFees if provided, otherwise default
    const examNames = data.examFees?.map(e => e.title) || ["Annual", "Half Yearly"];
    // Ensure unique exam names
    const uniqueExamNames = Array.from(new Set(examNames));

    const newClass = await Class.create({ 
      name: data.name,
      exams: uniqueExamNames
    });

    // Create fees if provided
    const feesToCreate = [];
    const now = data.effectiveFrom ? new Date(data.effectiveFrom) : new Date();

    if (data.monthlyFee !== undefined && data.monthlyFee > 0) {
      feesToCreate.push({
        classId: newClass._id,
        type: 'monthly',
        amount: data.monthlyFee,
        effectiveFrom: now,
        isActive: true
      });
    }

    if (data.admissionFee !== undefined && data.admissionFee > 0) {
      feesToCreate.push({
        classId: newClass._id,
        type: 'admissionFees',
        amount: data.admissionFee,
        effectiveFrom: now,
        isActive: true
      });
    }
    
    if (data.registrationFee !== undefined && data.registrationFee > 0) {
        feesToCreate.push({
          classId: newClass._id,
          type: 'registrationFees',
          amount: data.registrationFee,
          effectiveFrom: now,
          isActive: true
        });
      }

    // Handle Exam Fees
    if (data.examFees && data.examFees.length > 0) {
      for (const exam of data.examFees) {
        if (exam.amount > 0) {
          feesToCreate.push({
            classId: newClass._id,
            type: 'examination',
            amount: exam.amount,
            title: exam.title,
            month: exam.month,
            effectiveFrom: now,
            isActive: true
          });
        }
      }
    }

    if (feesToCreate.length > 0) {
      await ClassFee.insertMany(feesToCreate);
    }

    revalidatePath("/admin/classes");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}

interface ExistingFee {
    type: string;
    amount: number;
    effectiveFrom: Date;
    title?: string;
    month?: string;
}

export async function updateClassWithFees(data: z.infer<typeof updateClassWithFeesSchema>) {
    try {
        updateClassWithFeesSchema.parse(data);
        await dbConnect();
        
        // 1. Update Class Name and Exams
        const existingClass = await Class.findById(data.classId);
        if (!existingClass) {
             return { success: false, error: "Class not found" };
        }
        
        let shouldSaveClass = false;
        if (existingClass.name !== data.name) {
             // Check name uniqueness
             const duplicate = await Class.findOne({ name: data.name, _id: { $ne: data.classId } });
             if (duplicate) {
                  return { success: false, error: "Class name already exists" };
             }
             existingClass.name = data.name;
             shouldSaveClass = true;
        }

        // Update exams list based on examFees
        if (data.examFees) {
          const newExamNames = Array.from(new Set(data.examFees.map(e => e.title)));
          // We could compare arrays, but simply updating is safe
          existingClass.exams = newExamNames;
          shouldSaveClass = true;
        }

        if (shouldSaveClass) {
          await existingClass.save();
        }

        // 2. Update Fees (Create new entries if different)
        const fees = await ClassFee.find({ 
            classId: data.classId, 
            isActive: true 
        }).sort({ effectiveFrom: -1 }).lean() as unknown as ExistingFee[];

        const latestFees: Record<string, { amount: number, effectiveFrom: Date }> = {};
        const latestExamFees: Record<string, { amount: number, month: string, effectiveFrom: Date }> = {};

        // Iterate and pick latest for each type
        for (const f of fees) {
            if (f.type === 'examination' && f.title) {
               if (!latestExamFees[f.title]) {
                 latestExamFees[f.title] = { amount: f.amount, month: f.month || '', effectiveFrom: f.effectiveFrom };
               }
            } else if (latestFees[f.type] === undefined) {
                latestFees[f.type] = { amount: f.amount, effectiveFrom: f.effectiveFrom };
            }
        }

        const feesToCreate = [];
        // const defaultEffectiveDate = new Date();

        // Helper to check if fee should be updated
        const shouldUpdateFee = (type: string, newAmount: number, newEffectiveFrom?: string, title?: string, month?: string) => {
             // 1. Check if same amount and same effective date
             // If effective date is provided, we use it. If not, we use current date? 
             // In this new schema, effective date is required for each field if amount is provided.
             
             if (!newEffectiveFrom) return true; // Should ideally be required
             
             const newDate = new Date(newEffectiveFrom);
             const newDateStr = newDate.toISOString().split('T')[0];

             if (type === 'examination' && title) {
                 const current = latestExamFees[title];
                 if (!current) return true; // New exam fee
                 
                 const currentDateStr = current.effectiveFrom ? new Date(current.effectiveFrom).toISOString().split('T')[0] : '';
                 
                 // If amount changed OR date changed, we insert new record?
                 // Wait, if amount is same but date is different (user corrected date), we should update/insert.
                 // If everything is same, skip.
                 
                 if (current.amount !== newAmount) return true;
                 if (current.month !== month) return true;
                 if (currentDateStr !== newDateStr) return true;
                 
                 return false;
             } else {
                 const current = latestFees[type];
                 if (!current) return true; // New fee type
                 
                 const currentDateStr = current.effectiveFrom ? new Date(current.effectiveFrom).toISOString().split('T')[0] : '';
                 
                 if (current.amount !== newAmount) return true;
                 if (currentDateStr !== newDateStr) return true;
                 
                 return false;
             }
        };

        // Check Monthly
        if (data.monthlyFee !== undefined && data.monthlyFeeEffectiveFrom && shouldUpdateFee('monthly', data.monthlyFee, data.monthlyFeeEffectiveFrom)) {
             feesToCreate.push({
                classId: data.classId,
                type: 'monthly',
                amount: data.monthlyFee,
                effectiveFrom: new Date(data.monthlyFeeEffectiveFrom),
                isActive: true
             });
        }
        
        // Check Admission
        if (data.admissionFee !== undefined && data.admissionFeeEffectiveFrom && shouldUpdateFee('admissionFees', data.admissionFee, data.admissionFeeEffectiveFrom)) {
             feesToCreate.push({
                classId: data.classId,
                type: 'admissionFees',
                amount: data.admissionFee,
                effectiveFrom: new Date(data.admissionFeeEffectiveFrom),
                isActive: true
             });
        }
        
        // Check Registration
        if (data.registrationFee !== undefined && data.registrationFeeEffectiveFrom && shouldUpdateFee('registrationFees', data.registrationFee, data.registrationFeeEffectiveFrom)) {
             feesToCreate.push({
                classId: data.classId,
                type: 'registrationFees',
                amount: data.registrationFee,
                effectiveFrom: new Date(data.registrationFeeEffectiveFrom),
                isActive: true
             });
        }

        // Check Exam Fees
        if (data.examFees) {
          for (const exam of data.examFees) {
            if (shouldUpdateFee('examination', exam.amount, exam.effectiveFrom, exam.title, exam.month)) {
               feesToCreate.push({
                classId: data.classId,
                type: 'examination',
                amount: exam.amount,
                title: exam.title,
                month: exam.month,
                effectiveFrom: new Date(exam.effectiveFrom),
                isActive: true
              });
            }
          }
        }

        if (feesToCreate.length > 0) {
             await ClassFee.insertMany(feesToCreate);
        }

        revalidatePath("/admin/classes");
        return { success: true };

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        return { success: false, error: message };
    }
}

export async function updateClassExams(data: z.infer<typeof updateExamsSchema>) {
  try {
    updateExamsSchema.parse(data);
    await dbConnect();
    await Class.findByIdAndUpdate(data.classId, { exams: data.exams });
    revalidatePath("/admin/classes");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}

export async function addClassFee(data: z.infer<typeof feeSchema>) {
  try {
    feeSchema.parse(data);
    await dbConnect();
    
    await ClassFee.create({
      classId: data.classId,
      type: data.type,
      amount: data.amount,
      effectiveFrom: new Date(data.effectiveFrom),
      isActive: true
    });
    revalidatePath("/admin/classes");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}

interface ClassDoc {
  _id: { toString: () => string };
  name: string;
  exams?: string[];
}

export async function getClassesWithFees() {
  await dbConnect();
  const classes = await Class.find({ isActive: true }).lean();
  
  const result = await Promise.all(classes.map(async (c: unknown) => {
    const cls = c as ClassDoc;
    // Get latest fees for this class
    const fees = await ClassFee.find({ 
        classId: cls._id, 
        isActive: true 
    }).sort({ effectiveFrom: -1 }).lean();

    const latestFees: Record<string, { amount: number, effectiveFrom?: Date }> = {};
    const latestExamFees: Record<string, { title: string, month: string, amount: number, effectiveFrom?: Date }> = {};

    // Iterate and pick latest for each type
    for (const f of fees) {
        if (f.type === 'examination' && f.title) {
             // For examination, we need to distinguish by title (exam name)
             if (!latestExamFees[f.title]) {
                 latestExamFees[f.title] = {
                     title: f.title,
                     month: f.month || '',
                     amount: f.amount,
                     effectiveFrom: f.effectiveFrom
                 };
             }
        } else if (latestFees[f.type] === undefined) {
            latestFees[f.type] = { amount: f.amount, effectiveFrom: f.effectiveFrom };
        }
    }
    
    return {
      id: cls._id.toString(),
      name: cls.name,
      exams: cls.exams || [],
      monthlyFee: latestFees['monthly']?.amount || 0,
      monthlyFeeEffectiveFrom: latestFees['monthly']?.effectiveFrom,
      examFees: Object.values(latestExamFees),
      admissionFee: latestFees['admissionFees']?.amount || latestFees['admission']?.amount || 0,
      admissionFeeEffectiveFrom: latestFees['admissionFees']?.effectiveFrom || latestFees['admission']?.effectiveFrom,
      registrationFee: latestFees['registrationFees']?.amount || 0,
      registrationFeeEffectiveFrom: latestFees['registrationFees']?.effectiveFrom,
    };
  }));
  
  return result;
}

export async function getClasses() {
  await dbConnect();
  const classes = await Class.find({ isActive: true }).sort({ name: 1 }).lean();
  return classes.map((c: unknown) => {
    const cls = c as ClassDoc;
    return {
      id: cls._id.toString(),
      name: cls.name,
      exams: cls.exams || []
    };
  });
}
