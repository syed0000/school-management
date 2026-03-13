"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, FilePlus, UserRoundSearch, ClipboardList, X } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { CustomLineChart } from "@/components/dashboard/charts/line-chart"
import { PaymentsTable } from "@/components/dashboard/payments-table"

interface Payment {
  id: string
  amount: number
  studentName: string
  contactNumber: string
  studentPhoto?: string
  status: string
  type?: string
  month?: number
  year?: number
  transactionDate?: Date
}

interface OverviewItem {
  name: string
  collected: number
  pending: number
}

interface DashboardLayoutNewStats {
  collected: number
  pending: number
  unpaid: number
  overview: OverviewItem[]
  recentSales: Payment[]
}

interface DashboardLayoutNewProps {
  stats: DashboardLayoutNewStats
}

export function DashboardLayoutNew({ stats }: DashboardLayoutNewProps) {
  // Map overview data for charts
  const collectedData = stats.overview.map((item) => ({
    name: item.name,
    value: item.collected
  }))

  const pendingData = stats.overview.map((item) => ({
    name: item.name,
    value: item.pending
  }))

  // Calculate percentage change (mock logic or real if available)
  // Assuming `stats` has logic for percentage change, or we just display static/calculated
  const revenueChange = 25 // Placeholder
  const pendingChange = 10 // Placeholder

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2 mb-6">
        <div className="flex items-center gap-2">
           <span className="font-bold text-2xl tracking-tight flex items-center gap-1">
             fee<span className="bg-blue-600 text-white px-1 rounded ml-0.5">E</span>ase
           </span>
           <X className="h-4 w-4 text-purple-600 mx-2" />
           <span className="text-muted-foreground">Logo Here</span>
        </div>
        <div className="flex items-center space-x-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border">
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                    YT
                </div>
                <span>You Tom</span>
            </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        
        {/* Total Amount Collected Chart - Large Card */}
        <Card className="col-span-2 row-span-1 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold">Total amount collected each month</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                Total Collection Recorded
            </div>
          </CardHeader>
          <CardContent className="pl-0">
            <CustomLineChart data={collectedData} color="#22c55e" height={200} />
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{stats.collected.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +{revenueChange}% from last week
            </p>
            <Progress value={revenueChange} className="mt-4 h-2" />
          </CardContent>
        </Card>

        {/* Pending This Month */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold">Pending This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{stats.pending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +{pendingChange}% from last month
            </p>
             <Progress value={pendingChange} className="mt-4 h-2" />
          </CardContent>
        </Card>

        {/* Row 2 */}
        
        {/* Reminders */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold">Reminders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{stats.unpaid.toLocaleString()}</div>
             <p className="text-xs text-muted-foreground mt-1">
              +{pendingChange}% from last month
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

        {/* Row 3 */}

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

        {/* Pending Fees Chart - Large Card */}
        <Card className="col-span-3 row-span-1 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold">Pending Fees</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                Total Collection Recorded
            </div>
          </CardHeader>
          <CardContent className="pl-0">
            <CustomLineChart data={pendingData} color="#ef4444" height={200} />
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card className="col-span-4 shadow-sm mt-4">
        <CardHeader>
          <CardTitle className="text-base font-bold">Payments</CardTitle>
          <CardDescription>Most recent paid fees.</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentsTable payments={stats.recentSales} />
        </CardContent>
      </Card>
    </div>
  )
}
