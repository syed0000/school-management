import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import dbConnect from "@/lib/db"
import { authOptions } from "@/lib/auth"
import User from "@/models/User"
import Teacher from "@/models/Teacher"
import Student from "@/models/Student"
import Class from "@/models/Class"
import { AccessAsPanel, type AccessAsTarget } from "@/components/demo/access-as-panel"
import type { Locale } from "@/lib/i18n"
import { withLocale } from "@/lib/locale-path"

export const dynamic = "force-dynamic"

function mapUserToTarget(u: Record<string, unknown>): AccessAsTarget {
  const name = (u.name as string) || (u.username as string) || (u.email as string) || "User"
  const subtitle = (u.email as string) || (u.username as string)
  return {
    id: String(u._id),
    name,
    role: u.role as "admin" | "staff" | "attendance_staff" | "teacher" | "parent",
    subtitle,
  }
}

export default async function DemoAccessAsPage({
  params,
}: {
  params: Promise<{ lang: Locale }>
}) {
  const { lang } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect(withLocale(lang, "/login"))
  if (!session.user.isDemo) redirect(withLocale(lang, "/"))

  await dbConnect()
  
  // Ensure Class model is registered before Student populate executes
  if (!Class) {
    throw new Error("Class model not loaded")
  }

  const [adminsRaw, staffRaw, attendanceRaw, teachersRaw, studentsRaw] = await Promise.all([
    User.find({ role: "admin", isActive: true }).select("name username email role").sort({ createdAt: -1 }).limit(100).lean(),
    User.find({ role: "staff", isActive: true }).select("name email role").sort({ createdAt: -1 }).limit(100).lean(),
    User.find({ role: "attendance_staff", isActive: true })
      .select("name email role")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    Teacher.find({ isActive: true }).select("name").sort({ createdAt: -1 }).limit(100).lean(),
    Student.find({ isActive: true })
      .select("name registrationNumber classId section")
      .populate("classId", "name")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ])

  const admins = (adminsRaw as Record<string, unknown>[]).map(mapUserToTarget)
  const staff = (staffRaw as Record<string, unknown>[]).map(mapUserToTarget)
  const attendanceStaff = (attendanceRaw as Record<string, unknown>[]).map(mapUserToTarget)

  const teachers: AccessAsTarget[] = (teachersRaw as Record<string, unknown>[]).map((t) => ({
    id: String(t._id),
    name: t.name as string,
    role: "teacher",
  }))

  const parents: AccessAsTarget[] = (studentsRaw as Record<string, unknown>[]).map((s) => {
    const cls = typeof s.classId === "object" && s.classId ? (s.classId as Record<string, string>).name : ""
    const subtitleParts = [s.registrationNumber, cls, s.section].filter(Boolean)
    return {
      id: String(s._id),
      name: s.name as string,
      role: "parent",
      subtitle: subtitleParts.join(" · "),
    }
  })

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <AccessAsPanel targets={{ admins, staff, attendanceStaff, teachers, parents }} />
    </div>
  )
}
