import { LoginForm } from "@/components/auth/login-form"
import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { demoConfig } from "@/lib/demo-config"

export const dynamic = 'force-dynamic'

export default async function StaffLoginPage() {
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
        <LoginForm type="staff" allowDemo={demoConfig.adminInstitute} />
      </Suspense>
    </div>
  )
}
