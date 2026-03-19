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
  }
};
