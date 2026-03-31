"use server"

import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import { saveFile } from "@/lib/upload"
import { revalidatePath } from "next/cache"
import WhatsAppStat from "@/models/WhatsAppStat"
import WhatsAppPricing from "@/models/WhatsAppPricing"
import License from "@/models/License"
import mongoose from "mongoose"

import { whatsappConfig } from "@/lib/whatsapp-config"

export interface WhatsAppNotificationPayload {
  classIds: string[];
  notificationType: string;
  mainMessage: string;
  messageType: 'text' | 'image';
  mediaFile?: File;
}

interface StudentWithContact {
  name: string;
  contacts?: { mobile?: string[] };
  parents?: { father?: { name?: string } };
}

export async function getNotificationEstimate(classIds: string[]) {
  try {
    await dbConnect();
    
    const query: { isActive: boolean; classId?: { $in: string[] } } = { isActive: true };
    if (!classIds.includes('all')) {
      query.classId = { $in: classIds };
    }

    const students = await Student.find(query).select('contacts').lean();
    
    // Count valid phones exactly like send does
    const validCount = students.filter(s => {
       const typed = s as StudentWithContact;
       return !!typed.contacts?.mobile?.[0];
    }).length;

    const costPerMessage = await WhatsAppPricing.getCurrentPrice();
    const totalCost = validCount * costPerMessage;
    
    const { getWhatsAppSummary } = await import("@/actions/whatsapp-stats");
    const { balance } = await getWhatsAppSummary();

    return {
       success: true,
       validCount,
       costPerMessage,
       totalCost,
       balance,
       hasSufficientBalance: balance >= totalCost
    };
  } catch (err) {
    return { success: false, error: "Failed to estimate cost" };
  }
}

export async function sendBulkNotification(formData: FormData) {
  try {
    await dbConnect();

    const classIds = formData.getAll('classIds') as string[];
    const notificationType = formData.get('notificationType') as string;
    const mainMessage = formData.get('mainMessage') as string;
    const messageType = formData.get('messageType') as 'text' | 'image';
    const mediaFile = formData.get('mediaFile') as File;

    if (!whatsappConfig.enabled) {
      return { success: false, error: "WhatsApp integration is disabled" };
    }

    const license = await License.findOne().sort({ createdAt: -1 }).lean();
    if (!license || !license.schoolId || !license.key) {
      return { success: false, error: "Worker configuration missing (Could not find License in DB)" };
    }

    if (classIds.length === 0) {
      return { success: false, error: "No classes selected" };
    }

    // 1. Fetch students
    const query: { isActive: boolean; classId?: { $in: string[] } } = { isActive: true };
    if (!classIds.includes('all')) {
      query.classId = { $in: classIds };
    }

    const students = await Student.find(query)
      .populate('classId', 'name')
      .select('name contacts parents.father.name classId')
      .lean();

    if (students.length === 0) {
      return { success: false, error: "No students found in selected classes" };
    }

    // 2. Handle media upload if image type
    let mediaUrl: string | undefined;
    let mediaFilename: string | undefined;
    if (messageType === 'image' && mediaFile && mediaFile.size > 0) {
      mediaUrl = await saveFile(mediaFile, 'notifications');
      mediaFilename = mediaFile.name;
    }

    // 3. Pricing
    const costPerMessage = await WhatsAppPricing.getCurrentPrice();
    const totalCost = costPerMessage * students.length;

    const { getWhatsAppSummary } = await import("@/actions/whatsapp-stats");
    const { balance } = await getWhatsAppSummary();

    if (balance < totalCost) {
        return { success: false, error: `Insufficient WhatsApp balance. You need ₹${totalCost.toFixed(2)} but your current balance is ₹${balance.toFixed(2)}.` };
    }

    // 4. Create a pending stat record
    const batchId = new mongoose.Types.ObjectId().toHexString();
    
    // Improved description: show student names if small count, or first few + count
    let recipientNames = "";
    if (students.length <= 2) {
      recipientNames = students.map(s => s.name).join(", ");
    } else {
      recipientNames = `${students[0].name} and ${students.length - 1} others`;
    }

    const stat = new WhatsAppStat({
      type: messageType,
      description: `Bulk notification (${notificationType || 'General'}) to ${recipientNames}`,
      recipientCount: students.length,
      cost: totalCost,
      status: 'pending',
      batchId,
      mediaUrl,
    });
    await stat.save();

    // 5. Build recipients array for the worker
    // ALERT mode: root-level templateParams only (same message to all)
    // Per-recipient params: [parentName, notificationType, studentName, mainMessage]
    const recipients = students
      .map((s) => {
        const typed = s as StudentWithContact;
        const phone = typed.contacts?.mobile?.[0];
        if (!phone) return null;
        return {
          phone,
          studentName: typed.name,
          parentName: typed.parents?.father?.name || typed.name,
        };
      })
      .filter(Boolean);

    if (recipients.length === 0) {
      return { success: false, error: "No students with valid phone numbers found" };
    }

    // 6. Fire request to feeease-worker (bulk mode → async, respond with 202)
    const webhookUrl = `${whatsappConfig.appUrl}/api/whatsapp/webhook`;
    const endpointPath = messageType === 'image' ? 'broadcast/image' : 'broadcast/text';

    const workerRes = await fetch(`${whatsappConfig.worker.url}/api/v1/whatsapp/${endpointPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolId: license.schoolId,
        licenseKey: license.key,
        mode: 'bulk',
        media: mediaUrl && mediaFilename ? { url: mediaUrl, filename: mediaFilename } : undefined,
        notificationType: notificationType,
        mainMessage: mainMessage,
        recipients,
        webhookUrl,
        jobId: batchId,
      }),
    });

    if (!workerRes.ok) {
      const err = await workerRes.json().catch(() => ({ error: 'Worker error' }));
      return { success: false, error: err.detail || err.error || 'Failed to schedule broadcast' };
    }

    revalidatePath('/whatsapp');

    return {
      success: true,
      jobId: batchId,
      message: `Broadcast scheduled for ${recipients.length} recipients. You will be notified when complete.`,
    };

  } catch (error) {
    console.error("WhatsApp notification error:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred" };
  }
}
