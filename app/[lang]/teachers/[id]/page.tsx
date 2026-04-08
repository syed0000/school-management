import { getTeacherById } from "@/actions/teacher"
import { TeacherForm } from "@/components/teachers/teacher-form"
import { notFound } from "next/navigation"

export default async function TeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const teacher = await getTeacherById(id)

  if (!teacher) {
    notFound()
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Teacher Details</h2>
      </div>
      <TeacherForm teacher={teacher} isEdit />
    </div>
  )
}
