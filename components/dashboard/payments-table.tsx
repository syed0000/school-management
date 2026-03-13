"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import { formatNumber } from "@/lib/utils"

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

interface PaymentsTableProps {
  payments: Payment[]
}

export function PaymentsTable({ payments }: PaymentsTableProps) {
  if (payments.length === 0) {
    return <div className="text-sm text-muted-foreground p-4">No recent transactions.</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student Name</TableHead>
          <TableHead className="hidden sm:table-cell">Type (Monthly/ Examination)</TableHead>
          <TableHead className="hidden sm:table-cell">Month/ Exam</TableHead>
          <TableHead className="hidden md:table-cell">Date</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => {
          const monthName = payment.month 
            ? new Date(0, payment.month - 1).toLocaleString('default', { month: 'long' }) 
            : null;
          
          const displayMonth = payment.type === 'monthly' && monthName 
            ? monthName 
            : payment.year?.toString();

          return (
            <TableRow key={payment.id}>
              <TableCell>
                <div className="font-medium">{payment.studentName}</div>
                <div className="hidden text-sm text-muted-foreground md:inline">
                  {payment.contactNumber}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell capitalize">
                {payment.type || 'N/A'}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {displayMonth || 'N/A'}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {payment.transactionDate ? format(new Date(payment.transactionDate), 'dd-MM-yyyy') : 'N/A'}
              </TableCell>
              <TableCell className="text-right font-medium">
                ₹{formatNumber(payment.amount)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
