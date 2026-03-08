import Image from 'next/image'
import { format } from 'date-fns'
import { schoolConfig } from '@/lib/config'

interface ReceiptProps {
    receiptData: {
        receiptNumber: string
        studentName: string
        studentRegNo: string
        rollNumber: string
        className: string
        section: string
        feeType: string
        months?: number[]
        year: number
        examType?: string
        title?: string
        remarks?: string
        amount: number
        date: Date
    }
}

export function ThermalReceipt({ receiptData }: ReceiptProps) {
    const getFeeDescription = () => {
        const { feeType, months, year, examType, title } = receiptData

        if (feeType === 'monthly' && months && months.length > 0) {
            const monthNames = months.map(m => format(new Date(year, m - 1), 'MMM')).join(', ')
            if (months.length === 1) {
                return `Monthly Fee - ${monthNames} ${year}`
            }
            return `Monthly Fee - ${monthNames} ${year}`
        }

        if (feeType === 'examination') {
            return `Examination Fee - ${examType || title || 'Annual'} ${year}`
        }

        if (feeType === 'admission' || feeType === 'admissionFees') {
            return `Admission Fee - ${year}`
        }

        if (feeType === 'registrationFees') {
            return `Registration Fee - ${year}`
        }

        if (feeType === 'other') {
            return title || 'Other Fee'
        }

        return 'Fee Payment'
    }

    return (
        <div className="thermal-receipt bg-white text-black p-6 max-w-[80mm] mx-auto font-mono text-sm">
            {/* School Logo/Emblem */}
            <div className="flex justify-center mb-4 relative h-[120px]">
                <Image 
                    src="/dark-logo.jpeg" 
                    alt="School Logo" 
                    className="object-contain"
                    fill
                    sizes="120px"
                    priority
                />
            </div>

            {/* School Name */}
            <div className="text-center mb-6">
                <h1 className="text-xl font-bold">{schoolConfig.name}</h1>
                <p className="text-xs mt-1">Fee Receipt</p>
            </div>

            {/* Divider */}
            <div className="border-t-2 border-dashed border-black my-4"></div>

            {/* Receipt Details */}
            <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                    <span className="font-semibold">Receipt No:</span>
                    <span>{receiptData.receiptNumber}</span>
                </div>

                <div className="flex justify-between">
                    <span className="font-semibold">Date:</span>
                    <span>{format(receiptData.date, 'dd MMM yyyy')}</span>
                </div>

                <div className="flex justify-between">
                    <span className="font-semibold">Time:</span>
                    <span>{format(receiptData.date, 'hh:mm a')}</span>
                </div>
            </div>

            {/* Divider */}
            <div className="border-t-2 border-dashed border-black my-4"></div>

            {/* Student Details */}
            <div className="space-y-2 text-xs">
                <div>
                    <span className="font-semibold">Student Name:</span>
                    <span className="ml-2">{receiptData.studentName}</span>
                </div>

                <div className="flex justify-between">
                    <span className="font-semibold">Reg. No:</span>
                    <span>{receiptData.studentRegNo}</span>
                </div>

                <div className="flex justify-between">
                    <span className="font-semibold">Class / Sec:</span>
                    <span>{receiptData.className} - {receiptData.section}</span>
                </div>

                <div className="flex justify-between">
                    <span className="font-semibold">Roll No:</span>
                    <span>{receiptData.rollNumber}</span>
                </div>
            </div>

            {/* Divider */}
            <div className="border-t-2 border-dashed border-black my-4"></div>

            {/* Fee Details */}
            <div className="space-y-2 text-xs">
                <div>
                    <span className="font-semibold">Fee Type:</span>
                    <div className="ml-2 mt-1">{getFeeDescription()}</div>
                </div>

                <div className="flex justify-between items-center mt-4 text-base font-bold">
                    <span>Amount Paid:</span>
                    <span>₹{receiptData.amount.toLocaleString()}</span>
                </div>
            </div>

            {/* Divider */}
            <div className="border-t-2 border-dashed border-black my-4"></div>

            {/* Footer Notes */}
            <div className="text-xs space-y-2">
                <p className="font-semibold">कृपया समय पर फीस जमा करें</p>
                <p>कृपया बच्चे की फीस जमा करते समय डायरी अपने साथ लाये</p>
                <p>कृपया अपने बच्चे को पढ़ाई में सहयोग करें</p>
                <p>बच्चे को समय पर स्कूल भेजे</p>
            </div>

            {/* Divider */}
            <div className="border-t-2 border-dashed border-black my-4"></div>

            {/* Thank You */}
            <div className="text-center text-xs">
                <p className="font-semibold">Thank You!</p>
            </div>
        </div>
    )
}
