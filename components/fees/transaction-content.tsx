"use client"

import { useState, useTransition } from "react"
import { getFeeTransactions, getTransactionStats, normalizeLegacyEntryFeeTypes, reclassifyAdmissionConflictsToRegistration, scanAdmissionRegistrationConflicts } from "@/actions/fee-transactions"
import { TransactionList } from "@/components/fees/transaction-list"
import { TransactionFilters } from "@/components/fees/transaction-filters"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Clock, XCircle, Printer } from 'lucide-react'
import { BackButton } from "../ui/back-button"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getCurrentSessionRange } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"


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
  const [conflictPreview, setConflictPreview] = useState<{
    scanned: number
    matched: number
    conflicts: Array<{
      transactionId: string
      receiptNumber: string
      studentName: string
      studentRegNo: string
      className: string
      year: number
      amount: number
      admissionFee: number
      registrationFee: number
      transactionDate: Date | string
      currentFeeType: string
    }>
  } | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isFixing, setIsFixing] = useState(false)
  const [isNormalizing, setIsNormalizing] = useState(false)
  const [confirmFixOpen, setConfirmFixOpen] = useState(false)
  const [confirmNormalizeOpen, setConfirmNormalizeOpen] = useState(false)
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
  }>(() => {
    const { from, to } = getCurrentSessionRange()
    return {
      startDate: from.toISOString().split('T')[0],
      endDate: to.toISOString().split('T')[0]
    }
  })

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

  const handleScanConflicts = async () => {
    if (!isAdmin) return
    setIsScanning(true)
    try {
      const res = await scanAdmissionRegistrationConflicts({ limit: 2000 })
      if (!res || !('success' in res) || !res.success) {
        const err = res && 'error' in (res as unknown as { error?: string }) ? (res as unknown as { error?: string }).error : undefined
        toast.error(err || "Failed to scan conflicts")
        return
      }
      const conflicts = 'conflicts' in (res as unknown as { conflicts?: unknown[] }) ? ((res as unknown as { conflicts?: unknown[] }).conflicts || []) : []
      const scanned = 'scanned' in (res as unknown as { scanned?: number }) ? ((res as unknown as { scanned?: number }).scanned || 0) : 0
      const matched = 'matched' in (res as unknown as { matched?: number }) ? ((res as unknown as { matched?: number }).matched || conflicts.length) : conflicts.length
      setConflictPreview({
        scanned,
        matched,
        conflicts: (conflicts as Array<{ transactionDate: Date | string }>).map((c) => ({
          ...(c as unknown as Record<string, unknown>),
          transactionDate: new Date(c.transactionDate),
        })) as unknown as NonNullable<typeof conflictPreview>["conflicts"],
      })
      if (matched === 0) {
        toast.success("No conflicts found in the scanned range")
      } else {
        toast.success(`Found ${matched} conflict(s)`)
      }
    } catch {
      toast.error("Failed to scan conflicts")
    } finally {
      setIsScanning(false)
    }
  }

  const handleFixConflicts = async () => {
    if (!isAdmin) return
    if (!conflictPreview || conflictPreview.conflicts.length === 0) return
    setIsFixing(true)
    try {
      const ids = conflictPreview.conflicts.map((c) => c.transactionId)
      const res = await reclassifyAdmissionConflictsToRegistration(ids)
      if (!res || !('success' in res) || !res.success) {
        const err = res && 'error' in (res as unknown as { error?: string }) ? (res as unknown as { error?: string }).error : undefined
        toast.error(err || "Failed to fix conflicts")
        return
      }
      const updated = 'updated' in res ? (res.updated as number) : 0
      const skipped = 'skipped' in res ? (res.skipped as number) : 0
      toast.success(`Updated ${updated} transaction(s), skipped ${skipped}`)
      setConflictPreview(null)
      router.refresh()
    } catch {
      toast.error("Failed to fix conflicts")
    } finally {
      setIsFixing(false)
      setConfirmFixOpen(false)
    }
  }

  const handleNormalizeFeeTypes = async () => {
    if (!isAdmin) return
    setIsNormalizing(true)
    try {
      const res = await normalizeLegacyEntryFeeTypes()
      if (!res || !('success' in res) || !res.success) {
        const err = res && 'error' in (res as unknown as { error?: string }) ? (res as unknown as { error?: string }).error : undefined
        toast.error(err || "Failed to normalize fee types")
        return
      }
      const updatedTx = 'updatedFeeTransactions' in res ? (res.updatedFeeTransactions as number) : 0
      const updatedFees = 'updatedClassFees' in res ? (res.updatedClassFees as number) : 0
      toast.success(`Normalized: ${updatedTx} transactions, ${updatedFees} class fees`)
      router.refresh()
    } catch {
      toast.error("Failed to normalize fee types")
    } finally {
      setIsNormalizing(false)
      setConfirmNormalizeOpen(false)
    }
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

      {isAdmin && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle>Admission/Registration Conflict Fix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              This tool reclassifies entry-fee transactions that are marked as Admission but look like Registration (amount is lower than configured Admission fee). Use only after confirming your fee settings are correct.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleScanConflicts} disabled={isScanning || isFixing}>
                {isScanning ? "Scanning..." : "Preview Conflicts"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmFixOpen(true)}
                disabled={isScanning || isFixing || !conflictPreview || conflictPreview.conflicts.length === 0}
              >
                {isFixing ? "Fixing..." : `Fix ${conflictPreview?.conflicts.length ?? 0} Conflicts`}
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmNormalizeOpen(true)}
                disabled={isScanning || isFixing || isNormalizing}
              >
                {isNormalizing ? "Normalizing..." : "Normalize Fee Types"}
              </Button>
              {conflictPreview && (
                <Button variant="ghost" onClick={() => setConflictPreview(null)} disabled={isScanning || isFixing}>
                  Clear
                </Button>
              )}
            </div>

            {conflictPreview && (
              <div className="text-sm">
                Scanned: {conflictPreview.scanned} • Matched: {conflictPreview.matched} • Showing: {Math.min(conflictPreview.conflicts.length, 20)}
              </div>
            )}

            {conflictPreview && conflictPreview.conflicts.length > 0 && (
              <div className="rounded-md border bg-background overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Student</th>
                      <th className="text-left p-2">Receipt</th>
                      <th className="text-left p-2">Class</th>
                      <th className="text-left p-2">Year</th>
                      <th className="text-left p-2">Amount</th>
                      <th className="text-left p-2">Admission</th>
                      <th className="text-left p-2">Registration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflictPreview.conflicts.slice(0, 20).map((c) => (
                      <tr key={c.transactionId} className="border-b last:border-0">
                        <td className="p-2">{c.studentName} ({c.studentRegNo})</td>
                        <td className="p-2 font-mono">{c.receiptNumber}</td>
                        <td className="p-2">{c.className}</td>
                        <td className="p-2">{c.year}</td>
                        <td className="p-2">₹{Number(c.amount).toLocaleString()}</td>
                        <td className="p-2">₹{Number(c.admissionFee).toLocaleString()}</td>
                        <td className="p-2">₹{Number(c.registrationFee).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <AlertDialog open={confirmFixOpen} onOpenChange={setConfirmFixOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reclassify transactions?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will change feeType from Admission to Registration for the previewed transactions. This is a data correction and cannot be undone automatically.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isFixing}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleFixConflicts} disabled={isFixing}>
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={confirmNormalizeOpen} onOpenChange={setConfirmNormalizeOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Normalize legacy fee types?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will convert legacy values to canonical ones (Admission → admissionFees, Registration → registrationFees) in transactions and class fee configuration.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isNormalizing}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleNormalizeFeeTypes} disabled={isNormalizing}>
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

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
