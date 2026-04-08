"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { locales, type Locale, hasLocale } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function setLocaleCookie(locale: Locale) {
  document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`
  document.cookie = `lang=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`
}

export function LanguageSwitcher({
  currentLocale,
  languageNames,
}: {
  currentLocale: string
  languageNames: Record<string, string>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentLabel = languageNames[currentLocale] ?? currentLocale.toUpperCase()

  const search = useMemo(() => {
    const s = searchParams?.toString()
    return s ? `?${s}` : ""
  }, [searchParams])

  function switchTo(locale: Locale) {
    if (!pathname) return

    setLocaleCookie(locale)

    const segments = pathname.split("/")
    const first = segments[1]
    const nextSegments = [...segments]

    if (first && hasLocale(first)) {
      nextSegments[1] = locale
    } else {
      nextSegments.splice(1, 0, locale)
    }

    const nextPath = nextSegments.join("/") || "/"
    router.replace(`${nextPath}${search}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {currentLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => switchTo(locale)}
            disabled={locale === currentLocale}
          >
            {languageNames[locale] ?? locale.toUpperCase()}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
