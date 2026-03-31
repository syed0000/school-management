"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { StudentActions } from "./student-actions"

interface Student {
  id: string
  registrationNumber: string
  name: string
  className: string
  section?: string
  rollNumber?: string
  fatherName: string
  aadhaar?: string
  mobile: string
  photo?: string
}

interface StudentTableProps {
  students: Student[]
  isAdmin: boolean
}

export function StudentTable({ students, isAdmin }: StudentTableProps) {
  if (students.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No students found.
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Photo</TableHead>
            <TableHead>Reg No</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Aadhaar</TableHead>
            <TableHead>Father Name</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
            <TableRow key={student.id}>
              <TableCell>
                <Avatar>
                  <AvatarImage src={student.photo} alt={student.name} />
                  <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell className="font-mono">{student.registrationNumber}</TableCell>
              <TableCell className="font-medium">
                <div>{student.name}</div>
                {student.rollNumber && (
                    <div className="text-xs text-muted-foreground">Roll: {student.rollNumber}</div>
                )}
              </TableCell>
              <TableCell>
                {student.className} {student.section && `(${student.section})`}
              </TableCell>
              <TableCell>{student.aadhaar || "-"}</TableCell>
              <TableCell>{student.fatherName}</TableCell>
              <TableCell>{student.mobile}</TableCell>
              <TableCell className="text-right">
                <StudentActions id={student.id} isAdmin={isAdmin} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
