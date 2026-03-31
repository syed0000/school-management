"use client";

import { useState, useTransition, useEffect } from "react";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";
import { getTeacherClassAttendanceReport, saveTeacherAttendance } from "@/actions/teacher-portal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Search, Edit3, Check, X, Calendar as CalIcon } from "lucide-react";
import { getStudentsForAttendance } from "@/actions/attendance";
import type { StudentForAttendance } from "@/actions/attendance";

interface ClassAttendanceTabProps {
  classId: string;
  section: string;
  attendanceAccess: boolean;
}

export function ClassAttendanceTab({ classId, section, attendanceAccess }: ClassAttendanceTabProps) {
  const [date, setDate] = useState<Date>(new Date());
  const [isEditing, setIsEditing] = useState(false);
  const [loading, startTransition] = useTransition();

  const [students, setStudents] = useState<StudentForAttendance[]>([]);
  const [search, setSearch] = useState("");
  const [attendanceState, setAttendanceState] = useState<Record<string, { status: string; remarks: string }>>({});
  const [isHoliday, setIsHoliday] = useState(false);

  const fetchAttendance = () => {
    startTransition(async () => {
      try {
        const res = await getStudentsForAttendance(classId, section, date.toISOString());
        if (res.success && res.students) {
          setStudents(res.students);
          setIsHoliday(res.isHoliday || false);

          const newState: Record<string, { status: string; remarks: string }> = {};
          res.students.forEach((s) => {
            const status = s.currentStatus || "Absent";
            newState[s.id] = { status, remarks: s.remarks || "" };
          });
          setAttendanceState(newState);
        } else {
          toast.error(res.error || "Failed to load attendance");
        }
      } catch (err) {
        toast.error("An error occurred while fetching attendance");
      }
    });
  };

  useEffect(() => {
    fetchAttendance();
  }, [date, classId, section]);

  const handleSave = async () => {
    startTransition(async () => {
      const recordsToSave = students.map((s) => ({
        studentId: s.id,
        status: attendanceState[s.id]?.status as "Present" | "Absent" | "Holiday",
        remarks: attendanceState[s.id]?.remarks || "",
      }));

      const res = await saveTeacherAttendance({
        date: date.toISOString(),
        classId,
        section,
        records: recordsToSave,
      });

      if (res?.success) {
        toast.success("Attendance saved successfully");
        setIsEditing(false);
        fetchAttendance();
      } else {
        toast.error(res?.error || "Failed to save attendance");
      }
    });
  };

  const setAllStatus = (status: string) => {
    const newState = { ...attendanceState };
    Object.keys(newState).forEach(id => {
      newState[id].status = status;
    });
    setAttendanceState(newState);
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.rollNumber && s.rollNumber.toLowerCase().includes(search.toLowerCase())) ||
    (s.registrationNumber && s.registrationNumber.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Card className="shadow-none border-0 sm:border sm:shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 space-y-4 sm:space-y-0">
        <CardTitle className="text-xl">Daily Attendance</CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <CalIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={format(date, "yyyy-MM-dd")}
              onChange={(e) => {
                if (e.target.value) setDate(new Date(e.target.value));
              }}
              className="w-40 pl-9"
              max={format(new Date(), "yyyy-MM-dd")}
            />
          </div>
          {attendanceAccess && !isEditing && (
            <Button size="sm" onClick={() => setIsEditing(true)}>
              <Edit3 className="w-4 h-4 mr-2" /> Mark Attendance
            </Button>
          )}
          {isEditing && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="default" onClick={handleSave} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-2 sm:px-6">
        {isHoliday && (
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded-md" role="alert">
            <p className="font-bold">Holiday</p>
            <p>Attendance is automatically marked as &apos;Holiday&apos; for all students.</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="relative w-full md:w-[300px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by name or roll no..."
              className="pl-8 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {!loading && students.length > 0 && (
            <div className="flex flex-wrap gap-2 text-sm font-medium w-full md:w-auto">
              <span className="text-muted-foreground px-2 py-1 bg-secondary rounded-md text-xs sm:text-sm">Total: {students.length}</span>
              <span className="text-green-700 bg-green-100 px-2 py-1 rounded-md text-xs sm:text-sm">
                Present: {Object.values(attendanceState).filter(s => s.status === 'Present').length}
              </span>
              <span className="text-red-700 bg-red-100 px-2 py-1 rounded-md text-xs sm:text-sm">
                Absent: {Object.values(attendanceState).filter(s => s.status === 'Absent').length}
              </span>
              {Object.values(attendanceState).filter(s => s.status === 'Holiday').length > 0 && (
                <span className="text-blue-700 bg-blue-100 px-2 py-1 rounded-md text-xs sm:text-sm">
                  Holiday: {Object.values(attendanceState).filter(s => s.status === 'Holiday').length}
                </span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            No students found in this class section.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mobile View: Cards */}
            <div className="grid gap-3 md:hidden">
              {filteredStudents.map((student) => {
                const currentStatus = attendanceState[student.id]?.status;
                return (
                  <div key={student.id}
                    className={`flex items-center p-3 rounded-lg border shadow-sm ${currentStatus === "Present" ? "bg-green-50 border-green-200" : "bg-white"}`}
                  >
                    <div className="h-10 w-10 mr-3 rounded-full bg-muted flex items-center justify-center text-muted-foreground overflow-hidden">
                      <span className="text-sm font-medium">{student.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-black">{student.name}</div>
                      <div className="text-xs text-gray-500 truncate">Roll: {student.rollNumber || "-"}</div>
                    </div>
                    <div className="ml-3">
                      {isHoliday ? (
                        <span className="text-blue-600 font-bold text-xs px-2 py-1 bg-blue-100 rounded">Holiday</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            disabled={!isEditing}
                            variant={currentStatus === "Present" ? "default" : "outline"}
                            className={`h-7 w-14 text-xs transition-colors ${currentStatus === "Present" ? "bg-green-600 hover:bg-green-700" : "text-gray-500 hover:bg-gray-50"} ${!isEditing && "opacity-100 cursor-not-allowed"}`}
                            onClick={() => setAttendanceState(prev => ({ ...prev, [student.id]: { ...prev[student.id], status: "Present" } }))}
                          >
                            P
                          </Button>
                          <Button
                            size="sm"
                            disabled={!isEditing}
                            variant={currentStatus === "Absent" ? "destructive" : "outline"}
                            className={`h-7 w-14 text-xs transition-colors ${currentStatus === "Absent" ? "bg-red-600 hover:bg-red-700" : "text-gray-500 hover:bg-gray-50"} ${!isEditing && "opacity-100 cursor-not-allowed"}`}
                            onClick={() => setAttendanceState(prev => ({ ...prev, [student.id]: { ...prev[student.id], status: "Absent" } }))}
                          >
                            A
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block rounded-md border">
              <div className="p-4 grid grid-cols-12 gap-4 bg-muted/50 font-medium text-sm">
                <div className="col-span-1">#</div>
                <div className="col-span-4">Student Name</div>
                <div className="col-span-2">Roll No</div>
                <div className="col-span-2">Reg No</div>
                <div className="col-span-3 text-right">Status</div>
              </div>
              <div className="divide-y">
                {filteredStudents.map((student, index) => {
                  const currentStatus = attendanceState[student.id]?.status;
                  return (
                    <div key={student.id} className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-muted/20">
                      <div className="col-span-1 text-muted-foreground">{index + 1}</div>
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground shadow-sm">
                          <span className="text-xs font-semibold">{student.name.charAt(0)}</span>
                        </div>
                        <div className="font-medium">{student.name}</div>
                      </div>
                      <div className="col-span-2 text-sm text-muted-foreground">{student.rollNumber || "-"}</div>
                      <div className="col-span-2 text-sm text-muted-foreground">{student.registrationNumber || "-"}</div>
                      <div className="col-span-3 flex justify-end gap-2">
                        {isHoliday ? (
                          <span className="text-blue-600 font-medium bg-blue-100 px-2 py-1 rounded">Holiday</span>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={currentStatus === "Present" ? "default" : "outline"}
                              size="sm"
                              disabled={!isEditing}
                              className={`h-8 w-20 ${currentStatus === "Present" ? "bg-green-600 hover:bg-green-700" : ""} ${!isEditing && "opacity-100 cursor-not-allowed"}`}
                              onClick={() => setAttendanceState(prev => ({ ...prev, [student.id]: { ...prev[student.id], status: "Present" } }))}
                            >
                              Present
                            </Button>
                            <Button
                              type="button"
                              variant={currentStatus === "Absent" ? "destructive" : "outline"}
                              size="sm"
                              disabled={!isEditing}
                              className={`h-8 w-20 ${!isEditing && "opacity-100 cursor-not-allowed"}`}
                              onClick={() => setAttendanceState(prev => ({ ...prev, [student.id]: { ...prev[student.id], status: "Absent" } }))}
                            >
                              Absent
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
