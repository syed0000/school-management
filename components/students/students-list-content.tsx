"use client"

import { useState, useTransition, useEffect } from "react"
import { getStudents } from "@/actions/student"
import { StudentTable } from "@/components/students/student-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search } from "lucide-react"
import Link from "next/link"
import { useDebounce } from "@/hooks/use-debounce"
import { BackButton } from "@/components/ui/back-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface StudentsListContentProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialStudents: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  classes: any[]
  isAdmin?: boolean
}

export function StudentsListContent({ initialStudents, classes, isAdmin = false }: StudentsListContentProps) {
  const [students, setStudents] = useState(initialStudents)
  const [search, setSearch] = useState("")
  const [classFilter, setClassFilter] = useState("all")
  const [isPending, startTransition] = useTransition()
  
  const debouncedSearch = useDebounce(search, 500)

  useEffect(() => {
    startTransition(async () => {
      const data = await getStudents(debouncedSearch, classFilter)
      setStudents(data)
    })
  }, [debouncedSearch, classFilter])

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <BackButton />
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Students</h2>
        <div className="flex items-center space-x-2">
          <Link href={isAdmin ? "/admin/students/add" : "/students/add"}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          </Link>
        </div>
      </div>
      
      <div className="flex items-center space-x-2 mb-4">
        <div className="relative w-[300px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Class" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>

      <div className={isPending ? 'opacity-50 pointer-events-none' : ''}>
        <StudentTable students={students} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
