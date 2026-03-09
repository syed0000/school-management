import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ProfileForm } from "@/components/profile/profile-form"
import { getUserProfile } from "@/actions/profile"

export default async function StaffProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  const user = await getUserProfile(session.user.id)

  if (!user) {
    return <div>User not found</div>
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Profile Settings</h2>
      </div>
      <div className="max-w-2xl">
        <ProfileForm user={{ name: user.name, email: user.email }} />
      </div>
    </div>
  )
}
