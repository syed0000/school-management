"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useParams, useRouter } from 'next/navigation'
import { BackButton } from "@/components/ui/back-button"
import { useI18n } from "@/components/i18n-provider"
import { defaultLocale, hasLocale } from "@/lib/i18n"

interface Transaction {
  id: string
  receiptNumber: string
  studentName: string
  studentRegNo: string
  studentPhoto?: string
  className?: string
  section?: string
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
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
}

export function TransactionList({ transactions, pagination, onPageChange, isAdmin, selectedIds, onSelectionChange }: TransactionListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const { t } = useI18n()
  const params = useParams<{ lang?: string }>()
  const lang = hasLocale(params.lang ?? "") ? (params.lang as string) : defaultLocale

  const fmtMonthShort = (year: number, month1Based: number) => {
    try {
      return new Intl.DateTimeFormat(lang, { month: "short" }).format(new Date(year, month1Based - 1, 1))
    } catch {
      return format(new Date(year, month1Based - 1, 1), "MMM")
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Validation: Ensure all visible transactions belong to the same student
      const uniqueStudents = new Set(transactions.map(t => t.studentRegNo))
      if (uniqueStudents.size > 1) {
        toast.error(t("transactions.toastSelectAllMultiStudent", "Cannot select all: The list contains transactions from multiple students. Please filter by a specific student first."))
        return
      }

      const allIds = transactions.map(t => t.id)
      onSelectionChange(allIds)
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      // Validation: Ensure the new selection belongs to the same student as existing selections
      if (selectedIds.length > 0) {
        const firstSelectedId = selectedIds[0]
        const firstSelectedTransaction = transactions.find(t => t.id === firstSelectedId)
        const newTransaction = transactions.find(t => t.id === id)

        if (firstSelectedTransaction && newTransaction &&
          firstSelectedTransaction.studentRegNo !== newTransaction.studentRegNo) {
          toast.error(t("transactions.toastSelectDifferentStudents", "Cannot select transactions from different students. Please clear your selection first."))
          return
        }
      }
      onSelectionChange([...selectedIds, id])
    } else {
      onSelectionChange(selectedIds.filter(sid => sid !== id))
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const result = await deleteFeeTransaction(deleteId)
      if (result.success) {
        toast.success(t("transactions.toastDeleted", "Transaction deleted successfully"))
        router.refresh()
      } else {
        toast.error(result.error || t("transactions.toastDeleteFailed", "Failed to delete transaction"))
      }
    } catch {
      toast.error(t("transactions.toastGenericError", "An error occurred"))
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-600">{t("transactions.statusVerified", "Verified")}</Badge>
      case 'pending':
        return <Badge className="bg-yellow-600">{t("transactions.statusPending", "Pending")}</Badge>
      case 'rejected':
        return <Badge variant="destructive">{t("transactions.statusRejected", "Rejected")}</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getFeeDescription = (tx: Transaction) => {
    const ft = (tx.feeType || '').toLowerCase();
    
    if (ft === 'monthly') {
      if (tx.month) {
        const monthName = fmtMonthShort(tx.year, tx.month)
        return `${t("transactions.feeMonthly", "Monthly")} - ${monthName} ${tx.year}`
      }
      return `${t("transactions.feeMonthly", "Monthly")} - ${tx.year}`
    }
    if (ft === 'examination') {
      return `${t("transactions.feeExam", "Exam")} - ${tx.examType || t("transactions.examAnnual", "Annual")} ${tx.year}`
    }
    if (ft === 'admission' || ft === 'admissionfees') {
      return `${t("transactions.feeAdmission", "Admission")} - ${tx.year}`
    }
    if (ft === 'registrationfees') {
      return `${t("transactions.feeRegistration", "Registration")} - ${tx.year}`
    }

    // Default formatting for any other type (e.g., custom or 'other')
    const displayStr = tx.feeType || t("transactions.feeOther", "Other");
    const spaced = displayStr.replace(/([A-Z])/g, ' $1').trim();
    const capitalized = spaced.charAt(0).toUpperCase() + spaced.slice(1);
    
    return `${capitalized} - ${tx.year}`;
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">{t("transactions.emptyTitle", "No transactions found")}</h3>
        <p className="text-muted-foreground">{t("transactions.emptySubtitle", "Try adjusting your filters")}</p>
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
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={transactions.length > 0 && selectedIds.length === transactions.length}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  aria-label={t("transactions.selectAll", "Select all")}
                />
              </TableHead>
              <TableHead className="w-12">{t("transactions.sNo", "S.No")}</TableHead>
              <TableHead>{t("transactions.student", "Student")}</TableHead>
              <TableHead>{t("transactions.receiptNo", "Receipt No")}</TableHead>
              <TableHead>{t("transactions.feeType", "Fee Type")}</TableHead>
              <TableHead>{t("transactions.amount", "Amount")}</TableHead>
              <TableHead>{t("transactions.status", "Status")}</TableHead>
              <TableHead>{t("transactions.date", "Date")}</TableHead>
              <TableHead>{t("transactions.collectedBy", "Collected By")}</TableHead>
              <TableHead>{t("transactions.remarks", "Remarks")}</TableHead>
              {isAdmin && <TableHead className="text-right">{t("transactions.actions", "Actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t, index) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(t.id)}
                    onCheckedChange={(checked) => handleSelectOne(t.id, !!checked)}
                    aria-label={`Select transaction ${t.receiptNumber}`}
                  />
                </TableCell>
                <TableCell>{index + 1 + (pagination.currentPage - 1) * 20}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={t.studentPhoto} />
                      <AvatarFallback>{t.studentName[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{t.studentName}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.studentRegNo} • {t.className} - {t.section || 'A'}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{t.receiptNumber}</TableCell>
                <TableCell>{getFeeDescription(t)}</TableCell>
                <TableCell className="font-semibold">₹{t.amount.toLocaleString()}</TableCell>
                <TableCell>{getStatusBadge(t.status)}</TableCell>
                <TableCell className="text-sm">
                  {format(new Date(t.transactionDate), 'dd MMM yyyy')}
                  {/* <div className="text-xs text-muted-foreground">
                    {format(new Date(t.transactionDate), 'hh:mm a')}
                  </div> */}
                </TableCell>
                <TableCell className="text-sm">{t.collectedBy}</TableCell>
                <TableCell className="text-sm">{t.remarks || '-'}</TableCell>
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
