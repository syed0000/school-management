export const locales = ["en", "hi", "ur"] as const

export type SupportedLocale = (typeof locales)[number]

export type Locale = string

export const defaultLocale: SupportedLocale = "en"

export function hasLocale(value: string): value is SupportedLocale {
  return (locales as readonly string[]).includes(value)
}

export function isRtlLocale(locale: string): boolean {
  return locale === "ur"
}
