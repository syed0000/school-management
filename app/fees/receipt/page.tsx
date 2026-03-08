'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { ThermalReceipt } from '@/components/fees/thermal-receipt'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft } from 'lucide-react'

function ReceiptContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const receiptData = {
    receiptNumber: searchParams.get('receiptNumber') || '',
    studentName: searchParams.get('studentName') || '',
    studentRegNo: searchParams.get('studentRegNo') || '',
    rollNumber: searchParams.get('rollNumber') || '',
    className: searchParams.get('className') || '',
    section: searchParams.get('section') || '',
    feeType: searchParams.get('feeType') || 'monthly',
    months: searchParams.get('months')?.split(',').map(Number) || [],
    year: Number(searchParams.get('year')) || new Date().getFullYear(),
    examType: searchParams.get('examType') || '',
    title: searchParams.get('title') || '',
    remarks: searchParams.get('remarks') || '',
    amount: Number(searchParams.get('amount')) || 0,
    date: searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date()
  }

  const handlePrint = () => {
    window.print()
  }

  const handleBack = () => {
    router.back()
  }

  if (!receiptData) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
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
