"use client";

import { useState, useEffect, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { AttendanceCalendar } from "@/components/parent/attendance-calendar";
import { getStudentAttendanceCalendar } from "@/actions/parent";
import type { AttendanceCalendarEntry } from "@/types";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

export default function ParentAttendancePage() {
  const searchParams = useSearchParams();
  const studentIdParam = searchParams.get("studentId");
  const { data: session } = useSession();

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [entries, setEntries] = useState<AttendanceCalendarEntry[]>([]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, holiday: 0, total: 0 });
  
  const [isPending, startTransition] = useTransition();

  const studentId = studentIdParam || session?.user?.id;

  useEffect(() => {
    if (!studentId) return;

    startTransition(async () => {
      try {
        const data = await getStudentAttendanceCalendar(studentId, month, year);
        if (data) {
          setEntries(data.entries);
          setSummary(data.summary);
        } else {
          toast.error("Failed to load attendance");
        }
      } catch (error) {
        toast.error("An error occurred");
      }
    });

  }, [studentId, month, year]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
      <p className="text-muted-foreground">View your student&apos;s daily attendance record.</p>

      <AttendanceCalendar 
        entries={entries} 
        summary={summary} 
        onMonthChange={(m, y) => { setMonth(m); setYear(y); }} 
        loading={isPending}
      />
    </div>
  );
}
