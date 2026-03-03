"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export function MainNav({
  className,
  role,
  ...props
}: React.HTMLAttributes<HTMLElement> & { role: "admin" | "staff" }) {
  const pathname = usePathname()

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
    {
      href: "/attendance/dashboard",
      label: "Attendance",
      active: pathname.startsWith("/attendance/dashboard"),
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
  ]

  const routes = role === "admin" ? adminRoutes : staffRoutes

  return (
    <nav
      className={cn("flex items-center space-x-4 lg:space-x-6 whitespace-nowrap", className)}
      {...props}
    >
      {routes.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            route.active
              ? "text-black dark:text-white"
              : "text-muted-foreground"
          )}
        >
          {route.label}
        </Link>
      ))}
    </nav>
  )
}
