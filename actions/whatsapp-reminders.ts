"use server"

import dbConnect from "@/lib/db"
import WhatsAppStat from "@/models/WhatsAppStat"
import WhatsAppPricing from "@/models/WhatsAppPricing"
import License from "@/models/License"
import mongoose from "mongoose"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isDemoSession } from "@/lib/demo-guard"

import { whatsappConfig } from "@/lib/whatsapp-config"
export interface ReminderStudent {
  id: string;
  name: string;
  contactNumber: string;
  className: string;
  details: string[];  // months/items that are due
  amount: number;
}

export async function sendBulkReminders(
  students: ReminderStudent[],
  language: 'hindi' | 'english' | 'urdu'
) {
  const session = await getServerSession(authOptions)
  if (isDemoSession(session)) {
    return { success: true, demo: true, message: "Demo mode: reminders were not sent." }
  }
  if (!whatsappConfig.enabled) {
    return { success: false, error: "WhatsApp integration is disabled" };
  }
  if (students.length === 0) {
    return { success: false, error: "No students provided" };
  }

  try {
    await dbConnect();

    const license = await License.findOne().sort({ createdAt: -1 }).lean();
    if (!license || !license.schoolId || !license.key) {
      return { success: false, error: "Worker configuration missing (Could not find License in DB)" };
    }

    // 1. Pricing
    const costPerMessage = await WhatsAppPricing.getCurrentPrice();

    // Filter out students with no contact
    const validStudents = students.filter(
      (s) => s.contactNumber && s.contactNumber !== 'N/A'
    );

    if (validStudents.length === 0) {
      return { success: false, error: "No students with valid contact numbers" };
    }

    const { getWhatsAppSummary } = await import("@/actions/whatsapp-stats");
    const { balance } = await getWhatsAppSummary();
    const totalCost = costPerMessage * validStudents.length;

    if (balance < totalCost) {
        return { success: false, error: `Insufficient WhatsApp balance. You need ₹${totalCost.toFixed(2)} but your current balance is ₹${balance.toFixed(2)}.` };
    }

    // 2. Create pending stat record
    const batchId = new mongoose.Types.ObjectId().toHexString();
    
    // Improved description showing student names/summary
    let recipientNames = "";
    if (validStudents.length <= 2) {
      recipientNames = validStudents.map(s => s.name).join(", ");
    } else {
      recipientNames = `${validStudents[0].name} and ${validStudents.length - 1} others`;
    }

    await WhatsAppStat.create({
      type: 'reminder',
      description: `Bulk fee reminders (${language}) to ${recipientNames}`,
      recipientCount: validStudents.length,
      cost: costPerMessage * validStudents.length,
      status: 'pending',
      batchId,
    });

    // 3. Build strictly typed fields for Reminders
    // 3. Build strictly typed fields for Reminders and fetch push tokens
    const studentIds = validStudents.map(s => s.id);
    const { default: Student } = await import("@/models/Student");
    const studentDocs = await Student.find({ _id: { $in: studentIds } }, 'pushTokens notificationSettings').lean();
    
    const pushTargets: { studentId: string, tokens: string[] }[] = [];
    studentDocs.forEach(doc => {
      if (doc.notificationSettings?.pushEnabled && doc.pushTokens && doc.pushTokens.length > 0) {
        pushTargets.push({
          studentId: doc._id.toString(),
          tokens: doc.pushTokens
        });
      }
    });

    const recipients = validStudents.map((student) => {
      const duesList = student.details.join(', ');
      const totalAmount = `₹${student.amount.toLocaleString()}`;

      return {
        phone: student.contactNumber,
        studentName: student.name,
        parentName: student.name, // Fallback to student name if parent name not supplied in struct
        dueAmount: totalAmount,
        dueDate: "Immediately",
        month: duesList,
        studentId: student.id,
      };
    });

    // 4. Fire to worker — bulk / async
    const webhookUrl = `${whatsappConfig.appUrl}/api/whatsapp/webhook`;

    const workerRes = await fetch(`${whatsappConfig.worker.url}/api/v1/whatsapp/reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolId: license.schoolId,
        licenseKey: license.key,
        mode: 'bulk',
        language,
        recipients,
        pushTargets,
        webhookUrl,
        jobId: batchId,
      }),
    });


    if (!workerRes.ok) {
      const err = await workerRes.json().catch(() => ({ error: 'Worker error' }));
      return { success: false, error: err.detail || err.error || 'Failed to schedule reminders' };
    }

    return {
      success: true,
      jobId: batchId,
      message: `Fee reminders scheduled for ${validStudents.length} students. You will be notified when complete.`,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Bulk reminder error:", error);
    return { success: false, error: errorMessage };
  }
}
