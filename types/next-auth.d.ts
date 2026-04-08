import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      requiresPasswordChange: boolean;
      isDemo?: boolean;
      actorId?: string;
      impersonation?: {
        id: string;
        role: string;
        name?: string;
      } | null;
    } & DefaultSession["user"]
  }

  interface User {
    id: string;
    role: string;
    requiresPasswordChange: boolean;
    isDemo?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    requiresPasswordChange: boolean;
    isDemo?: boolean;
    impersonation?: {
      id: string;
      role: string;
      name?: string;
    } | null;
    error?: string;
    lastRefetchedAt?: number;
  }
}
