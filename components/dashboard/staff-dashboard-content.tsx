"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, UserRoundSearch, CreditCard, ArrowLeft, Headset } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { CustomLineChart } from "@/components/dashboard/charts/line-chart"
import { CustomPieChart } from "@/components/dashboard/charts/pie-chart"
import { PaymentsTable } from "@/components/dashboard/payments-table"
import { UnpaidStudentsTable, UnpaidStudent } from "@/components/dashboard/unpaid-students-table"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/utils"

interface StaffDashboardStats {
  myCollectionToday: number
  myCollectionMonth: number
  myCollectionLastMonth: number
  myCollectionYesterday: number
  myPendingCount: number
  studentsAdmittedToday: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recentTransactions: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  monthlyCollections: any[] // For line chart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalPendingTrend: any[] // For second line chart
  totalCollected: number
  totalPending: number
  totalRejected: number
  unpaidStudents: UnpaidStudent[]
}

interface StaffDashboardContentProps {
  stats: StaffDashboardStats
  isAdmin?: boolean
}

export function StaffDashboardContent({
  stats,
  isAdmin = false
}: StaffDashboardContentProps) {

  // Map data for charts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collectedData = stats.monthlyCollections.map((item: any) => ({
    name: item.name,
    value: item.value
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingData = stats.globalPendingTrend.map((item: any) => ({
    name: item.name,
    value: item.value
  }))

  const collectionStatusData = [
    { name: 'Verified', value: stats.totalCollected, color: '#22c55e' },
    { name: 'Pending', value: stats.totalPending, color: '#eab308' },
    { name: 'Rejected', value: stats.totalRejected, color: '#ef4444' }
  ]

  // Placeholder for "Income vs Expense" - Staff doesn't see expense.
  // Let's show "My Verified vs Pending"
  const myPerformanceData = [
    { name: 'Verified', value: stats.totalCollected, color: '#22c55e' },
    { name: 'Pending', value: stats.totalPending, color: '#eab308' }
  ]

  const monthChange = stats.myCollectionLastMonth > 0
    ? Math.round(((stats.myCollectionMonth - stats.myCollectionLastMonth) / stats.myCollectionLastMonth) * 100)
    : (stats.myCollectionMonth > 0 ? 100 : 0);

  const dayChange = stats.myCollectionYesterday > 0
    ? Math.round(((stats.myCollectionToday - stats.myCollectionYesterday) / stats.myCollectionYesterday) * 100)
    : (stats.myCollectionToday > 0 ? 100 : 0);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 bg-background">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Staff Dashboard Overview</h2>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link href="/admin/dashboard">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Admin Dashboard
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">

        {/* Row 1 */}
        {/* My Monthly Collections Chart - Large Card */}
        <Card className="col-span-1 md:col-span-2 row-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold">My Collections (Last 12 Months)</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              Total Collection Recorded
            </div>
          </CardHeader>
          <CardContent className="pl-0">
            <CustomLineChart data={collectedData} color="#22c55e" height={320} />
          </CardContent>
        </Card>

        {/* My Collections This Month */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold">My Collections (Month)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{formatNumber(stats.myCollectionMonth)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {monthChange > 0 ? '+' : ''}{monthChange}% from last month
            </p>
            <Progress value={Math.max(0, Math.min(100, monthChange + 100))} className="mt-4 h-2" />
          </CardContent>
        </Card>

        {/* My Pending Approvals */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold">My Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatNumber(stats.myPendingCount)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Transactions awaiting verification
            </p>
            <Progress value={100} className="mt-4 h-2" />
          </CardContent>
        </Card>

        {/* My Collections Today */}
        <Card className="shadow-sm col-span-1 md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold">My Collections (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{formatNumber(stats.myCollectionToday)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dayChange > 0 ? '+' : ''}{dayChange}% from yesterday
            </p>
            <Progress value={Math.max(0, Math.min(100, dayChange + 100))} className="mt-4 h-2" />
          </CardContent>
        </Card>

        {/* Quick Actions Row - Horizontal Scroll on Mobile */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-4 md:grid md:grid-cols-4 min-w-[900px] md:min-w-0">
            {/* New Student */}
            <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-1 w-full">
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

            {/* Collect Fee (Replaces New Class) */}
            <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-1 w-full">
              <Link href="/fees/collect" className="block h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-bold">Collect Fee</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-6">
                  <CreditCard className="h-10 w-10 mb-2" strokeWidth={1.5} />
                  <span className="text-sm font-medium">Collect Fee</span>
                </CardContent>
              </Link>
            </Card>

            {/* Find */}
            <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-1 w-full">
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

        {/* Pending Fees Chart - Large Card */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-4 row-span-1 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold">Global Pending Fees</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
              Total Pending Recorded
            </div>
          </CardHeader>
          <CardContent className="pl-0">
            <CustomLineChart data={pendingData} color="#ef4444" height={200} />
          </CardContent>
        </Card>

        {/* Row 4 - New Charts */}

        {/* My Performance */}
        <Card className="col-span-1 md:col-span-1 lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">My Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomPieChart data={myPerformanceData} height={250} />
          </CardContent>
        </Card>

        {/* Collection Status */}
        <Card className="col-span-1 md:col-span-1 lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">My Collection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomPieChart data={collectionStatusData} height={250} />
          </CardContent>
        </Card>

      </div>

      <UnpaidStudentsTable students={stats.unpaidStudents} />

      {/* Payments Table */}
      <Card className="col-span-1 md:col-span-2 lg:col-span-4 shadow-sm mt-4">
        <CardHeader>
          <CardTitle className="text-base font-bold">Recent Payments</CardTitle>
          <CardDescription>Most recent paid fees by you.</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentsTable payments={stats.recentTransactions} />
        </CardContent>
      </Card>
    </div>
  )
}
