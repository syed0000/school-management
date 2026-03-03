import { getPendingFees } from "@/actions/fee"
import { FeeVerificationTable } from "@/components/admin/fee-verification-table"
import { BackButton } from "@/components/ui/back-button"

export const dynamic = 'force-dynamic'

export default async function FeeVerificationPage() {
  const pendingFees = await getPendingFees()

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <BackButton />
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Fee Verification</h2>
      </div>
      <FeeVerificationTable initialTransactions={pendingFees} />
    </div>
  )
}
