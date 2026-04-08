"use client"

import { useRouter } from "next/navigation"
import { useForm, SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Plus, Loader2 } from "lucide-react"
import { createDemoUser, createStaff } from "@/actions/admin"
import { useI18n } from "@/components/i18n-provider"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function CreateStaffDialog({ allowDemo = false }: { allowDemo?: boolean }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { t } = useI18n()

  const staffSchema = useMemo(
    () =>
      z.object({
        userType: z.literal("staff"),
        name: z.string().min(1, t("adminStaff.validationNameRequired", "Name is required")),
        email: z.string().email(t("adminStaff.validationEmailInvalid", "Invalid email")),
        phone: z
          .string()
          .min(10, t("adminStaff.validationPhoneMin", "Phone number must be at least 10 digits"))
          .max(12, t("adminStaff.validationPhoneInvalid", "Invalid phone number")),
        password: z.string().min(6, t("adminStaff.validationPasswordMin", "Password must be at least 6 characters")),
        role: z.enum(["staff", "attendance_staff"]),
      }),
    [t]
  )

  const demoSchema = useMemo(
    () =>
      z.object({
        userType: z.literal("demo"),
        name: z.string().min(1, t("adminStaff.validationNameRequired", "Name is required")),
        email: z.string().email(t("adminStaff.validationEmailInvalid", "Invalid email")),
      }),
    [t]
  )

  const formSchema = useMemo(() => z.union([staffSchema, demoSchema]), [staffSchema, demoSchema])

  type StaffFormValues = z.infer<typeof formSchema>

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userType: "staff",
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "staff",
    },
  })

  const onSubmit: SubmitHandler<StaffFormValues> = async (values) => {
    setIsLoading(true)
    try {
      const result =
        values.userType === "demo"
          ? await createDemoUser({ name: values.name, email: values.email })
          : await createStaff(values)
      if (result.success) {
        toast.success(
          values.userType === "demo"
            ? t("adminStaff.toastDemoCreated", "Demo user created")
            : t("adminStaff.toastStaffCreated", "Staff member created successfully")
        )
        setOpen(false)
        form.reset()
        router.refresh()
      } else {
        toast.error(result.error || t("adminStaff.toastFailed", "Failed"))
      }
    } catch {
      toast.error(t("adminStaff.toastSomethingWentWrong", "Something went wrong"))
    } finally {
      setIsLoading(false)
    }
  }

  const userType = form.watch("userType")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("adminStaff.addStaff", "Add Staff")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {userType === "demo" ? t("adminStaff.addDemoUser", "Add Demo User") : t("adminStaff.addStaffMember", "Add Staff Member")}
          </DialogTitle>
          <DialogDescription>
            {userType === "demo"
              ? t(
                  "adminStaff.demoDescription",
                  "Demo users can log in without credentials and can access all areas in view-only mode."
                )
              : t("adminStaff.staffDescription", "Create a new staff account. They can login with email and password.")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {allowDemo && (
              <FormField
                control={form.control}
                name="userType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("adminStaff.userTypeLabel", "User Type")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("adminStaff.userTypePlaceholder", "Select user type")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="staff">{t("adminStaff.userTypeStaff", "Staff")}</SelectItem>
                        <SelectItem value="demo">{t("adminStaff.userTypeDemo", "Demo User")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("adminStaff.nameLabel", "Name")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("adminStaff.namePlaceholder", "John Doe")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("adminStaff.emailLabel", "Email")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("adminStaff.emailPlaceholder", "staff@example.com")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {userType !== "demo" && (
              <>
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("adminStaff.roleLabel", "Role")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("adminStaff.rolePlaceholder", "Select a role")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="staff">{t("adminStaff.roleStaff", "Staff")}</SelectItem>
                          <SelectItem value="attendance_staff">{t("adminStaff.roleAttendance", "Attendance Staff")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("adminStaff.whatsappLabel", "WhatsApp Number")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("adminStaff.whatsappPlaceholder", "10-digit number")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("adminStaff.passwordLabel", "Password")}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder={t("adminStaff.passwordPlaceholder", "••••••")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {userType === "demo"
                  ? t("adminStaff.createDemoUser", "Create Demo User")
                  : t("adminStaff.createAccount", "Create Account")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
