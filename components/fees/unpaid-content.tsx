"use client"

import { useState, useTransition } from "react"
import { getUnpaidStudents } from "@/actions/unpaid-students"
import { UnpaidFilters } from "@/components/fees/unpaid-filters"
import { UnpaidStudentList } from "@/components/fees/unpaid-student-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { BackButton } from "@/components/ui/back-button"

interface UnpaidStudent {
    id: string;
    name: string;
    registrationNumber: string;
    className: string;
    amount: number;
    details: string[];
    photo?: string;
    contactNumber: string;
}

interface UnpaidContentProps {
  initialStudents: UnpaidStudent[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  classes: any[]
  initialStartDate: Date
  initialEndDate: Date
}

export function UnpaidContent({
  initialStudents,
  classes,
  initialStartDate,
  initialEndDate
}: UnpaidContentProps) {
  const [students, setStudents] = useState<UnpaidStudent[]>(initialStudents)
  const [displayStart, setDisplayStart] = useState(initialStartDate)
  const [displayEnd, setDisplayEnd] = useState(initialEndDate)
  const [isPending, startTransition] = useTransition()

  const handleFilter = (filters: { 
    search?: string
    classId?: string
    startDate?: string
    endDate?: string
  }) => {
    // Update display dates if provided, otherwise fallback to initial/current
    const newStart = filters.startDate ? parseISO(filters.startDate) : initialStartDate
    const newEnd = filters.endDate ? parseISO(filters.endDate) : initialEndDate
    
    setDisplayStart(newStart)
    setDisplayEnd(newEnd)

    startTransition(async () => {
      const data = await getUnpaidStudents({
        searchQuery: filters.search,
        classId: filters.classId,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined
      })
      setStudents(data)
    })
  }

  const totalUnpaid = students.reduce((sum, s) => sum + s.amount, 0)

  return (
    <div className="p-6 space-y-6">
        <BackButton />
        <div>
            <h1 className="text-3xl font-bold">Unpaid Students</h1>
            <p className="text-muted-foreground">
                Showing unpaid fees from {format(displayStart, 'dd MMM yyyy')} to {format(displayEnd, 'dd MMM yyyy')}
            </p>
        </div>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Unpaid Amount</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-red-600">₹{totalUnpaid.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{students.length} students</p>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
                <UnpaidFilters
                    classes={classes}
                    onFilter={handleFilter}
                    isLoading={isPending}
                />
            </CardContent>
        </Card>

        <Card className={isPending ? 'opacity-50 pointer-events-none' : ''}>
            <CardHeader>
                <CardTitle>Unpaid Students ({students.length})</CardTitle>
            </CardHeader>
            <CardContent>
                <UnpaidStudentList students={students} />
            </CardContent>
        </Card>
    </div>
  )
}
