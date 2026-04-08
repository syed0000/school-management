import "server-only"

import { hasLocale, type SupportedLocale } from "@/lib/i18n"
import { notFound } from "next/navigation"

const dictionaries = {
  en: () => import("@/locales/en/common.json").then((m) => m.default),
  hi: () => import("@/locales/hi/common.json").then((m) => m.default),
  ur: () => import("@/locales/ur/common.json").then((m) => m.default),
} satisfies Record<SupportedLocale, () => Promise<Record<string, any>>>

export async function getDictionary(locale: string) {
  if (!hasLocale(locale)) notFound()
  return dictionaries[locale]()
}
