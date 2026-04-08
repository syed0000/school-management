import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ProfileForm } from "@/components/profile/profile-form"
import { getUserProfile } from "@/actions/profile"
import type { Locale } from "@/lib/i18n"
import { withLocale } from "@/lib/locale-path"
import { getDictionary } from "@/lib/dictionaries"

export default async function StaffProfilePage({
  params,
}: {
  params: Promise<{ lang: Locale }>
}) {
  const { lang } = await params
  const dict = await getDictionary(lang)
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect(withLocale(lang, "/login"))
  }

  const user = await getUserProfile(session.user.id)

  if (!user) {
    return <div>{dict?.common?.userNotFound ?? "User not found"}</div>
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{dict?.profile?.pageTitle ?? "Profile Settings"}</h2>
      </div>
      <div className="max-w-2xl">
        <ProfileForm user={{ name: user.name, email: user.email, role: user.role }} />
      </div>
    </div>
  )
}
