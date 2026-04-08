import { AdmissionForm } from "@/components/students/admission-form"
import { getClasses } from "@/actions/student"

export default async function AdmitStudentPage() {
  const classes = await getClasses()

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">New Admission</h2>
      </div>
      <AdmissionForm classes={classes} />
    </div>
  )
}
