import { whatsappConfig as whatsappConfigSchema } from './whatsapp-config';
import License from "@/models/License";
import dbConnect from "@/lib/db";

interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface UniversalMessageParams {
  parent_name: string;
  notification_type: string;
  student_name: string;
  main_message: string;
}

export async function sendWhatsAppMessage({
  to,
  params,
  messageType,
  mediaUrl,
  mediaFilename,
  config
}: {
  to: string;
  params: UniversalMessageParams;
  messageType: 'text' | 'image';
  mediaUrl?: string;
  mediaFilename?: string;
  config: typeof whatsappConfigSchema;
}): Promise<WhatsAppMessageResult> {
  if (!config.enabled) {
    console.log('WhatsApp integration is disabled');
    return { success: true, messageId: 'disabled' };
  }

  try {
    await dbConnect();
    const license = await License.findOne().sort({ createdAt: -1 }).lean();
    if (!license || !license.schoolId || !license.key) {
      throw new Error("Worker configuration missing (Could not find License in DB)");
    }

    const validatedPhone = validatePhoneNumber(to);
    if (!validatedPhone) {
      throw new Error(`Invalid phone number: ${to}`);
    }

    const endpointPath = messageType === 'image' ? 'broadcast/image' : 'broadcast/text';
    const campaignName = messageType === 'image' 
      ? config.templates.universal_image 
      : config.templates.universal_text;

    // The worker's broadcast endpoint expects a list of recipients
    const payload = {
      schoolId: license.schoolId,
      licenseKey: license.key,
      mode: 'single', // We are sending one message, but using broadcast endpoint structure
      campaignName: campaignName,
      media: mediaUrl && mediaFilename ? { url: mediaUrl, filename: mediaFilename } : undefined,
      notificationType: params.notification_type,
      mainMessage: params.main_message,
      recipients: [{
        phone: validatedPhone,
        studentName: params.student_name,
        parentName: params.parent_name,
      }],
      source: 'Fee Ease School Management System',
      // Webhook is optional for single messages usually, but we can provide appUrl if needed
      webhookUrl: `${config.appUrl}/api/whatsapp/webhook`,
    };

    const response = await fetch(`${config.worker.url}/api/v1/whatsapp/${endpointPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(data.detail || data.message || `Worker Error: ${response.statusText}`);
    }

    return { success: true, messageId: data.jobId || data.messageId || 'sent' };

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error('WhatsApp Send Error:', error);
    return { success: false, error: message };
  }
}

export function validatePhoneNumber(phone: string): string | null {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Check if it's a valid length (e.g., 10 digits for India)
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }

  // If 12 digits and starts with 91 or 0, handle it
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }

  // Basic length check for international
  if (cleaned.length >= 10 && cleaned.length <= 15) {
     return `+${cleaned}`;
  }

  return null;
}

