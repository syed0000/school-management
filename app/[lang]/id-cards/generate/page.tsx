import { IDCardGenerator } from "@/components/students/id-card-generator"
import { getStudents, getClasses } from "@/actions/student"

export default async function IDCardPage() {
  const students = await getStudents()
  const classes = await getClasses()

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Generate ID Cards</h2>
      </div>
      <IDCardGenerator 
        students={students.map(s => ({
          id: s.id,
          name: s.name,
          registrationNumber: s.registrationNumber
        }))} 
        classes={classes}
      />
    </div>
  )
}
