"use client"

import { useMemo, useState } from "react"
import { useForm, Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
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
import { updateProfile } from "@/actions/profile"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"

interface ProfileFormProps {
  user: {
    name: string
    email: string
    phone?: string
    role?: string
  }
}

export function ProfileForm({ user }: ProfileFormProps) {
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const profileFormSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, t("profile.validationNameMin", "Name must be at least 2 characters")),
        email: z.string().email(t("profile.validationEmailInvalid", "Invalid email address")),
        phone: z
          .string()
          .min(10, t("profile.validationPhoneMin", "Phone number must be at least 10 digits"))
          .max(12, t("profile.validationPhoneInvalid", "Invalid phone number")),
      }),
    [t]
  )

  const passwordFormSchema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t("profile.validationCurrentPasswordRequired", "Current password is required")),
          newPassword: z.string().min(6, t("profile.validationPasswordMin", "Password must be at least 6 characters")),
          confirmPassword: z.string().min(6, t("profile.validationPasswordMin", "Password must be at least 6 characters")),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: t("profile.validationPasswordsMismatch", "Passwords do not match"),
          path: ["confirmPassword"],
        }),
    [t]
  )

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    
    resolver: zodResolver(profileFormSchema) as Resolver<z.infer<typeof profileFormSchema>>,
    defaultValues: {
      name: user.name,
      email: user.email,
      phone: user.phone || "",
    },
  })

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    
    resolver: zodResolver(passwordFormSchema) as Resolver<z.infer<typeof passwordFormSchema>>,
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  async function onProfileSubmit(data: z.infer<typeof profileFormSchema>) {
    setIsLoading(true)
    try {
      const result = await updateProfile({
          name: data.name,
          email: data.email,
          phone: data.phone
      })

      if (result.success) {
        toast.success(t("profile.toastProfileUpdated", "Profile updated successfully"))
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error(t("profile.toastProfileUpdateFailed", "Failed to update profile"), {
        description: error instanceof Error ? error.message : t("profile.unknownError", "Unknown error"),
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function onPasswordSubmit(data: z.infer<typeof passwordFormSchema>) {
    setIsLoading(true)
    try {
      // For password update, we DON'T need to send name/email if the backend supports partial updates
      // The updated backend action now accepts optional fields.
      
      const result = await updateProfile({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
          confirmPassword: data.confirmPassword
      })

      if (result.success) {
        toast.success(t("profile.toastPasswordUpdated", "Password updated successfully"))
        passwordForm.reset()
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error(t("profile.toastPasswordUpdateFailed", "Failed to update password"), {
        description: error instanceof Error ? error.message : t("profile.unknownError", "Unknown error"),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("profile.detailsTitle", "Profile Details")}</CardTitle>
          <CardDescription>{t("profile.detailsSubtitle", "Update your personal information.")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              <FormField
                control={profileForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.nameLabel", "Name")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("profile.namePlaceholder", "Your name")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.emailLabel", "Email")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("profile.emailPlaceholder", "email@example.com")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.whatsappLabel", "WhatsApp Number")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("profile.whatsappPlaceholder", "10-digit number")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("profile.saveChanges", "Save Changes")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {!['teacher', 'parent'].includes(user.role || '') && (
        <Card>
        <CardHeader>
          <CardTitle>{t("profile.changePasswordTitle", "Change Password")}</CardTitle>
          <CardDescription>{t("profile.changePasswordSubtitle", "Update your password to keep your account secure.")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.currentPassword", "Current Password")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showCurrent ? "text" : "password"} placeholder={t("profile.passwordPlaceholder", "********")} {...field} />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowCurrent(!showCurrent)}
                        >
                            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.newPassword", "New Password")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showNew ? "text" : "password"} placeholder={t("profile.passwordPlaceholder", "********")} {...field} />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowNew(!showNew)}
                        >
                            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.confirmPassword", "Confirm Password")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showConfirm ? "text" : "password"} placeholder={t("profile.passwordPlaceholder", "********")} {...field} />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowConfirm(!showConfirm)}
                        >
                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("profile.updatePassword", "Update Password")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      )}
    </div>
  )
}
