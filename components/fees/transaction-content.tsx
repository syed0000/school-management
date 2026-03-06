"use client"

import { useState, useTransition } from "react"
import { getFeeTransactions, getTransactionStats } from "@/actions/fee-transactions"
import { TransactionList } from "@/components/fees/transaction-list"
import { TransactionFilters } from "@/components/fees/transaction-filters"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Clock, XCircle, Printer } from 'lucide-react'
import { BackButton } from "../ui/back-button"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface Transaction {
  id: string;
  receiptNumber: string;
  studentName: string;
  studentRegNo: string;
  studentPhoto?: string;
  className: string;
  feeType: string;
  month?: number;
  year: number;
  examType?: string;
  amount: number;
  status: string;
  transactionDate: Date | string;
  collectedBy: string;
  remarks?: string;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface Stats {
  verified: { count: number; amount: number };
  pending: { count: number; amount: number };
  rejected: { count: number; amount: number };
}

interface TransactionContentProps {
  initialTransactions: Transaction[]
  initialPagination: Pagination
  initialStats: Stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  classes: any[]
  isAdmin: boolean
}

export function TransactionContent({
  initialTransactions,
  initialPagination,
  initialStats,
  classes,
  isAdmin
}: TransactionContentProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [pagination, setPagination] = useState<Pagination>(initialPagination)
  const [stats, setStats] = useState<Stats>(initialStats)
  const [isPending, startTransition] = useTransition()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const router = useRouter()

  // Keep track of current filters to support pagination
  const [currentFilters, setCurrentFilters] = useState<{
    search?: string
    classId?: string
    feeType?: string
    status?: string
    startDate?: string
    endDate?: string
    month?: number
    year?: number
  }>({})

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchData = (filters: any, page: number) => {
    startTransition(async () => {
      const filterObj = {
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        classId: filters.classId,
        feeType: filters.feeType,
        status: filters.status,
        searchQuery: filters.search,
        month: filters.month,
        year: filters.year
      }

      const [listData, statsData] = await Promise.all([
        getFeeTransactions(filterObj, page),
        getTransactionStats(filterObj)
      ])

      // Cast the result to match the interface, handling date string/Date differences
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txs = listData.transactions.map((t: any) => ({
        ...t,
        transactionDate: new Date(t.transactionDate)
      })) as Transaction[];

      setTransactions(txs)
      setPagination(listData.pagination)
      setStats(statsData)
      setSelectedIds([])
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFilter = (filters: any) => {
    setCurrentFilters(filters)
    fetchData(filters, 1)
  }

  const handlePageChange = (page: number) => {
    fetchData(currentFilters, page)
  }

  const handlePrint = () => {
    if (selectedIds.length === 0) return

    const selectedTransactions = transactions.filter(t => selectedIds.includes(t.id))
    
    // Validation: Check if all transactions belong to the same student
    const firstStudent = selectedTransactions[0]
    const isSameStudent = selectedTransactions.every(t => t.studentRegNo === firstStudent.studentRegNo)

    if (!isSameStudent) {
      toast.error("Please select transactions for the same student only")
      return
    }

    // Aggregate data
    const totalAmount = selectedTransactions.reduce((sum, t) => sum + t.amount, 0)
    const months = selectedTransactions
      .filter(t => t.feeType === 'monthly' && t.month)
      .map(t => t.month)
      .filter((m): m is number => m !== undefined)
    
    // Remove duplicates and sort months
    const uniqueMonths = Array.from(new Set(months)).sort((a, b) => a - b)

    // Determine fee type and title
    let feeType = selectedTransactions[0].feeType
    let title = ''

    // If multiple transactions with different types or all monthly
    if (selectedTransactions.length > 1) {
      const allMonthly = selectedTransactions.every(t => t.feeType === 'monthly')
      if (allMonthly) {
        feeType = 'monthly'
      } else {
        feeType = 'other'
        title = 'Combined Fee Payment'
      }
    } else {
      // Single transaction - preserve original details including examType/title
      if (feeType === 'examination') {
         // Pass examType as part of the URL if needed, or rely on ReceiptPage using 'examType' param
      }
    }

    const params = new URLSearchParams({
      receiptNumber: selectedTransactions.map(t => t.receiptNumber).join(','),
      studentName: firstStudent.studentName,
      studentRegNo: firstStudent.studentRegNo,
      className: firstStudent.className,
      feeType: feeType,
      amount: totalAmount.toString(),
      year: firstStudent.year.toString(),
    })

    if (uniqueMonths.length > 0) {
      params.set('months', uniqueMonths.join(','))
    }

    if (title) {
      params.set('title', title)
    }
    
    // For single transaction specific fields
    if (selectedTransactions.length === 1) {
       if (firstStudent.examType) params.set('examType', firstStudent.examType)
       // If there is a specific title in the transaction (e.g. for 'other' fee type)
       // But 'title' is not in Transaction interface explicitly? Let's check.
       // Transaction interface has: feeType, month, year, examType, remarks. No 'title'.
       // But ReceiptPage expects 'title'. 
       // Maybe 'remarks' could be used? Or 'feeType' === 'other' might imply something.
       // Looking at TransactionList, getFeeDescription handles:
       // admission -> "Admission - {year}"
       // examination -> "Exam - {examType} {year}"
       // other -> "Other - {year}"
    }

    router.push(`/fees/receipt?${params.toString()}`)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Fee Transactions</h1>
          <p className="text-muted-foreground">View and manage all fee transactions</p>
        </div>
        <div className="flex gap-2">
           {selectedIds.length > 0 && (
             <Button onClick={handlePrint}>
               <Printer className="mr-2 h-4 w-4" />
               Print Receipt ({selectedIds.length})
             </Button>
           )}
        </div>
      </div>
      <BackButton />
      <div className={`grid gap-4 md:grid-cols-3 ${isPending ? 'opacity-50' : ''}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.verified.amount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{stats.verified.count} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.pending.amount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{stats.pending.count} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.rejected.amount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{stats.rejected.count} transactions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionFilters
            classes={classes}
            onFilter={handleFilter}
            isLoading={isPending}
          />
        </CardContent>
      </Card>

      <Card className={isPending ? 'opacity-50 pointer-events-none' : ''}>
        <CardHeader>
          <CardTitle>Transactions ({pagination.totalRecords})</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionList
            transactions={transactions}
            pagination={pagination}
            onPageChange={handlePageChange}
            isAdmin={isAdmin}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </CardContent>
      </Card>
    </div>
  )
}
