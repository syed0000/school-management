import { OtpLoginForm } from "@/components/auth/otp-login-form"
import { AuthBranding } from "@/components/auth/auth-branding"
import type { Metadata } from "next"
import { getDictionary } from "@/lib/dictionaries"
import type { Locale } from "@/lib/i18n"
import { withLocale } from "@/lib/locale-path"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Locale }>
}): Promise<Metadata> {
  const { lang } = await params
  const dict = await getDictionary(lang)
  return {
    title: dict?.authOtp?.metaTitle ?? "OTP Login | Institute Management",
    description: dict?.authOtp?.metaDescription ?? "Login using WhatsApp OTP",
  }
}

export default async function OtpLoginPage({
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
          <AuthBranding subtitle={dict?.authOtp?.brandingSubtitle ?? "Teacher & Parent Portal"} />
        </div>
        <OtpLoginForm />
        <div className="mt-6 text-center text-sm">
          <p className="text-muted-foreground">
            {dict?.authOtp?.managementOrAdmin ?? "Management or Admin?"}{" "}
            <a href={withLocale(lang, "/login")} className="text-primary hover:underline font-medium">
              {dict?.authOtp?.standardLogin ?? "Standard Login"}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
