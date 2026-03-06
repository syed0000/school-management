"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, FilePlus, UserRoundSearch, ClipboardList, MessageCircle, Phone, CalendarCheck, IndianRupee, Globe } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { DashboardFilter } from "@/components/dashboard/dashboard-filter"
import { Overview } from "@/components/dashboard/overview"
import { CustomLineChart } from "@/components/dashboard/charts/line-chart"
import { CustomPieChart } from "@/components/dashboard/charts/pie-chart"
import { getDashboardStats } from "@/actions/dashboard"
import { DateRange } from "react-day-picker"
import { subDays } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface UnpaidStudent {
  id: string
  name: string
  className: string
  amount: number
  months: string[]
  photo?: string
  mobile: string[]
  email: string[]
  registrationNumber?: string
  rollNumber?: string
}

interface DashboardStats {
  collected: number
  pending: number
  totalExpenses: number
  netProfit: number
  unpaid: number
  collectable: number
  recentSales: {
    id: string
    amount: number
    studentName: string
    contactNumber: string
    studentPhoto?: string
    status: string
    type: string
    month?: number
    year: number
    transactionDate: Date
  }[]
  overview: {
    name: string
    collected: number
    pending: number
    unpaid: number
    expense: number
    profit: number
  }[]
  classWise: {
    name: string
    collected: number
    pending: number
  }[]
  unpaidStudents: UnpaidStudent[]
  revenueChange: number
  pendingChange: number
  expenseChange: number
}

interface AttendanceStats {
  totalStudents: number
  totalPresent: number
  totalAbsent: number
  totalHoliday: number
  classWise: {
    name: string
    present: number
    absent: number
    holiday: number
    total: number
  }[]
}

interface DashboardContentProps {
  initialStats: DashboardStats
  attendanceStats: AttendanceStats
  classes: { id: string; name: string }[]
  totalStaff: number
  totalStudents: number
}

export function DashboardContent({
  initialStats,
  classes,
}: DashboardContentProps) {
  const [stats, setStats] = useState<DashboardStats>(initialStats)
  const [isPending, startTransition] = useTransition()

  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })
  const [classId, setClassId] = useState("all")
  const [language, setLanguage] = useState("en")

  const handleFilterChange = (newDate: DateRange | undefined, newClassId: string) => {
    setDate(newDate)
    setClassId(newClassId)

    startTransition(async () => {
      const newStats = await getDashboardStats({
        startDate: newDate?.from,
        endDate: newDate?.to,
        classId: newClassId
      })
      setStats(newStats)
    })
  }

  const pendingData = stats.overview.map((item) => ({
    name: item.name,
    value: item.unpaid
  }))

  const profitData = [
    { name: 'Income', value: stats.collected, color: '#22c55e' },
    { name: 'Expense', value: stats.totalExpenses, color: '#ef4444' }
  ]

  // Approximation for Total Collection vs Should be Collected
  // We don't have exact "Should be Collected" per month in the overview data structure easily accessible for a line chart without backend changes,
  // but we can show the aggregate status.
  const collectionStatusData = [
    { name: 'Collected', value: stats.collected, color: '#22c55e' },
    { name: 'Pending', value: stats.pending, color: '#eab308' },
    { name: 'Unpaid (Deficit)', value: stats.unpaid, color: '#ef4444' }
  ]

  // const revenueChange = stats.revenueChange
  const pendingChange = stats.pendingChange
  // const expenseChange = stats.expenseChange

  const normalizePhoneDigits = (value: string) => value.replace(/[^\d]/g, "")

  const formatForWaMe = (value: string) => {
    const digits = normalizePhoneDigits(value)
    if (digits.length === 10) return `91${digits}`
    if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`
    return digits
  }

  const formatForTel = (value: string) => {
    const digits = normalizePhoneDigits(value)
    if (digits.length === 10) return `+91${digits}`
    if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`
    if (digits.startsWith("00")) return `+${digits.slice(2)}`
    if (digits.startsWith("91") && digits.length === 12) return `+${digits}`
    return value
  }

  const buildWhatsAppMessage = (student: UnpaidStudent) => {
    const monthsText = student.months.length > 0 ? student.months.join(", ") : "the selected period"
    
    switch (language) {
      case "hi":
        return `*फीस रिमाइंडर*\n\nनमस्ते,\n\nयह *${student.name}* (कक्षा: ${student.className}) के लिए फीस रिमाइंडर है।\n\n*बकाया विवरण:*\n- महीना: ${monthsText}\n- कुल देय: *₹${student.amount.toLocaleString()}*\n\nकृपया जल्द से जल्द फीस जमा करें।\nधन्यवाद।`
      case "ur":
        return `*فیس کی یاد دہانی*\n\nآداب،\n\nیہ *${student.name}* (کلاس: ${student.className}) کے لیے فیس کی یاد دہانی ہے۔\n\n *بقایا تفصیلات:*\n- مہینہ: ${monthsText}\n- کل واجب الادا: *₹${student.amount.toLocaleString()}*\n\nبراہ کرم جلد از جلد فیس جمع کرائیں۔\nشکریہ۔`
      case "en":
      default:
        return `*Fee Reminder*\n\nHello,\n\nThis is a gentle reminder regarding the pending fees for *${student.name}* (Class: ${student.className}).\n\n *Details:*\n- Due for: ${monthsText}\n- Total Amount: *₹${student.amount.toLocaleString()}*\n\nPlease clear the dues at your earliest convenience.\nThank you.`
    }
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 bg-background">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>

        <div className="flex flex-wrap items-center gap-2">
          <DashboardFilter
            classes={classes}
            date={date}
            setDate={(d) => handleFilterChange(d, classId)}
            classId={classId}
            setClassId={(c) => handleFilterChange(date, c)}
            isLoading={isPending}
          />
        </div>
      </div>

      <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>

        {/* Row 1 */}
        {/* Total Amount Collected Chart - Large Card */}
        <Card className="col-span-2 row-span-1 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold">Financial Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            <Overview data={stats.overview} />
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.collected.toLocaleString()}</div>
          </CardContent>
        </Card>

        {/* Total Expenses */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.totalExpenses.toLocaleString()}</div>
          </CardContent>
        </Card>

        {/* Row 2 */}
        {/* Pending Fees Breakdown Chart - Large Card */}
        <Card className="col-span-3 row-span-1 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold">Pending Fees Breakdown</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
              Unpaid Fees (Deficit)
            </div>
          </CardHeader>
          <CardContent className="pl-0">
            <CustomLineChart data={pendingData} color="#ef4444" height={150} />
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{stats.netProfit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Income - Expense
            </p>
          </CardContent>
        </Card>

        {/* Row 3 */}
        {/* Income vs Expense */}
        <Card className="col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">Income vs Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomPieChart data={profitData} height={250} />
          </CardContent>
        </Card>

        {/* Collection Status */}
        <Card className="col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">Total Fee Collection Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomPieChart data={collectionStatusData} height={250} />
          </CardContent>
        </Card>

        {/* Row 4 */}
        {/* Pending This Month */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending This Month</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.pending.toLocaleString()}</div>
            <p className={`text-xs ${pendingChange <= 0 ? "text-green-600" : "text-red-600"}`}>
              {pendingChange > 0 ? "+" : ""}{pendingChange}% from last month
            </p>
            <Progress
              value={Math.abs(stats.pendingChange)}
              className="mt-2 h-1.5"
              indicatorclassname={stats.pendingChange <= 0 ? "bg-green-600" : "bg-red-600"}
            />
          </CardContent>
        </Card>

        {/* Row 2 */}

        {/* Reminders (Unpaid) */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold">Reminders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{stats.unpaid.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total Unpaid / Deficit
            </p>
            <Progress value={pendingChange} className="mt-4 h-2" />
          </CardContent>
        </Card>

        {/* New Student */}
        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/students/admit" className="block h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">New Student</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <Users className="h-10 w-10 mb-2" strokeWidth={1.5} />
              <span className="text-sm font-medium">Add new Student</span>
            </CardContent>
          </Link>
        </Card>

        {/* New Class */}
        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/admin/classes" className="block h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">New Class</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <FilePlus className="h-10 w-10 mb-2" strokeWidth={1.5} />
              <span className="text-sm font-medium">Add new Class</span>
            </CardContent>
          </Link>
        </Card>

        {/* Row 5 */}
        {/* Find */}
        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/students/list" className="block h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Find</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <UserRoundSearch className="h-10 w-10 mb-2" strokeWidth={1.5} />
              <span className="text-sm font-medium">Find Student</span>
            </CardContent>
          </Link>
        </Card>

        {/* Report */}
        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/admin/reports" className="block h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Report</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <ClipboardList className="h-10 w-10 mb-2" strokeWidth={1.5} />
              <span className="text-sm font-medium text-center">Generate and Print Report</span>
            </CardContent>
          </Link>
        </Card>

        {/* Attendance */}
        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/attendance/dashboard" className="block h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Attendance</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <CalendarCheck className="h-10 w-10 mb-2" strokeWidth={1.5} />
              <span className="text-sm font-medium text-center">Manage Attendance</span>
            </CardContent>
          </Link>
        </Card>

        {/* Features */}
        {/* <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold">Features Can Be Added</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>WhatsApp Intigration</TableCell>
                  <TableCell>5K - 15K</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Attendance Automation</TableCell>
                  <TableCell>8K - 25K</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/admin/reports" className="block h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Report</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <ClipboardList className="h-10 w-10 mb-2" strokeWidth={1.5} />
              <span className="text-sm font-medium text-center">Generate and Print Report</span>
            </CardContent>
          </Link>
        </Card> */}

      </div>

      {/* Unpaid Students Table */}
      <Card className="col-span-4 shadow-sm mt-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-bold">Unpaid Students</CardTitle>
              <CardDescription>Students who haven&apos;t submitted fees in the selected period.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="ur">Urdu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="max-h-[460px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.unpaidStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No unpaid students for the selected period.
                  </TableCell>
                </TableRow>
              ) : (
                stats.unpaidStudents.map((student) => {
                  const phones = (student.mobile || []).filter(Boolean).slice(0, 2)
                  const emails = (student.email || []).filter(Boolean)
                  const primaryEmail = emails[0]
                  const extraEmails = Math.max(0, emails.length - 1)
                  const extraPhones = Math.max(0, (student.mobile || []).filter(Boolean).length - phones.length)

                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={student.photo || ""} alt={student.name} />
                            <AvatarFallback>{student.name?.charAt(0) || "S"}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium">{student.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {student.registrationNumber ? `Reg: ${student.registrationNumber}` : "Reg: N/A"}
                              {" • "}
                              {student.rollNumber ? `Roll: ${student.rollNumber}` : "Roll: N/A"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{student.className}</Badge>
                      </TableCell>
                      <TableCell className="space-y-1">
                        <div className="flex flex-wrap gap-2">
                          {phones.length === 0 ? (
                            <span className="text-sm text-muted-foreground">N/A</span>
                          ) : (
                            phones.map((phone) => {
                              const waTo = formatForWaMe(phone)
                              const telTo = formatForTel(phone)
                              const message = buildWhatsAppMessage(student)
                              const waUrl = `https://wa.me/${waTo}?text=${encodeURIComponent(message)}`

                              return (
                                <DropdownMenu key={phone}>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="link" className="h-auto p-0 text-sm">
                                      {phone}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start">
                                    <DropdownMenuLabel>{phone}</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                      <a href={waUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                                        <MessageCircle className="size-4" />
                                        WhatsApp message
                                      </a>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <a href={`tel:${telTo}`} className="flex items-center gap-2">
                                        <Phone className="size-4" />
                                        Call
                                      </a>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )
                            })
                          )}
                          {extraPhones > 0 ? (
                            <span className="text-xs text-muted-foreground">+{extraPhones} more</span>
                          ) : null}
                        </div>
                        {primaryEmail ? (
                          <div className="text-xs">
                            <a href={`mailto:${primaryEmail}`} className="text-primary underline underline-offset-4">
                              {primaryEmail}
                            </a>
                            {extraEmails > 0 ? (
                              <span className="text-muted-foreground"> +{extraEmails} more</span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">No email</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {student.months.slice(0, 4).map((m) => (
                            <Badge key={m} variant="secondary" className="text-xs">
                              {m}
                            </Badge>
                          ))}
                          {student.months.length > 4 ? (
                            <span className="text-xs text-muted-foreground">+{student.months.length - 4} more</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-red-600">₹{student.amount.toLocaleString()}</span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
