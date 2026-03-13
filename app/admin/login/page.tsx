import { LoginForm } from "@/components/auth/login-form"
import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function AdminLoginPage() {
  const session = await getServerSession(authOptions)

  if (session) {
    if (session.user.role === "admin") {
      redirect("/admin/dashboard")
    } else if (session.user.role === "attendance_staff") {
      redirect("/attendance/dashboard")
    } else {
      redirect("/dashboard")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm type="admin" />
      </Suspense>
    </div>
  )
}
