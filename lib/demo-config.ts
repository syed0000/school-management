const getEnvBool = (val: string | undefined): boolean => {
  if (!val) return false;
  const normalized = val.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
};

export const demoConfig = {
  adminInstitute: getEnvBool(process.env.adminInstitute) || getEnvBool(process.env.ADMIN_INSTITUTE),
};

export const clientDemoConfig = {
  adminInstitute:
    getEnvBool(process.env.NEXT_PUBLIC_ADMIN_INSTITUTE) ||
    getEnvBool(process.env.NEXT_PUBLIC_adminInstitute),
};

