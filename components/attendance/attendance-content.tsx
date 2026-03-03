"use client"

import { useState, useTransition } from "react"
import { getAttendanceReport } from "@/actions/attendance-report"
import { AttendanceFilter } from "@/components/attendance/attendance-filter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"

interface AttendanceContentProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialHistory: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  classes: any[]
  isAdmin: boolean
  isAttendanceStaff: boolean
}

export function AttendanceContent({
  initialHistory,
  classes,
  isAdmin,
  isAttendanceStaff,
}: AttendanceContentProps) {
  const [history, setHistory] = useState(initialHistory)
  const [isPending, startTransition] = useTransition()

  const handleFilter = (filters: { date?: Date, classId?: string, section?: string }) => {
    startTransition(async () => {
      const data = await getAttendanceReport({
        startDate: filters.date,
        endDate: filters.date,
        classId: filters.classId,
      })
      setHistory(data)
    })
  }

  return (
    <div className="flex-1 space-y-4">      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Attendance Reports</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/attendance/holidays">
            <Button variant="outline" size="sm">Manage Holidays</Button>
          </Link>
          <Link href="/attendance/take">
            <Button size="sm">Take Attendance Today</Button>
          </Link>
        </div>
      </div>
      
      <AttendanceFilter classes={classes} onFilter={handleFilter} isLoading={isPending} />

      <Card className={`col-span-4 overflow-hidden ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Holiday</TableHead>
                <TableHead className="whitespace-nowrap">Marked By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                    No records found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                history.map((record: any) => {
                  const recordDate = new Date(record.date);
                  const today = new Date();
                  const isToday = recordDate.toDateString() === today.toDateString();
                  const canEdit = isAdmin || (isAttendanceStaff && isToday);

                  return (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap">{format(recordDate, "PPP")}</TableCell>
                      <TableCell>{record.className}</TableCell>
                      <TableCell>{record.section}</TableCell>
                      <TableCell>{record.totalStudents}</TableCell>
                      <TableCell className="text-green-600 font-medium">{record.presentCount}</TableCell>
                      <TableCell className="text-red-600 font-medium">{record.absentCount}</TableCell>
                      <TableCell className="text-blue-600 font-medium">{record.holidayCount}</TableCell>
                      <TableCell className="whitespace-nowrap">{record.markedBy}</TableCell>
                      <TableCell className="text-right">
                        {canEdit && (
                          <Link href={`/attendance/take?classId=${record.classId}&section=${record.section}&date=${format(recordDate, "yyyy-MM-dd")}`}>
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
