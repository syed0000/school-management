"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Trash2, FileText } from "lucide-react"
import { format } from "date-fns"
import { ExpenseDialog } from "./expense-dialog"
import { useState } from "react"
import { deleteExpense } from "@/actions/expense"
import { toast } from "sonner"
import { ImagePreview } from "@/components/ui/image-preview"
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

interface Expense {
  id: string
  title: string
  description?: string
  amount: number
  expenseDate: string
  category: string
  teacherId?: { _id: string; name: string } | null
  salaryMonth?: number
  salaryYear?: number
  receipt?: string
  createdBy?: { _id: string; name: string } | null
}

interface ExpenseTableProps {
  data: Expense[]
  teachers: { id: string; name: string; salary?: { amount: number } }[]
  userRole?: string
}

export function ExpenseTable({ data, teachers, userRole }: ExpenseTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!deleteId) return
    const result = await deleteExpense(deleteId)
    if (result.success) {
      toast.success("Expense deleted successfully")
    } else {
      toast.error(result.error || "Failed to delete expense")
    }
    setDeleteId(null)
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                  No expenses found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{format(new Date(expense.expenseDate), "dd MMM yyyy")}</TableCell>
                  <TableCell className="font-medium">
                    {expense.title}
                    {expense.teacherId && (
                      <div className="text-xs text-muted-foreground">
                        {expense.teacherId.name}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                      {expense.category}
                    </span>
                  </TableCell>
                  <TableCell>₹{expense.amount.toLocaleString()}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={expense.description}>
                    {expense.description || "-"}
                  </TableCell>
                  <TableCell>
                    {expense.receipt ? (
                      expense.receipt.startsWith("data:image") || expense.receipt.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                        <div className="h-10 w-10">
                          <ImagePreview 
                            src={expense.receipt} 
                            alt="Receipt" 
                            width={40} 
                            height={40} 
                          />
                        </div>
                      ) : (
                        <a href={expense.receipt} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                          <FileText className="h-4 w-4" /> View
                        </a>
                      )
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <ExpenseDialog 
                        mode="edit" 
                        expense={expense} 
                        teachers={teachers} 
                      />
                      {userRole === 'admin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteId(expense.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open: boolean) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the expense record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
