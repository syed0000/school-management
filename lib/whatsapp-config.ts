export const whatsappConfig = {
  apiKey: process.env.AISENSY_API_KEY || '',
  baseUrl: process.env.AISENSY_BASE_URL || 'https://backend.aisensy.com/campaign/t1/api/v2',
  enabled: process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_INTEGRATION === 'true',
  schoolName: process.env.NEXT_PUBLIC_SCHOOL_NAME || 'Modern Nursery School',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  
  templates: {
    receipt: {
      campaignName: process.env.WHATSAPP_TEMPLATE_RECEIPT || 'fee_receipt_v1',
      params: ['student_name', 'amount', 'receipt_no', 'date']
    },
    reminders: {
      hindi: {
        campaignName: process.env.WHATSAPP_TEMPLATE_REMINDER_HINDI || 'reminder_hindi',
        params: ['student_name', 'class', 'dues_list', 'total_amount']
      },
      english: {
        campaignName: process.env.WHATSAPP_TEMPLATE_REMINDER_ENGLISH || 'reminder_english',
        params: ['student_name', 'class', 'dues_list', 'total_amount']
      },
      urdu: {
        campaignName: process.env.WHATSAPP_TEMPLATE_REMINDER_URDU || 'reminder_urdu',
        params: ['student_name', 'class', 'dues_list', 'total_amount']
      }
    }
  }
};
