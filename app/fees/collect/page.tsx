import { getStudents, getClasses } from "@/actions/student"
import { FeeCollectionForm } from "@/components/fees/fee-collection-form"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function FeeCollectionPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  // We'll fetch all students initially, or we can fetch on demand. 
  // For simplicity, let's pass all students and classes, and filter in client.
  // Better: fetch classes, and students.
  const students = await getStudents()
  const classes = await getClasses()

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-baseline gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Collect Fee</h2>
      </div>
      <FeeCollectionForm
        students={students.map(s => ({
          id: s.id,
          name: s.name,
          registrationNumber: s.registrationNumber,
          className: s.className
        }))}
        classes={classes}
        userId={session.user.id}
      />
    </div>
  )
}
