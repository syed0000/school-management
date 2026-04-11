import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { Locale } from "@/lib/i18n"
import { withLocale } from "@/lib/locale-path"
import { cookies } from "next/headers"
import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import { getParentStudents } from "@/actions/parent"
import { getParentNotificationFeed } from "@/actions/notification"
import { NotificationFeed } from "@/components/notifications/notification-feed"

export default async function ParentNotificationsPage({
  params,
}: {
  params: Promise<{ lang: Locale }>
}) {
  const { lang } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect(withLocale(lang, "/parents/login"))
  if (session.user.role !== "parent" && session.user.role !== "admin") redirect(withLocale(lang, "/dashboard"))

  const cookieStore = await cookies()
  const activeStudentCookie = cookieStore.get("activeParentStudentId")?.value
  const sessionStudentId = session.user.id

  let targetStudentId = activeStudentCookie || sessionStudentId
  let phone = ""

  if (session.user.role === "parent") {
    await dbConnect()
    const student = await Student.findById(sessionStudentId).select("contacts").lean() as { contacts?: { mobile?: string[] } } | null
    phone = student?.contacts?.mobile?.[0] ?? ""
  }

  if (activeStudentCookie && activeStudentCookie !== sessionStudentId && phone) {
    const students = await getParentStudents(phone)
    const hasAccess = students.some((s) => s._id === activeStudentCookie)
    if (!hasAccess) targetStudentId = sessionStudentId
  }

  const feed = await getParentNotificationFeed(targetStudentId, undefined, 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
      </div>
      <NotificationFeed
        mode="parent"
        studentId={targetStudentId}
        initialItems={feed.items as unknown as Array<{ _id: string; title: string; body: string; sentAt?: Date; type: string }>}
        initialNextCursor={feed.nextCursor}
      />
    </div>
  )
}
