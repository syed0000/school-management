"use client"

import { createContext, useContext } from "react"

import type { Locale } from "@/lib/i18n"

type Dict = Record<string, any>

type I18nContextValue = {
  locale: Locale
  dict: Dict
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale
  dict: Dict
  children: React.ReactNode
}) {
  return <I18nContext.Provider value={{ locale, dict }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    return {
      locale: "en" as Locale,
      dict: {} as Dict,
      t: (key: string, fallback?: string) => fallback ?? key,
    }
  }

  const t = (key: string, fallback?: string) => {
    const parts = key.split(".")
    let cur: any = ctx.dict
    for (const p of parts) {
      cur = cur?.[p]
    }
    if (typeof cur === "string") return cur
    return fallback ?? key
  }

  return { ...ctx, t }
}

