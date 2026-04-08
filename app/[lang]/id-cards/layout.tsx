import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/lib/auth"
import { withLocale } from "@/lib/locale-path"
import type { Locale } from "@/lib/i18n"
import { getDictionary } from "@/lib/dictionaries"

import { AppLogo } from "@/components/ui/app-logo"
import { MainNav } from "@/components/dashboard/main-nav"
import { UserNav } from "@/components/dashboard/user-nav"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSwitcher } from "@/components/language-switcher"

export const dynamic = "force-dynamic"

export default async function IdCardsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: Locale }>
}) {
  const { lang } = await params
  const dict = await getDictionary(lang)

  const session = await getServerSession(authOptions)
  if (!session) redirect(withLocale(lang, "/login"))

  if (session.user.role === "attendance_staff") redirect(withLocale(lang, "/attendance/dashboard"))
  if (session.user.role === "parent") redirect(withLocale(lang, "/parent/dashboard"))
  if (session.user.role === "teacher") redirect(withLocale(lang, "/teacher/dashboard"))

  const navRole = session.user.role === "admin" ? "admin" : "staff"
  const homeHref = navRole === "admin" ? "/admin/dashboard" : "/dashboard"

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-16 items-center px-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <MainNav role={navRole} mobileOnly />
            </div>
            <AppLogo href={withLocale(lang, homeHref)} />
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSwitcher
              currentLocale={lang}
              languageNames={{
                en: dict?.language?.en ?? "English",
                hi: dict?.language?.hi ?? "Hindi",
                ur: dict?.language?.ur ?? "Urdu",
              }}
            />
            <ThemeToggle />
            <UserNav user={session.user} />
          </div>
        </div>
      </header>

      <div className="hidden lg:block border-y bg-muted sticky top-16 z-10 w-full">
        <div className="overflow-x-auto no-scrollbar py-2 px-4">
          <MainNav role={navRole} desktopOnly />
        </div>
      </div>

      <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">{children}</main>
    </div>
  )
}

