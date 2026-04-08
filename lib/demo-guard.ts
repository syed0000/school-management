import type { Session } from "next-auth"

export function isDemoSession(session: Session | null | undefined): boolean {
  return session?.user?.isDemo === true
}

export function demoWriteSuccess<T extends Record<string, unknown> = Record<string, unknown>>(
  extra?: T,
): { success: true; demo: true } & T {
  return { success: true, demo: true, ...(extra || ({} as T)) }
}
