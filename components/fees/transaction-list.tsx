"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronLeft, ChevronRight, FileText, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { useState } from 'react'
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
import { deleteFeeTransaction } from '@/actions/fee-transactions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { BackButton } from "@/components/ui/back-button"

interface Transaction {
  id: string
  receiptNumber: string
  studentName: string
  studentRegNo: string
  studentPhoto?: string
  feeType: string
  month?: number
  year: number
  examType?: string
  amount: number
  status: string
  transactionDate: Date | string
  collectedBy: string
  remarks?: string
}

interface TransactionListProps {
  transactions: Transaction[]
  pagination: {
    currentPage: number
    totalPages: number
    totalRecords: number
    hasNext: boolean
    hasPrev: boolean
  }
  onPageChange: (page: number) => void
  isAdmin?: boolean
}

export function TransactionList({ transactions, pagination, onPageChange, isAdmin }: TransactionListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const result = await deleteFeeTransaction(deleteId)
      if (result.success) {
        toast.success("Transaction deleted successfully")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to delete transaction")
      }
    } catch {
      toast.error("An error occurred")
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-600">Verified</Badge>
      case 'pending':
        return <Badge className="bg-yellow-600">Pending</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getFeeDescription = (t: Transaction) => {
    if (t.feeType === 'monthly' && t.month) {
      const monthName = format(new Date(t.year, t.month - 1), 'MMM')
      return `Monthly - ${monthName} ${t.year}`
    }
    if (t.feeType === 'examination') {
      return `Exam - ${t.examType || 'Annual'} ${t.year}`
    }
    if (t.feeType === 'admission') {
      return `Admission - ${t.year}`
    }
    return `Other - ${t.year}`
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No transactions found</h3>
        <p className="text-muted-foreground">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <BackButton />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Receipt No</TableHead>
              <TableHead>Fee Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Collected By</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={t.studentPhoto} />
                      <AvatarFallback>{t.studentName[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{t.studentName}</div>
                      <div className="text-xs text-muted-foreground">{t.studentRegNo}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{t.receiptNumber}</TableCell>
                <TableCell>{getFeeDescription(t)}</TableCell>
                <TableCell className="font-semibold">₹{t.amount.toLocaleString()}</TableCell>
                <TableCell>{getStatusBadge(t.status)}</TableCell>
                <TableCell className="text-sm">
                  {format(new Date(t.transactionDate), 'dd MMM yyyy')}
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(t.transactionDate), 'hh:mm a')}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{t.collectedBy}</TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteId(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the fee transaction record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalRecords} total)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.currentPage - 1)}
              disabled={!pagination.hasPrev}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.currentPage + 1)}
              disabled={!pagination.hasNext}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
