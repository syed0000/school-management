import { OtpLoginForm } from "@/components/auth/otp-login-form"
import { schoolConfig } from "@/lib/config"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "OTP Login | School Management",
  description: "Login using WhatsApp OTP",
}

export default function OtpLoginPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center space-y-2 text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl text-primary">{schoolConfig.name}</h1>
          <p className="text-muted-foreground">Teacher & Parent Portal</p>
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
