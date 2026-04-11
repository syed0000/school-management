import "server-only"

import { hasLocale, type SupportedLocale } from "@/lib/i18n"
import { notFound } from "next/navigation"

export type Dictionary = Record<string, unknown>

const dictionaries = {
  en: () => import("@/locales/en/common.json").then((m) => m.default),
  hi: () => import("@/locales/hi/common.json").then((m) => m.default),
  ur: () => import("@/locales/ur/common.json").then((m) => m.default),
} satisfies Record<SupportedLocale, () => Promise<Dictionary>>

export async function getDictionary(locale: string) {
  if (!hasLocale(locale)) notFound()
  return dictionaries[locale]()
}

export function dictGet(dict: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean)
  let cur: unknown = dict
  for (const p of parts) {
    if (cur && typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return cur
}

export function dictString(dict: unknown, path: string, fallback: string): string {
  const value = dictGet(dict, path)
  return typeof value === "string" ? value : fallback
}
