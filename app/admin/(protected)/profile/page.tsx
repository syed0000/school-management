import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ProfileForm } from "@/components/profile/profile-form"
import dbConnect from "@/lib/db"
import User from "@/models/User"

export default async function AdminProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/admin/login")
  }

  await dbConnect()
  const user = await User.findById(session.user.id).lean()

  if (!user) {
    return <div>User not found</div>
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Profile Settings</h2>
      </div>
      <div className="max-w-2xl">
        <ProfileForm user={{ name: user.name, email: user.email, phone: user.phone, role: user.role }} />
      </div>
    </div>
  )
}
