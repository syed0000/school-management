"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { requestOtp } from "@/actions/auth-otp"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Smartphone, KeyRound } from "lucide-react"

import { whatsappConfig } from "@/lib/whatsapp-config"

const phoneSchema = z.object({
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(12, "Invalid phone number"),
})

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
})

export function OtpLoginForm() {
  const { enableParentLogin, enableTeacherLogin } = whatsappConfig;
  
  const defaultRole = enableParentLogin ? "parent" : "teacher";
  
  const [step, setStep] = useState<"phone" | "otp">("phone")
  const [loading, setLoading] = useState(false)
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState<"teacher" | "parent">(defaultRole)
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || (defaultRole === 'teacher' ? '/teacher/dashboard' : '/parent/dashboard')

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  })

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  })

  async function onPhoneSubmit(values: z.infer<typeof phoneSchema>) {
    setLoading(true)
    try {
      const res = await requestOtp(values.phone, role)
      if (res.success) {
        setPhone(values.phone)
        setStep("otp")
        toast.success(res.message)
      } else {
        toast.error(res.error)
      }
    } catch (error) {
      toast.error("Failed to send OTP")
    } finally {
      setLoading(false)
    }
  }

  async function onOtpSubmit(values: z.infer<typeof otpSchema>) {
    setLoading(true)
    try {
      const result = await signIn("credentials", {
        phone: phone,
        otp: values.otp,
        role: role,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Logged in successfully")
        router.push(role === 'teacher' ? '/teacher/dashboard' : '/parent/dashboard')
        router.refresh()
      }
    } catch (error) {
      toast.error("Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-xl border-t-4 border-t-primary">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
        <CardDescription>
          Login to your account using WhatsApp OTP
        </CardDescription>
      </CardHeader>
      <CardContent>
        {enableParentLogin && enableTeacherLogin && (
          <Tabs value={role} onValueChange={(v) => setRole(v as any)} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="parent">Parent</TabsTrigger>
              <TabsTrigger value="teacher">Teacher</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        
        {!enableParentLogin && !enableTeacherLogin && (
          <div className="text-center py-6 text-destructive font-medium">
             WhatsApp OTP login is currently disabled for this school.
          </div>
        )}

        {(enableParentLogin || enableTeacherLogin) && (
          <>
            {step === "phone" ? (
          <Form {...phoneForm}>
            <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
              <FormField
                control={phoneForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Enter 10-digit number" {...field} className="pl-9" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send OTP
              </Button>
            </form>
          </Form>
        ) : (
          <Form {...otpForm}>
            <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">OTP sent to {phone}</p>
                <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => setStep("phone")} 
                    className="h-auto p-0"
                >
                    Change number
                </Button>
              </div>
              <FormField
                control={otpForm.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>6-Digit OTP</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="000000" {...field} className="pl-9 tracking-[0.5em] text-center font-bold text-lg" maxLength={6} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify & Login
              </Button>
            </form>
          </Form>
        )}
      </>
    )}
      </CardContent>
    </Card>
  )
}
