"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { whatsappConfig } from "@/lib/whatsapp-config"

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
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const adminRoutes = [
    {
      href: "/admin/dashboard",
      label: "Overview",
      active: pathname === "/admin/dashboard",
    },
    {
      href: "/admin/staff",
      label: "Staff",
      active: pathname.startsWith("/admin/staff"),
    },
    {
      href: "/admin/classes",
      label: "Classes",
      active: pathname.startsWith("/admin/classes"),
    },
    {
      href: "/admin/students/migration",
      label: "Migration",
      active: pathname.startsWith("/admin/students/migration"),
    },
    {
      href: "/admin/students/import",
      label: "Import",
      active: pathname.startsWith("/admin/students/import"),
    },
    {
      href: "/admin/fees/verify",
      label: "Fee Verification",
      active: pathname.startsWith("/admin/fees/verify"),
    },
    {
      href: "/fees/collect",
      label: "Collect Fee",
      active: pathname.startsWith("/fees/collect"),
    },
    {
      href: "/fees/transactions",
      label: "Transactions",
      active: pathname.startsWith("/fees/transactions"),
    },
    {
      href: "/students/admit",
      label: "Admit Student",
      active: pathname.startsWith("/students/admit"),
    },
    {
      href: "/students/list",
      label: "Students",
      active: pathname.startsWith("/students/list"),
    },
    {
      href: "/id-cards/generate",
      label: "ID Cards",
      active: pathname.startsWith("/id-cards/generate"),
    },
    {
      href: "/admin/expenses",
      label: "Expenses",
      active: pathname.startsWith("/admin/expenses"),
    },
    {
      href: "/admin/teachers",
      label: "Teachers",
      active: pathname.startsWith("/admin/teachers"),
    },
    {
      href: "/admin/reports",
      label: "Reports",
      active: pathname.startsWith("/admin/reports"),
    },
    ...(whatsappConfig.enabled ? [{
      href: "/whatsapp",
      label: "WhatsApp",
      active: pathname.startsWith("/whatsapp"),
    }] : []),
    {
      href: "/attendance/dashboard",
      label: "Attendance",
      active: pathname.startsWith("/attendance/dashboard"),
    },
    {
      href: "/share",
      label: "Share App",
      active: pathname === "/share",
    },
  ]

  const staffRoutes = [
    {
      href: "/dashboard",
      label: "Overview",
      active: pathname === "/dashboard",
    },
    {
      href: "/students/admit",
      label: "Admit Student",
      active: pathname.startsWith("/students/admit"),
    },
    {
      href: "/students/list",
      label: "Students",
      active: pathname.startsWith("/students/list"),
    },
    {
      href: "/fees/collect",
      label: "Collect Fee",
      active: pathname.startsWith("/fees/collect"),
    },
    {
      href: "/fees/transactions",
      label: "Transactions",
      active: pathname.startsWith("/fees/transactions"),
    },
    {
      href: "/id-cards/generate",
      label: "ID Cards",
      active: pathname.startsWith("/id-cards/generate"),
    },
    {
      href: "/teachers",
      label: "Teachers",
      active: pathname.startsWith("/teachers"),
    },
    {
      href: "/admin/expenses",
      label: "Expenses",
      active: pathname.startsWith("/admin/expenses"),
    },
    ...(whatsappConfig.enabled ? [{
      href: "/whatsapp",
      label: "WhatsApp",
      active: pathname.startsWith("/whatsapp"),
    }] : []),
    {
      href: "/share",
      label: "Share App",
      active: pathname === "/share",
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
              href={route.href}
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
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[400px] pr-0">
            <SheetHeader className="px-1 text-left">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col space-y-3 mt-4 h-full pb-10 overflow-y-auto pl-1 pr-6">
              {routes.map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
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
