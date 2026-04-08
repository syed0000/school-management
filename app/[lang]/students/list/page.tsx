import { getStudents } from "@/actions/student"
import { getClasses } from "@/actions/class"
import { StudentsListContent } from "@/components/students/students-list-content"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function StudentsListPage() {
  const session = await getServerSession(authOptions)
  const isAdmin = session?.user.role === "admin"
  const [students, classes] = await Promise.all([
    getStudents(""),
    getClasses()
  ])

  return (
    <StudentsListContent initialStudents={students} classes={classes} isAdmin={isAdmin} />
  )
}
