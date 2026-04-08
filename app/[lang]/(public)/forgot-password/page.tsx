"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { requestForgotPasswordOtp, verifyOtpAndResetPassword } from "@/actions/forgot-password";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Smartphone, KeyRound, Lock, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { defaultLocale, hasLocale } from "@/lib/i18n";
import { withLocale } from "@/lib/locale-path";
import { useI18n } from "@/components/i18n-provider";

function ForgotPasswordForm() {
  const [step, setStep] = useState<"phone" | "reset">("phone");
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const lang = hasLocale(params.lang ?? "") ? (params.lang as string) : defaultLocale;
  const { t } = useI18n();

  const phoneSchema = useMemo(
    () =>
      z.object({
        phone: z
          .string()
          .min(10, t("authForgot.validationPhoneMin", "Phone number must be at least 10 digits"))
          .max(12, t("authForgot.validationPhoneInvalid", "Invalid phone number")),
      }),
    [t]
  );

  const resetSchema = useMemo(
    () =>
      z
        .object({
          otp: z.string().length(6, t("authForgot.validationOtpLength", "OTP must be 6 digits")),
          password: z.string().min(6, t("authForgot.validationPasswordMin", "Password must be at least 6 characters")),
          confirmPassword: z.string().min(6, t("authForgot.validationPasswordMin", "Password must be at least 6 characters")),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t("authForgot.validationPasswordsMismatch", "Passwords do not match"),
          path: ["confirmPassword"],
        }),
    [t]
  );

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { otp: "", password: "", confirmPassword: "" },
  });

  async function onPhoneSubmit(values: z.infer<typeof phoneSchema>) {
    setLoading(true);
    try {
      const res = await requestForgotPasswordOtp(values.phone);
      if (res.success) {
        setPhone(values.phone);
        setStep("reset");
        toast.success(res.message);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error(t("authForgot.toastSendFailed", "Failed to send OTP"));
    } finally {
      setLoading(false);
    }
  }

  async function onResetSubmit(values: z.infer<typeof resetSchema>) {
    setLoading(true);
    try {
      const res = await verifyOtpAndResetPassword(phone, values.otp, values.password);
      if (res.success) {
        toast.success(res.message);
        router.push(withLocale(lang, "/login"));
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error(t("authForgot.toastResetFailed", "Failed to reset password"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-xl border-t-4 border-t-primary">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">{t("authForgot.title", "Account Recovery")}</CardTitle>
        <CardDescription>
          {t("authForgot.subtitle", "Reset your password using WhatsApp OTP")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "phone" ? (
          <Form {...phoneForm}>
            <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
              <FormField
                control={phoneForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("authForgot.phoneLabel", "Registered WhatsApp Number")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input placeholder={t("authForgot.phonePlaceholder", "Enter 10-digit number")} {...field} className="pl-9" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t("authForgot.sendResetOtp", "Send Reset OTP")}
              </Button>
              <div className="text-center text-sm">
                <Link href={withLocale(lang, "/login")} className="text-primary hover:underline">
                  {t("authForgot.backToLogin", "Back to Login")}
                </Link>
              </div>
            </form>
          </Form>
        ) : (
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">
                  {t("authForgot.otpSentToPrefix", "OTP sent to")} {phone}
                </p>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => setStep("phone")} 
                  className="h-auto p-0"
                  type="button"
                >
                  {t("authForgot.changeNumber", "Change number")}
                </Button>
              </div>
              
              <FormField
                control={resetForm.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("authForgot.otpLabel", "6-Digit OTP")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input placeholder={t("authForgot.otpPlaceholder", "000000")} {...field} className="pl-9 tracking-[0.5em] text-center font-bold text-lg" maxLength={6} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={resetForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("authForgot.newPassword", "New Password")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder={t("authForgot.passwordPlaceholder", "******")} 
                            {...field} 
                            className="pl-9" 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={resetForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("authForgot.confirmPassword", "Confirm Password")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder={t("authForgot.passwordPlaceholder", "******")} 
                            {...field} 
                            className="pl-9" 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t("authForgot.verifyReset", "Verify & Reset Password")}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <ForgotPasswordForm />
    </div>
  );
}
