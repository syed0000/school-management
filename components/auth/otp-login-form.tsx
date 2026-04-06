"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
import { Loader2, Smartphone, KeyRound, RefreshCw, Clock } from "lucide-react"
import { whatsappConfig } from "@/lib/whatsapp-config"

const FIRST_RESEND_DELAY = 60        // 1 minute before first resend
const SUBSEQUENT_RESEND_DELAY = 300  // 5 minutes for subsequent resends

const phoneSchema = z.object({
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(12, "Invalid phone number"),
})

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
})

function formatCountdown(seconds: number) {
  if (seconds <= 0) return ""
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`
  return `${s}s`
}

export function OtpLoginForm() {
  const { enableParentLogin, enableTeacherLogin } = whatsappConfig

  const defaultRole = enableParentLogin ? "parent" : "teacher"

  const [step, setStep] = useState<"phone" | "otp">("phone")
  const [loading, setLoading] = useState(false)
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState<"teacher" | "parent">(defaultRole)
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || (defaultRole === 'teacher' ? '/teacher/dashboard' : '/parent/dashboard')

  // Resend cooldown state
  // countdown = seconds remaining before resend is allowed
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  const startCountdown = useCallback((seconds: number) => {
    clearCountdown()
    setCountdown(seconds)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          countdownRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [clearCountdown])

  // Clean up on unmount
  useEffect(() => () => clearCountdown(), [clearCountdown])

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  })

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  })

  async function sendOtp(phoneNumber: string) {
    setLoading(true)
    try {
      const res = await requestOtp(phoneNumber, role)
      if (res.success) {
        // After any successful send, lock for 5 minutes
        startCountdown(SUBSEQUENT_RESEND_DELAY)
        return true
      } else {
        // Server told us to wait — pre-seed the countdown
        if ((res as any).retryAfterSeconds) {
          startCountdown((res as any).retryAfterSeconds)
        }
        toast.error(res.error)
        return false
      }
    } catch {
      toast.error("Failed to send OTP")
      return false
    } finally {
      setLoading(false)
    }
  }

  async function onPhoneSubmit(values: z.infer<typeof phoneSchema>) {
    const ok = await sendOtp(values.phone)
    if (ok) {
      setPhone(values.phone)
      // First resend available after 1 minute; subsequent ones after 5 minutes
      startCountdown(FIRST_RESEND_DELAY)
      setStep("otp")
      toast.success("OTP sent to your WhatsApp")
    }
  }

  async function handleResend() {
    if (countdown > 0 || loading) return
    const ok = await sendOtp(phone)
    if (ok) {
      toast.success("OTP resent successfully")
      otpForm.reset()
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
    } catch {
      toast.error("Login failed")
    } finally {
      setLoading(false)
    }
  }

  const canResend = countdown === 0 && !loading

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
            WhatsApp OTP login is currently disabled for this institute.
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
                  {/* Header info */}
                  <div className="text-center mb-2 space-y-1">
                    <p className="text-sm text-muted-foreground">OTP sent to <span className="font-semibold text-foreground">{phone}</span></p>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => { setStep("phone"); clearCountdown(); setCountdown(0) }}
                      className="h-auto p-0 text-xs"
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
                            <Input
                              placeholder="000000"
                              {...field}
                              className="pl-9 tracking-[0.5em] text-center font-bold text-lg"
                              maxLength={6}
                              inputMode="numeric"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Verify &amp; Login
                  </Button>

                  {/* Resend OTP */}
                  <div className="flex items-center justify-center pt-1">
                    {countdown > 0 ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Resend available in{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatCountdown(countdown)}
                        </span>
                      </p>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto py-1 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                        onClick={handleResend}
                        disabled={!canResend}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                        Resend OTP
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
