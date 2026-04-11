import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { Locale } from "@/lib/i18n"
import { withLocale } from "@/lib/locale-path"
import { getTeacherNotificationFeed } from "@/actions/notification"
import { NotificationFeed } from "@/components/notifications/notification-feed"

export default async function TeacherNotificationsPage({
  params,
}: {
  params: Promise<{ lang: Locale }>
}) {
  const { lang } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect(withLocale(lang, "/teachers/login"))
  if (session.user.role !== "teacher" && session.user.role !== "admin") redirect(withLocale(lang, "/dashboard"))

  const feed = await getTeacherNotificationFeed(undefined, 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
      </div>
      <NotificationFeed
        mode="teacher"
        initialItems={feed.items as unknown as Array<{ _id: string; title: string; body: string; sentAt?: Date; type: string }>}
        initialNextCursor={feed.nextCursor}
      />
    </div>
  )
}
