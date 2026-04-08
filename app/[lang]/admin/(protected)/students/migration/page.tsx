import { StudentMigration } from "@/components/admin/student-migration"
import { getClasses } from "@/actions/student"

export const dynamic = 'force-dynamic'

export default async function StudentMigrationPage() {
  const classes = await getClasses()

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Student Migration & Management</h2>
      </div>
      <StudentMigration classes={classes} />
    </div>
  )
}
