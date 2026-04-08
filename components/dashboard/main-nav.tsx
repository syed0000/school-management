"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { whatsappConfig } from "@/lib/whatsapp-config"
import { defaultLocale, hasLocale, type Locale } from "@/lib/i18n"
import { withLocale } from "@/lib/locale-path"
import { useI18n } from "@/components/i18n-provider"

export function MainNav({
  className,
  role,
  mobileOnly = false,
  desktopOnly = false,
  ...props
}: React.HTMLAttributes<HTMLElement> & { 
  role: "admin" | "staff",
  mobileOnly?: boolean,
  desktopOnly?: boolean 
}) {
  const { t } = useI18n()
  const pathname = usePathname()
  const params = useParams<{ lang?: string }>()
  const lang = hasLocale(params.lang ?? "") ? (params.lang as Locale) : defaultLocale
  const base = `/${lang}`
  const normalizedPathname = pathname?.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname
  const [open, setOpen] = useState(false)

  const adminRoutes = [
    {
      href: "/admin/dashboard",
      label: t("nav.overview", "Overview"),
      active: normalizedPathname === "/admin/dashboard",
    },
    {
      href: "/admin/staff",
      label: t("nav.staff", "Staff"),
      active: normalizedPathname.startsWith("/admin/staff"),
    },
    {
      href: "/admin/classes",
      label: t("nav.classes", "Classes"),
      active: normalizedPathname.startsWith("/admin/classes"),
    },
    {
      href: "/admin/students/migration",
      label: t("nav.migration", "Migration"),
      active: normalizedPathname.startsWith("/admin/students/migration"),
    },
    {
      href: "/admin/students/import",
      label: t("nav.import", "Import"),
      active: normalizedPathname.startsWith("/admin/students/import"),
    },
    {
      href: "/admin/fees/verify",
      label: t("nav.feeVerification", "Fee Verification"),
      active: normalizedPathname.startsWith("/admin/fees/verify"),
    },
    {
      href: "/fees/collect",
      label: t("nav.collectFee", "Collect Fee"),
      active: normalizedPathname.startsWith("/fees/collect"),
    },
    {
      href: "/fees/transactions",
      label: t("nav.transactions", "Transactions"),
      active: normalizedPathname.startsWith("/fees/transactions"),
    },
    {
      href: "/students/admit",
      label: t("nav.admitStudent", "Admit Student"),
      active: normalizedPathname.startsWith("/students/admit"),
    },
    {
      href: "/students/list",
      label: t("nav.students", "Students"),
      active: normalizedPathname.startsWith("/students/list"),
    },
    {
      href: "/id-cards/generate",
      label: t("nav.idCards", "ID Cards"),
      active: normalizedPathname.startsWith("/id-cards/generate"),
    },
    {
      href: "/admin/expenses",
      label: t("nav.expenses", "Expenses"),
      active: normalizedPathname.startsWith("/admin/expenses"),
    },
    {
      href: "/admin/teachers",
      label: t("nav.teachers", "Teachers"),
      active: normalizedPathname.startsWith("/admin/teachers"),
    },
    {
      href: "/admin/reports",
      label: t("nav.reports", "Reports"),
      active: normalizedPathname.startsWith("/admin/reports"),
    },
    ...(whatsappConfig.enabled ? [{
      href: "/whatsapp",
      label: t("nav.notifications", "Notifications"),
      active: normalizedPathname.startsWith("/whatsapp"),
    }] : []),
    {
      href: "/attendance/dashboard",
      label: t("nav.attendance", "Attendance"),
      active: normalizedPathname.startsWith("/attendance/dashboard"),
    },
    {
      href: "/share",
      label: t("nav.shareApp", "Share App"),
      active: normalizedPathname === "/share",
    },
  ]

  const staffRoutes = [
    {
      href: "/dashboard",
      label: t("nav.overview", "Overview"),
      active: normalizedPathname === "/dashboard",
    },
    {
      href: "/students/admit",
      label: t("nav.admitStudent", "Admit Student"),
      active: normalizedPathname.startsWith("/students/admit"),
    },
    {
      href: "/students/list",
      label: t("nav.students", "Students"),
      active: normalizedPathname.startsWith("/students/list"),
    },
    {
      href: "/fees/collect",
      label: t("nav.collectFee", "Collect Fee"),
      active: normalizedPathname.startsWith("/fees/collect"),
    },
    {
      href: "/fees/transactions",
      label: t("nav.transactions", "Transactions"),
      active: normalizedPathname.startsWith("/fees/transactions"),
    },
    {
      href: "/id-cards/generate",
      label: t("nav.idCards", "ID Cards"),
      active: normalizedPathname.startsWith("/id-cards/generate"),
    },
    {
      href: "/teachers",
      label: t("nav.teachers", "Teachers"),
      active: normalizedPathname.startsWith("/teachers"),
    },
    {
      href: "/admin/expenses",
      label: t("nav.expenses", "Expenses"),
      active: normalizedPathname.startsWith("/admin/expenses"),
    },
    ...(whatsappConfig.enabled ? [{
      href: "/whatsapp",
      label: t("nav.notifications", "Notifications"),
      active: normalizedPathname.startsWith("/whatsapp"),
    }] : []),
    {
      href: "/share",
      label: t("nav.shareApp", "Share App"),
      active: normalizedPathname === "/share",
    },
  ]

  const routes = role === "admin" ? adminRoutes : staffRoutes

  return (
    <>
      {/* Desktop Navigation */}
      {!mobileOnly && (
        <nav
          className={cn("flex items-center space-x-4 lg:space-x-6 whitespace-nowrap overflow-x-auto", className)}
          {...props}
        >
          {routes.map((route) => (
            <Link
              key={route.href}
              href={withLocale(lang, route.href)}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary shrink-0",
                route.active
                  ? "dark:text-primary"
                  : "text-muted-foreground"
              )}
            >
              {route.label}
            </Link>
          ))}
        </nav>
      )}

      {/* Mobile Navigation */}
      {!desktopOnly && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-2 lg:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">{t("nav.toggleMenu", "Toggle menu")}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[400px] pr-0">
            <SheetHeader className="px-1 text-left">
              <SheetTitle>{t("nav.menu", "Menu")}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col space-y-3 mt-4 h-full pb-10 overflow-y-auto pl-1 pr-6">
              {routes.map((route) => (
                <Link
                  key={route.href}
                  href={withLocale(lang, route.href)}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-primary py-2 px-2 rounded-md hover:bg-muted",
                    route.active
                      ? "text-black dark:text-white bg-muted"
                      : "text-muted-foreground"
                  )}
                >
                  {route.label}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
