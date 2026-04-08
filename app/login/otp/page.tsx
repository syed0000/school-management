import { OtpLoginForm } from "@/components/auth/otp-login-form"
import { AuthBranding } from "@/components/auth/auth-branding"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "OTP Login | Institute Management",
  description: "Login using WhatsApp OTP",
}

export default function OtpLoginPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <AuthBranding subtitle="Teacher & Parent Portal" />
        </div>
        <OtpLoginForm />
        <div className="mt-6 text-center text-sm">
          <p className="text-muted-foreground">
            Management or Admin? <a href="/login" className="text-primary hover:underline font-medium">Standard Login</a>
          </p>
        </div>
      </div>
    </div>
  )
}
