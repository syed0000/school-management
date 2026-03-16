const getEnvBool = (val: string | undefined): boolean => {
  if (!val) return false;
  const normalized = val.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
};

export const whatsappConfig = {
  enabled: getEnvBool(process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_INTEGRATION),
  enableParentLogin: getEnvBool(process.env.NEXT_PUBLIC_ENABLE_PARENT_LOGIN),
  enableTeacherLogin: getEnvBool(process.env.NEXT_PUBLIC_ENABLE_TEACHER_LOGIN),
  schoolName: process.env.NEXT_PUBLIC_SCHOOL_NAME,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  
  worker: {
    url: process.env.FEEEASE_WORKER_URL,
    webhookSecret: process.env.WORKER_WEBHOOK_SECRET
  },

  templates: {
    universal_text: process.env.WHATSAPP_TEMPLATE_UNIVERSAL_TEXT || 'boradcast_text',
    universal_image: process.env.WHATSAPP_TEMPLATE_UNIVERSAL_IMAGE || 'broadcast_image',
    receipt: process.env.WHATSAPP_TEMPLATE_RECEIPT || 'fee_receipt_v1',
    reminder_hindi: process.env.WHATSAPP_TEMPLATE_REMINDER_HINDI || 'reminder_hindi',
    reminder_english: process.env.WHATSAPP_TEMPLATE_REMINDER_ENGLISH || 'reminder_english',
    reminder_urdu: process.env.WHATSAPP_TEMPLATE_REMINDER_URDU || 'reminder_urdu',
    otp: process.env.WHATSAPP_TEMPLATE_OTP || 'login_otp'
  }
};
