"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { CalendarIcon, Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { getStudentsForAttendance, saveAttendance, StudentForAttendance } from "@/actions/attendance"
import { useSession } from "next-auth/react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { BackButton } from "../ui/back-button"
import { defaultLocale, hasLocale } from "@/lib/i18n"
import { withLocale } from "@/lib/locale-path"
import { useI18n } from "@/components/i18n-provider"

interface AttendanceFormProps {
  initialClasses: { id: string; name: string }[]
}

export function AttendanceForm({ initialClasses }: AttendanceFormProps) {
  const { t } = useI18n()
  const { data: session } = useSession()
  const params = useParams<{ lang?: string }>()
  const lang = hasLocale(params.lang ?? "") ? (params.lang as string) : defaultLocale
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const isAdmin = session?.user?.role === 'admin'
  const isAttendanceStaff = session?.user?.role === 'attendance_staff'
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [students, setStudents] = useState<StudentForAttendance[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState("")
  
  // State for attendance status
  // Map of studentId -> status
  const [attendanceState, setAttendanceState] = useState<Record<string, string>>({})
  const [isHoliday, setIsHoliday] = useState(false)
  const [holidayReason, setHolidayReason] = useState<string | null>(null)

  const formSchema = useMemo(
    () =>
      z.object({
        date: z.date(),
        classId: z.string().min(1, t("attendance.validationClassRequired", "Class is required")),
        section: z.string().min(1, t("attendance.validationSectionRequired", "Section is required")),
      }),
    [t]
  )

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: searchParams.get("date") ? new Date(searchParams.get("date")!) : new Date(),
      classId: searchParams.get("classId") || "",
      section: searchParams.get("section") || "A",
    },
  })

  const { watch } = form
  const selectedClass = watch("classId")
  const selectedSection = watch("section")
  const selectedDate = watch("date")

  const isToday = selectedDate && selectedDate.toDateString() === today.toDateString()
  const canEdit = isAdmin || (isAttendanceStaff && isToday)

  const fetchStudents = useCallback(async () => {
    // If not all fields are selected, do not fetch
    if (!selectedClass || !selectedSection || !selectedDate) return;
    
    setLoading(true)
    try {
      const dateStr = selectedDate.toISOString()
      const result = await getStudentsForAttendance(selectedClass, selectedSection, dateStr)
      
      if (result.success && result.students) {
        setStudents(result.students)
        setIsHoliday(result.isHoliday || false)
        setHolidayReason(result.holidayReason || null)

        // Initialize attendance state
        const initialState: Record<string, string> = {}
        result.students.forEach(s => {
          // Logic for default status
          if (s.currentStatus) {
               initialState[s.id] = s.currentStatus
          } else if (result.isHoliday) {
               initialState[s.id] = "Holiday"
          } else {
               // Default to Absent as requested by user ("default attendance is present but it should be absent")
               initialState[s.id] = "Absent"
          }
        })
        setAttendanceState(initialState)
      } else {
        toast.error(t("attendance.toastFetchFailed", "Failed to fetch students"))
      }
    } catch {
      toast.error(t("attendance.toastGenericError", "An error occurred"))
    } finally {
      setLoading(false)
    }
  }, [selectedClass, selectedSection, selectedDate, t])

  // Initial fetch on mount if params are present
  useEffect(() => {
    const classId = searchParams.get("classId");
    const section = searchParams.get("section");
    const dateParam = searchParams.get("date");
    
    if (classId && section && dateParam) {
        const date = new Date(dateParam);
        form.reset({
            classId,
            section,
            date
        });
    }
  }, [searchParams, form]);

  // Fetch students when class/section/date changes
  useEffect(() => {
    if (selectedClass && selectedSection && selectedDate) {
        fetchStudents()
    }
  }, [selectedClass, selectedSection, selectedDate, fetchStudents])
  
  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceState(prev => ({
      ...prev,
      [studentId]: status
    }))
  }

  const toggleStatus = (studentId: string) => {
    if (isHoliday) return; // Locked on holidays
    setAttendanceState(prev => ({
      ...prev,
      [studentId]: prev[studentId] === "Present" ? "Absent" : "Present"
    }))
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (students.length === 0) {
      toast.error(t("attendance.toastNoStudents", "No students to mark attendance for"))
      return
    }

    setSaving(true)
    try {
      const records = students.map(s => ({
        studentId: s.id,
        status: attendanceState[s.id] as "Present" | "Absent" | "Late" | "Holiday",
        remarks: s.remarks // We might want to add remarks editing later
      }))

      const result = await saveAttendance({
        date: values.date.toISOString(),
        classId: values.classId,
        section: values.section,
        records,
        markedBy: session?.user?.id as string
      })

      if (result.success) {
        toast.success(t("attendance.toastSaved", "Attendance saved successfully"))
        router.refresh()
        router.push(withLocale(lang, "/attendance/dashboard"))
      } else {
        toast.error(result.error || t("attendance.toastSaveFailed", "Failed to save attendance"))
      }
    } catch {
      toast.error(t("attendance.toastSaveError", "An error occurred while saving"))
    } finally {
      setSaving(false)
    }
  }

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(filter.toLowerCase()) ||
    s.rollNumber.toLowerCase().includes(filter.toLowerCase()) ||
    s.registrationNumber.toLowerCase().includes(filter.toLowerCase())
  )

  // Calculate stats
  const presentCount = Object.values(attendanceState).filter(s => s === "Present").length
  const absentCount = Object.values(attendanceState).filter(s => s === "Absent").length
  const holidayCount = Object.values(attendanceState).filter(s => s === "Holiday").length
  const total = students.length

  return (
    <div className="space-y-6">
      <BackButton />
      {isHoliday && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded-md" role="alert">
          <p className="font-bold">
            {t("attendance.holidayPrefix", "Holiday:")} {holidayReason}
          </p>
          <p>{t("attendance.holidayNote", "Attendance is automatically marked as 'Holiday' for all students.")}</p>
        </div>
      )}
      <Form {...form}>
        <form className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col col-span-2">
                  <FormLabel>{t("attendance.date", "Date")}</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>{t("attendance.pickDate", "Pick a date")}</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => {
                          // Prevent future dates and ancient dates
                          if (date > today || date < new Date("1900-01-01")) return true
                          
                          // If not admin, prevent past dates
                          if (!isAdmin && date < today) return true
                          
                          return false
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="classId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("attendance.class", "Class")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("attendance.selectClass", "Select Class")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {initialClasses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="section"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("attendance.section", "Section")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("attendance.selectSection", "Select Section")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {["A", "B", "C", "D"].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>

      {loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : students.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="relative w-full md:w-[300px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("attendance.searchPlaceholder", "Search by name, roll no...")}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-8 w-full"
              />
            </div>
            <div className="flex flex-wrap gap-3 text-sm font-medium w-full md:w-auto">
              <span className="text-muted-foreground px-2 py-1 bg-secondary rounded-md">
                {t("attendance.total", "Total:")} {total}
              </span>
              <span className="text-green-700 bg-green-100 px-2 py-1 rounded-md">
                {t("attendance.present", "Present:")} {presentCount}
              </span>
              <span className="text-red-700 bg-red-100 px-2 py-1 rounded-md">
                {t("attendance.absent", "Absent:")} {absentCount}
              </span>
              {holidayCount > 0 && (
                <span className="text-blue-700 bg-blue-100 px-2 py-1 rounded-md">
                  {t("attendance.holiday", "Holiday:")} {holidayCount}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:hidden">
             {/* Mobile View: Cards */}
             {filteredStudents.map((student) => (
                <div key={student.id} 
                  className={cn(
                    "flex items-center p-3 rounded-lg border shadow-sm",
                    attendanceState[student.id] === "Present" ? "bg-green-50 border-green-200" : "bg-white"
                  )}
                  onClick={() => !isHoliday && canEdit && toggleStatus(student.id)}
                >
                  <Avatar className="h-10 w-10 mr-3 border">
                    <AvatarImage src={student.photo} />
                    <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-black">{student.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {t("attendance.rollPrefix", "Roll:")} {student.rollNumber || "-"}
                    </div>
                  </div>
                  <div className="ml-3">
                     {isHoliday ? (
                        <span className="text-blue-600 font-bold text-xs px-2 py-1 bg-blue-100 rounded">{t("attendance.holidayStatus", "Holiday")}</span>
                     ) : (
                       <Button 
                          size="sm" 
                          disabled={!canEdit}
                          variant={attendanceState[student.id] === "Present" ? "default" : "outline"}
                          className={cn(
                            "h-8 w-16 transition-colors",
                            attendanceState[student.id] === "Present" ? "bg-green-600 hover:bg-green-700" : "text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700",
                            !canEdit && "opacity-100 cursor-not-allowed"
                          )}
                       >
                          {attendanceState[student.id] === "Present" ? "P" : "A"}
                       </Button>
                     )}
                  </div>
                </div>
             ))}
          </div>

          <div className="hidden md:block rounded-md border">
            {/* Desktop View: Table */}
            <div className="p-4 grid grid-cols-12 gap-4 bg-muted/50 font-medium text-sm">
              <div className="col-span-1">#</div>
              <div className="col-span-1">{t("attendance.photo", "Photo")}</div>
              <div className="col-span-3">{t("attendance.nameFather", "Name / Father's Name")}</div>
              <div className="col-span-2">{t("attendance.rollNo", "Roll No")}</div>
              <div className="col-span-2">{t("attendance.regNo", "Reg No")}</div>
              <div className="col-span-3 text-right">{t("attendance.status", "Status")}</div>
            </div>
            <div className="divide-y">
              {filteredStudents.map((student, index) => (
                <div key={student.id} className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-muted/20">
                  <div className="col-span-1 text-muted-foreground">{index + 1}</div>
                  <div className="col-span-1">
                    <Avatar>
                      <AvatarImage src={student.photo} />
                      <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="col-span-3">
                    <div className="font-medium">{student.name}</div>
                    <div className="text-xs text-muted-foreground">{student.fatherName}</div>
                  </div>
                  <div className="col-span-2 text-sm">{student.rollNumber || "-"}</div>
                  <div className="col-span-2 text-sm">{student.registrationNumber || "-"}</div>
                  <div className="col-span-3 flex justify-end gap-2">
                    {isHoliday ? (
                      <span className="text-blue-600 font-medium bg-blue-100 px-2 py-1 rounded">{t("attendance.holidayStatus", "Holiday")}</span>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={attendanceState[student.id] === "Present" ? "default" : "outline"}
                          size="sm"
                          disabled={!canEdit}
                          className={cn(
                            attendanceState[student.id] === "Present" && "bg-green-600 hover:bg-green-700",
                            !canEdit && "opacity-100 cursor-not-allowed"
                          )}
                          onClick={() => handleStatusChange(student.id, "Present")}
                        >
                          {t("attendance.presentBtn", "Present")}
                        </Button>
                        <Button
                          type="button"
                          variant={attendanceState[student.id] === "Absent" ? "destructive" : "outline"}
                          size="sm"
                          disabled={!canEdit}
                          className={cn(
                            !canEdit && "opacity-100 cursor-not-allowed"
                          )}
                          onClick={() => handleStatusChange(student.id, "Absent")}
                        >
                          {t("attendance.absentBtn", "Absent")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {canEdit ? (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:relative md:bg-transparent md:border-0 md:p-0 z-10">
              <Button size="lg" onClick={form.handleSubmit(onSubmit)} disabled={saving} className="w-full md:w-auto">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("attendance.submit", "Submit Attendance")} ({presentCount} {t("attendance.presentWord", "Present")})
              </Button>
            </div>
          ) : null}
          {/* Spacer for fixed bottom button on mobile */}
          <div className="h-20 md:hidden"></div>
        </div>
      ) : (
        selectedClass && selectedSection && (
          <div className="text-center p-8 text-muted-foreground">
            {t("attendance.noStudentsFound", "No students found for this class and section.")}
          </div>
        )
      )}
    </div>
  )
}
