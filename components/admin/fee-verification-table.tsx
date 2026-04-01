"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Transaction {
  id: string;
  date: string | Date;
  studentName: string;
  className: string;
  amount: number;
  feeType: string;
  paymentMethod?: string;
  referenceNumber?: string;
  receiptNumber?: string;
  regNo?: string;
  month?: number;
  year?: number;
}

interface FeeVerificationTableProps {
  initialTransactions: Transaction[]
}

export function FeeVerificationTable({ initialTransactions }: FeeVerificationTableProps) {
  const [transactions, setTransactions] = useState(initialTransactions)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoading, setIsLoading] = useState(false)

  const handleVerify = async (id: string, action: 'approve' | 'reject') => {
    try {
        // Optimistic update
        setTransactions(prev => prev.filter(t => t.id !== id));
        
        // Server action
        const { verifyFee } = await import("@/actions/fee");
        
        const result = await verifyFee(id, action); 
        
        if (!result.success) {
            toast.error(result.error || "Verification failed");
            // Revert optimistic update?
            // For simplicity, we just reload or show error.
            setTransactions(initialTransactions); // This might be stale, but safer.
        } else {
            toast.success(action === 'approve' ? "Fee approved" : "Fee rejected");
        }
    } catch (error) {
        console.error(error);
        toast.error("An error occurred");
    }
  }

  if (transactions.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No pending transactions</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Student</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Ref/Receipt</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => (
          <TableRow key={tx.id}>
            <TableCell>{format(new Date(tx.date), 'dd MMM yyyy')}</TableCell>
            <TableCell>
              <div>
                <p className="font-medium">{tx.studentName}</p>
                <p className="text-xs text-muted-foreground">{tx.className}</p>
              </div>
            </TableCell>
            <TableCell>₹{tx.amount}</TableCell>
            <TableCell className="capitalize">{tx.feeType}</TableCell>
            <TableCell>{tx.receiptNumber || tx.referenceNumber || '-'}</TableCell>
            <TableCell>
              <div className="flex space-x-2">
                <Button 
                    size="sm" 
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleVerify(tx.id, 'approve')}
                >
                    <Check className="h-4 w-4" />
                </Button>
                <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleVerify(tx.id, 'reject')}
                >
                    <X className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
