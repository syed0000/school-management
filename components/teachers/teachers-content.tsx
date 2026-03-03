"use client"

import { useState, useTransition } from "react"
import { getTeachers } from "@/actions/teacher"
import { TeacherTable } from "@/components/teachers/teacher-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search } from "lucide-react"
import Link from "next/link"
import { useDebounce } from "@/hooks/use-debounce"
import { useEffect } from "react"
import { BackButton } from "@/components/ui/back-button"

interface TeachersContentProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialTeachers: any[]
  isAdmin?: boolean
}

export function TeachersContent({ initialTeachers, isAdmin = false }: TeachersContentProps) {
  const [teachers, setTeachers] = useState(initialTeachers)
  const [search, setSearch] = useState("")
  const [isPending, startTransition] = useTransition()
  
  const debouncedSearch = useDebounce(search, 500)

  useEffect(() => {
    startTransition(async () => {
      const data = await getTeachers(debouncedSearch)
      setTeachers(data)
    })
  }, [debouncedSearch])

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <BackButton />
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Teachers</h2>
        <div className="flex items-center space-x-2">
          <Link href={isAdmin ? "/admin/teachers/add" : "/teachers/add"}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Teacher
            </Button>
          </Link>
        </div>
      </div>
      
      <div className="flex items-center space-x-2 mb-4">
        <div className="relative w-[300px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teachers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className={isPending ? 'opacity-50 pointer-events-none' : ''}>
        <TeacherTable teachers={teachers} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
