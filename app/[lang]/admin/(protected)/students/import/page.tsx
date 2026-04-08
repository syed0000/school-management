import { StudentImport } from "@/components/admin/import/student-import"

export default function ImportStudentsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Import Students</h2>
      </div>
      <StudentImport />
    </div>
  )
}
