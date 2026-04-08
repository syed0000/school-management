import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSwitcher } from "@/components/language-switcher"
import { getDictionary } from "@/lib/dictionaries"
import { hasLocale, type Locale } from "@/lib/i18n"
import { notFound } from "next/navigation"

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const locale: Locale = lang
  const dict = await getDictionary(locale)

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-end gap-2">
          <LanguageSwitcher
            currentLocale={locale}
            languageNames={{
              en: dict?.language?.en ?? "English",
              hi: dict?.language?.hi ?? "Hindi",
              ur: dict?.language?.ur ?? "Urdu",
            }}
          />
          <ThemeToggle />
        </div>
      </div>
      {children}
    </div>
  )
}
