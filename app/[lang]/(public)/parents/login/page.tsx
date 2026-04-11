import { OtpLoginForm } from "@/components/auth/otp-login-form"
import { AuthBranding } from "@/components/auth/auth-branding"
import { dictString, getDictionary } from "@/lib/dictionaries"
import type { Locale } from "@/lib/i18n"
import { withLocale } from "@/lib/locale-path"
import { whatsappConfig } from "@/lib/whatsapp-config"

export const dynamic = "force-dynamic"

export default async function ParentLoginPage({
  params,
}: {
  params: Promise<{ lang: Locale }>
}) {
  const { lang } = await params
  const dict = await getDictionary(lang)

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <AuthBranding subtitle={dictString(dict, "authOtp.parentPortalSubtitle", "Parent/Student Portal")} />
        </div>
        <OtpLoginForm forcedRole="parent" />
        <div className="mt-6 text-center text-sm space-y-2">
          {whatsappConfig.enableTeacherLogin && (
            <p className="text-muted-foreground">
              {dictString(dict, "authOtp.teacherPortalCta", "Teacher?")}{" "}
              <a href={withLocale(lang, "/teachers/login")} className="text-primary hover:underline font-medium">
                {dictString(dict, "authOtp.teacherLogin", "Teacher Login")}
              </a>
            </p>
          )}
          <p className="text-muted-foreground">
            {dictString(dict, "authOtp.managementOrAdmin", "Management or Admin?")}{" "}
            <a href={withLocale(lang, "/login")} className="text-primary hover:underline font-medium">
              {dictString(dict, "authOtp.standardLogin", "Staff Login")}
            </a>
            {" · "}
            <a href={withLocale(lang, "/admin/login")} className="text-primary hover:underline font-medium">
              {dictString(dict, "authOtp.adminLogin", "Admin Login")}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
