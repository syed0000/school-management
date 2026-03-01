"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, FilePlus, UserRoundSearch, ClipboardList, X, CreditCard } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CustomLineChart } from "@/components/dashboard/charts/line-chart"
import { CustomPieChart } from "@/components/dashboard/charts/pie-chart"
import { PaymentsTable } from "@/components/dashboard/payments-table"

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
}

interface StaffDashboardContentProps {
    stats: StaffDashboardStats
}

export function StaffDashboardContent({ 
    stats, 
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

    const pendingChange = 0; // Not tracking history of pending count yet

    return (
        <div className="flex-1 space-y-4 p-8 pt-6 bg-background">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Staff Dashboard Overview</h2>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                
                {/* Row 1 */}
                {/* My Monthly Collections Chart - Large Card */}
                <Card className="col-span-2 row-span-1 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base font-bold">My Collections (Last 12 Months)</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                        Total Collection Recorded
                    </div>
                  </CardHeader>
                  <CardContent className="pl-0">
                    <CustomLineChart data={collectedData} color="#22c55e" height={200} />
                  </CardContent>
                </Card>

                {/* My Collections This Month */}
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-bold">My Collections (Month)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">₹{stats.myCollectionMonth.toLocaleString()}</div>
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
                    <div className="text-3xl font-bold">{stats.myPendingCount}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Transactions awaiting verification
                    </p>
                     <Progress value={100} className="mt-4 h-2" />
                  </CardContent>
                </Card>

                {/* Row 2 */}
                
                {/* My Collections Today */}
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-bold">My Collections (Today)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">₹{stats.myCollectionToday.toLocaleString()}</div>
                     <p className="text-xs text-muted-foreground mt-1">
                      {dayChange > 0 ? '+' : ''}{dayChange}% from yesterday
                    </p>
                     <Progress value={Math.max(0, Math.min(100, dayChange + 100))} className="mt-4 h-2" />
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

                {/* Collect Fee (Replaces New Class) */}
                <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
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

                {/* Transactions (Replaces Report) */}
                <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                     <Link href="/fees/transactions" className="block h-full">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold">Transactions</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col items-center justify-center py-6">
                        <ClipboardList className="h-10 w-10 mb-2" strokeWidth={1.5} />
                        <span className="text-sm font-medium text-center">View All Transactions</span>
                      </CardContent>
                    </Link>
                </Card>

                {/* Pending Fees Breakdown Chart - Large Card */}
                <Card className="col-span-3 row-span-1 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base font-bold">Global Pending Fees Breakdown</CardTitle>
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
                <Card className="col-span-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-bold">My Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CustomPieChart data={myPerformanceData} height={250} />
                    </CardContent>
                </Card>

                {/* Collection Status */}
                <Card className="col-span-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-bold">My Collection Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CustomPieChart data={collectionStatusData} height={250} />
                    </CardContent>
                </Card>

            </div>

            {/* Payments Table */}
            <Card className="col-span-4 shadow-sm mt-4">
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
