import { whatsappConfig } from './whatsapp-config';

interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface WhatsAppPayload {
  apiKey: string;
  campaignName: string;
  destination: string;
  userName: string;
  source?: string;
  media?: {
    url: string;
    filename: string;
  };
  templateParams?: string[];
  tags?: string[];
  attributes?: Record<string, string>;
}

interface AiSensyResponse {
    success: boolean;
    message?: string;
    messageId?: string;
    // Add other properties as needed based on actual API response
}

export async function sendWhatsAppMessage({
  to,
  userName,
  campaignName,
  params = [],
  mediaUrl,
  mediaFilename
}: {
  to: string;
  userName: string;
  campaignName: string;
  params?: string[];
  mediaUrl?: string;
  mediaFilename?: string;
}): Promise<WhatsAppMessageResult> {
  if (!whatsappConfig.enabled) {
    console.log('WhatsApp integration is disabled');
    return { success: true, messageId: 'disabled' };
  }

  try {
    const validatedPhone = validatePhoneNumber(to);
    if (!validatedPhone) {
      throw new Error(`Invalid phone number: ${to}`);
    }

    const payload: WhatsAppPayload = {
      apiKey: whatsappConfig.apiKey,
      campaignName: campaignName,
      destination: validatedPhone,
      userName: userName,
      source: 'Fee Ease School Management System',
      templateParams: params,
    };

    if (mediaUrl && mediaFilename) {
      payload.media = {
        url: mediaUrl,
        filename: mediaFilename
      };
    }

    console.log(`Sending WhatsApp message to ${validatedPhone} with campaign ${campaignName}`);

    const response = await fetch(whatsappConfig.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json() as AiSensyResponse;

    if (!response.ok) {
      throw new Error(data.message || `API Error: ${response.statusText}`);
    }

    // AiSensy success response usually has status: true/success
    if (data.success === false) { 
         throw new Error(data.message || 'Unknown error from AiSensy');
    }

    return { success: true, messageId: data.messageId || 'sent' };

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
  // If 10 digits, add +91 (default country code for India if applicable, context implies India based on currency symbol ₹)
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }

  // If 12 digits and starts with 91, add +
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }

  // If it already has country code (e.g., > 10 digits), assume it's correct but needs +
  if (cleaned.length > 10 && cleaned.length < 13) {
     return `+${cleaned}`;
  }

  return null;
}
