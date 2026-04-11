import { LoginForm } from "@/components/auth/login-form"
import { AuthBranding } from "@/components/auth/auth-branding"
import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { demoConfig } from "@/lib/demo-config"
import type { Locale } from "@/lib/i18n"
import { withLocale } from "@/lib/locale-path"
import { dictString, getDictionary } from "@/lib/dictionaries"

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ lang: Locale }>
}) {
  const { lang } = await params
  const dict = await getDictionary(lang)

  const session = await getServerSession(authOptions)

  if (session) {
    if (session.user.role === "admin") {
      redirect(withLocale(lang, "/admin/dashboard"))
    } else if (session.user.role === "attendance_staff") {
      redirect(withLocale(lang, "/attendance/dashboard"))
    } else {
      redirect(withLocale(lang, "/dashboard"))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md space-y-6">
        <AuthBranding subtitle={dictString(dict, "auth.adminPortal", "Admin Portal")} />
        <Suspense fallback={<div>{dictString(dict, "common.loading", "Loading...")}</div>}>
          <LoginForm type="admin" allowDemo={demoConfig.adminInstitute} />
        </Suspense>
      </div>
    </div>
  )
}
