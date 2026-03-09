import { getFeeTransactions, getTransactionStats } from '@/actions/fee-transactions'
import { TransactionContent } from '@/components/fees/transaction-content'
import { getClasses } from '@/actions/class'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbConnect from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function TransactionsPage() {
  await dbConnect() // Ideally this should be inside actions, but session might need it? 
  // Wait, session uses authOptions which uses adapter or manual db call? 
  // next-auth usually handles its own connection or uses the adapter.
  // We can remove dbConnect if actions handle their own connection.
  
  const session = await getServerSession(authOptions)
  const isAdmin = session?.user.role === 'admin'

  // Initial load with no filters
  const page = 1
  const filter = {}

  const [{ transactions, pagination }, stats, classes] = await Promise.all([
    getFeeTransactions(filter, page),
    getTransactionStats(filter),
    getClasses()
  ])

  return (
    <TransactionContent
      initialTransactions={transactions}
      initialPagination={pagination}
      initialStats={stats}
      classes={classes}
      isAdmin={isAdmin}
    />
  )
}
