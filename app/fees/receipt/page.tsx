'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { ThermalReceipt } from '@/components/fees/thermal-receipt'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, Loader2 } from 'lucide-react'
import { getReceiptDetails } from '@/actions/fee-collection'
import { toast } from 'sonner'

interface ReceiptData {
    receiptNumber: string
    studentName: string
    studentRegNo: string
    rollNumber: string
    className: string
    section: string
    date: Date
    totalAmount: number
    items: {
        feeType: string
        amount: number
        months: number[]
        year: number
        examType?: string
        title?: string
        remarks?: string
    }[]
}

function ReceiptContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchReceipt = async () => {
        const receiptNumber = searchParams.get('receiptNumber')
        if (!receiptNumber) {
            setLoading(false)
            return
        }

        try {
            const data = await getReceiptDetails(receiptNumber)
            if (data) {
                // Convert date string/object to Date object
                setReceiptData({
                    ...data,
                    date: new Date(data.date),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    items: data.items as any
                })
            } else {
                toast.error("Receipt not found")
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to load receipt")
        } finally {
            setLoading(false)
        }
    }

    fetchReceipt()
  }, [searchParams])

  const handlePrint = () => {
    window.print()
  }

  const handleBack = () => {
    router.back()
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  if (!receiptData) {
    return <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Receipt not found or invalid receipt number.</p>
        <Button onClick={handleBack}>Go Back</Button>
    </div>
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Action Buttons - Hidden on print */}
        <div className="flex gap-4 mb-6 print:hidden">
          <Button variant="secondary" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Fee Collection
          </Button>

          <Button onClick={handlePrint} className="ml-auto">
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>
        </div>

        {/* Receipt Preview */}
        <div className="bg-white rounded-lg shadow-lg p-8 thermal-receipt-container">
          <ThermalReceipt receiptData={receiptData} />
        </div>

        {/* Print Styles */}
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .thermal-receipt, .thermal-receipt * {
              visibility: visible;
            }
            .thermal-receipt {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              max-width: 75mm;
              margin: 0 auto;
              padding: 0;
            }
            @page {
              size: 75mm auto;
              margin: 0;
            }
            /* Hide URL/Title headers if possible (browser dependent) */
          }
        `}</style>
      </div>
    </div>
  )
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading receipt...</div>}>
      <ReceiptContent />
    </Suspense>
  )
}
