"use client"

import { useForm, Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { signIn, getSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Eye, EyeOff } from "lucide-react"

import Link from "next/link"
import { whatsappConfig } from "@/lib/whatsapp-config"

const adminSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
})

const staffSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

interface LoginFormProps {
  type: "admin" | "staff"
  allowDemo?: boolean
}

export function LoginForm({ type, allowDemo = false }: LoginFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [demoEmail, setDemoEmail] = useState("")

  const schema = type === "admin" ? adminSchema : staffSchema
  
  type FormValues = {
      username?: string;
      email?: string;
      password?: string;
  }

  const form = useForm<FormValues>({
    
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: FormValues) {
    setIsLoading(true)
    try {
      const result = await signIn("credentials", {
        redirect: false,
        username: values.username,
        email: values.email,
        password: values.password,
      })

      if (result?.error) {
        toast.error("Invalid credentials")
      } else {
        toast.success("Logged in successfully")
        
        // Fetch current session to determine role
        const session = await getSession()
        const userRole = session?.user?.role
        
        // Determine redirect URL based on role
        let redirectUrl = searchParams.get("callbackUrl")
        
        if (!redirectUrl) {
          if (userRole === "admin") {
            redirectUrl = "/admin/dashboard"
          } else if (userRole === "attendance_staff") {
            redirectUrl = "/attendance/dashboard"
          } else {
            redirectUrl = "/dashboard"
          }
        }
        
        router.push(redirectUrl)
        router.refresh()
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  async function onDemoLogin() {
    setIsLoading(true)
    try {
      const email =
        type === "staff" ? (form.getValues("email") || "").trim() : demoEmail.trim()
      if (!email) {
        toast.error("Enter demo email")
        return
      }
      const result = await signIn("credentials", {
        redirect: false,
        demo: "true",
        email,
      })

      if (result?.error) {
        toast.error("Invalid demo email")
      } else {
        router.push("/demo/access-as")
        router.refresh()
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{type === "admin" ? "Admin Login" : "Staff Login"}</CardTitle>
        <CardDescription>
          Enter your credentials to access the {type === "admin" ? "admin panel" : "dashboard"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {type === "admin" ? (
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Admin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="staff@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                  <div className="text-right">
                    <Link href="/forgot-password" title="Forgot Password" className="text-sm text-primary hover:underline">
                      Forgot Password?
                    </Link>
                  </div>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
            {allowDemo && (
              <>
                {type === "admin" && (
                  <div className="space-y-2">
                    <FormLabel>Demo Email</FormLabel>
                    <Input
                      placeholder="demo@example.com"
                      value={demoEmail}
                      onChange={(e) => setDemoEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                )}
                <Button type="button" variant="outline" className="w-full" disabled={isLoading} onClick={onDemoLogin}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Demo Login
                </Button>
              </>
            )}
            <div className="text-center text-sm">
              {type === "admin" ? (
                <Link href="/login" className="underline underline-offset-4 hover:text-primary">
                  Staff Login
                </Link>
              ) : (
                <Link href="/admin/login" className="underline underline-offset-4 hover:text-primary">
                  Admin Login
                </Link>
              )}
            </div>
          </form>
        </Form>
        {(() => {
          const isEnabled = whatsappConfig.enableParentLogin || 
                            whatsappConfig.enableTeacherLogin || 
                            process.env.NEXT_PUBLIC_ENABLE_PARENT_LOGIN === 'true' ||
                            process.env.NEXT_PUBLIC_ENABLE_TEACHER_LOGIN === 'true';
          
          if (process.env.NODE_ENV === 'development') {
            console.log('WhatsApp Button Check:', { 
              configParent: whatsappConfig.enableParentLogin,
              configTeacher: whatsappConfig.enableTeacherLogin,
              envParent: process.env.NEXT_PUBLIC_ENABLE_PARENT_LOGIN,
              envTeacher: process.env.NEXT_PUBLIC_ENABLE_TEACHER_LOGIN,
              finalResult: isEnabled
            });
          }

          if (!isEnabled) return null;

          return (
            <div className="mt-4 pt-4 border-t border-border flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground text-center">
                Parent or Teacher?
              </p>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/login/otp">Login with WhatsApp OTP</Link>
              </Button>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  )
}
