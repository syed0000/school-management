import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TeacherActions } from "./teacher-actions"
import { Teacher } from "@/types"

interface TeacherTableProps {
  teachers: Teacher[]
  isAdmin: boolean
}

export function TeacherTable({ teachers, isAdmin }: TeacherTableProps) {
  if (teachers.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No teachers found.
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">S.No</TableHead>
            <TableHead className="w-[80px]">Photo</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Joining Date</TableHead>
            <TableHead>Salary</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teachers.map((teacher, index) => (
            <TableRow key={teacher._id}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>
                <Avatar>
                  <AvatarImage src={teacher.photo} alt={teacher.name} />
                  <AvatarFallback>{teacher.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell className="font-mono">{teacher.teacherId}</TableCell>
              <TableCell className="font-medium">{teacher.name}</TableCell>
              <TableCell>{teacher.phone}</TableCell>
              <TableCell>
                {new Date(teacher.joiningDate).toLocaleDateString()}
              </TableCell>
              <TableCell>
                ₹{teacher.salary?.amount?.toLocaleString() || 0}
              </TableCell>
              <TableCell className="text-right">
                <TeacherActions id={teacher._id} isAdmin={isAdmin} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
