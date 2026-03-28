import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      requiresPasswordChange: boolean;
    } & DefaultSession["user"]
  }

  interface User {
    id: string;
    role: string;
    requiresPasswordChange: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    requiresPasswordChange: boolean;
    error?: string;
    lastRefetchedAt?: number;
  }
}
