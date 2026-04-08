"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FilePlus, ClipboardList, IndianRupee, Headset } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { DashboardFilter } from "@/components/dashboard/dashboard-filter"
import { Overview } from "@/components/dashboard/overview"
import { CustomLineChart } from "@/components/dashboard/charts/line-chart"
import { CustomPieChart } from "@/components/dashboard/charts/pie-chart"
import { getDashboardStats } from "@/actions/dashboard"
import { UnpaidStudentsTable, UnpaidStudent } from "@/components/dashboard/unpaid-students-table"
import { DateRange } from "react-day-picker"
import { formatNumber, getCurrentSessionRange } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
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
  const { t } = useI18n()
  const [stats, setStats] = useState<DashboardStats>(initialStats)
  const [isPending, startTransition] = useTransition()

  const [date, setDate] = useState<DateRange | undefined>(getCurrentSessionRange())
  const [classId, setClassId] = useState("all")

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
    { name: t("dashboard.income", "Income"), value: stats.collected, color: "#22c55e" },
    { name: t("dashboard.expense", "Expense"), value: stats.totalExpenses, color: "#ef4444" },
  ]

  // Approximation for Total Collection vs Should be Collected
  // We don't have exact "Should be Collected" per month in the overview data structure easily accessible for a line chart without backend changes,
  // but we can show the aggregate status.
  const collectionStatusData = [
    { name: t("dashboard.collected", "Collected"), value: stats.collected, color: "#22c55e" },
    { name: t("dashboard.pending", "Pending"), value: stats.pending, color: "#eab308" },
    { name: t("dashboard.unpaidDeficit", "Unpaid (Deficit)"), value: stats.unpaid, color: "#ef4444" },
  ]

  // const revenueChange = stats.revenueChange
  const pendingChange = stats.pendingChange
  // const expenseChange = stats.expenseChange

  return (
    <div className="flex-1 p-4 md:p-8 bg-background">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 mb-6">
        <h2 className="text-2xl font-bold tracking-tight">{t("dashboard.overview", "Overview")}</h2>

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

      <div className={`grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>

        {/* Row 1 */}
        {/* Total Amount Collected Chart - Large Card - Full width on mobile */}
        <Card className="col-span-1 md:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold">{t("dashboard.financialOverview", "Financial Overview")}</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            <Overview data={stats.overview} />
          </CardContent>
        </Card>

        {/* Total Revenue & Expenses - Side by side on mobile if possible, but keep 1 col for clarity on very small screens */}
        <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2 lg:col-span-2 lg:grid-cols-2">
          {/* Total Revenue */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-xs font-medium">{t("dashboard.totalRevenue", "Total Revenue")}</CardTitle>
              <IndianRupee className="h-3 w-3 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg md:text-2xl font-bold">₹{formatNumber(stats.collected)}</div>
            </CardContent>
          </Card>

          {/* Total Expenses */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-xs font-medium">{t("dashboard.totalExpenses", "Total Expenses")}</CardTitle>
              <IndianRupee className="h-3 w-3 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg md:text-2xl font-bold">₹{formatNumber(stats.totalExpenses)}</div>
            </CardContent>
          </Card>

          {/* Net Profit */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-xs font-bold">{t("dashboard.netProfit", "Net Profit")}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl md:text-3xl font-bold">₹{formatNumber(stats.netProfit)}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                {t("dashboard.incomeMinusExpense", "Income - Expense")}
              </p>
            </CardContent>
          </Card>

          {/* Reminders (Unpaid) */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-xs font-bold">{t("dashboard.reminders", "Reminders")}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl md:text-3xl font-bold">₹{formatNumber(stats.unpaid)}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                {t("dashboard.totalUnpaidDeficit", "Total Unpaid / Deficit")}
              </p>
              <Progress value={pendingChange} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
        </div>

        {/* Row 2 */}
        {/* Pending Fees Chart - Large Card */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-3 row-span-1 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold">{t("dashboard.pendingFees", "Pending Fees")}</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
              {t("dashboard.unpaidFeesDeficit", "Unpaid Fees (Deficit)")}
            </div>
          </CardHeader>
          <CardContent className="pl-0">
            <CustomLineChart data={pendingData} color="#ef4444" height={200} />
          </CardContent>
        </Card>

        {/* Pending This Month - Small Card */}
        <Card className="shadow-sm col-span-1 md:col-span-1 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending This Month</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{formatNumber(stats.pending)}</div>
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

        {/* Row 3 */}
        {/* Income vs Expense */}
        <Card className="col-span-1 md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">Income vs Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomPieChart data={profitData} height={250} />
          </CardContent>
        </Card>

        {/* Collection Status */}
        <Card className="col-span-1 md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">Total Fee Collection Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomPieChart data={collectionStatusData} height={250} />
          </CardContent>
        </Card>

        {/* Quick Actions Row - Horizontal Scroll on Mobile */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-4 md:grid md:grid-cols-4 min-w-[900px] md:min-w-0">
            {/* New Student */}
            <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-1">
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
            <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-1">
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

            {/* Report */}
            <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-1">
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
            <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-1 w-full">
              <Link href={`${process.env.NEXT_PUBLIC_FEEEASE_URL}/contactus/school`} className="block h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-bold">Contact Us</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-6">
                  <Headset className="h-10 w-10 mb-2" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-center">Ask for new features, Report a bug or issue etc.</span>
                </CardContent>
              </Link>
            </Card>
          </div>
        </div>
      </div>

      {/* Unpaid Students Table */}
      <UnpaidStudentsTable students={stats.unpaidStudents} />
    </div>
  )
}
