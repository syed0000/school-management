import { getStudentById, getClasses } from "@/actions/student"
import { StudentDetailsForm } from "@/components/students/student-details-form"
import { BackButton } from "@/components/ui/back-button"
import { notFound } from "next/navigation"

interface StudentDetailsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function StudentDetailsPage({ params }: StudentDetailsPageProps) {
  const { id } = await params
  const student = await getStudentById(id)
  if (!student) return notFound()

  const classes = await getClasses()

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <BackButton />
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Student Details</h2>
      </div>
      <StudentDetailsForm student={student} classes={classes} />
    </div>
  )
}
