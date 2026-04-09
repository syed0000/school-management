/* eslint-disable @next/next/no-img-element */
import { format } from 'date-fns'
import { schoolConfig } from '@/lib/config'
import { formatNumber } from "@/lib/utils"
import { normalizeFeeType } from '@/lib/fee-type'

interface ReceiptItem {
    feeType: string
    amount: number
    months: number[]
    year: number
    examType?: string
    title?: string
    remarks?: string
}

interface ReceiptProps {
    receiptData: {
        receiptNumber: string
        studentName: string
        studentRegNo: string
        rollNumber: string
        className: string
        section: string
        date: Date
        totalAmount: number
        items: ReceiptItem[]
    }
}

export function ThermalReceipt({ receiptData }: ReceiptProps) {
    const getFeeDescription = (item: ReceiptItem) => {
        const { months, year, examType, title } = item
        const feeType = normalizeFeeType(item.feeType)

        if (feeType === 'monthly' && months && months.length > 0) {
            // Sort months to be safe
            const sortedMonths = [...months].sort((a, b) => a - b);

            // Check if sequential
            let isSequential = true;
            for (let i = 0; i < sortedMonths.length - 1; i++) {
                if (sortedMonths[i + 1] !== sortedMonths[i] + 1) {
                    isSequential = false;
                    break;
                }
            }

            const monthNames = sortedMonths.map(m => format(new Date(year, m - 1), 'MMM')).join(', ')

            if (isSequential && sortedMonths.length > 2) {
                const first = format(new Date(year, sortedMonths[0] - 1), 'MMM');
                const last = format(new Date(year, sortedMonths[sortedMonths.length - 1] - 1), 'MMM');
                return `Monthly Fee (${first}-${last} ${year})`
            }

            return `Monthly Fee (${monthNames} ${year})`
        }

        if (feeType === 'examination') {
            return `Exam Fee - ${examType || title || 'Annual'} ${year}`
        }

        if (feeType === 'admissionFees') {
            return `Admission Fee - ${year}`
        }

        if (feeType === 'registrationFees') {
            return `Registration Fee - ${year}`
        }

        if (feeType === 'other') {
            return title || 'Other Fee'
        }

        return formatFeeLabel(feeType)
    }

    const formatFeeLabel = (type: string) => {
        return type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1').trim();
    }

    return (
        <div className="thermal-receipt bg-white text-black p-6 max-w-[80mm] mx-auto font-mono text-sm">
            {/* Institute Logo/Emblem */}
            <div className="flex justify-center mb-4 relative h-[120px]">
                {/* // eslint-disable-next-line @next/next/no-img-element, @next/next/no-img-element */}
                <img
                    src="/dark-logo.jpeg"
                    alt="Institute Logo"
                    className="object-contain"
                />
            </div>

            {/* Institute Name */}
            <div className="text-center mb-4">
                <h1 className="text-lg font-bold leading-tight">{schoolConfig.name}</h1>
                <p className="text-[10px] mt-1">Fee Receipt</p>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-black my-2"></div>

            {/* Receipt Details */}
            <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                    <span className="font-semibold">Receipt No:</span>
                    <span>{receiptData.receiptNumber}</span>
                </div>

                <div className="flex justify-between">
                    <span className="font-semibold">Date:</span>
                    <span>{format(receiptData.date, 'dd MMM yyyy, hh:mm a')}</span>
                </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-black my-2"></div>

            {/* Student Details */}
            <div className="space-y-1 text-[11px]">
                <div className="flex">
                    <span className="font-semibold w-20 shrink-0">Name:</span>
                    <span>{receiptData.studentName}</span>
                </div>

                <div className="flex">
                    <span className="font-semibold w-20 shrink-0">Reg. No:</span>
                    <span>{receiptData.studentRegNo}</span>
                </div>

                <div className="flex">
                    <span className="font-semibold w-20 shrink-0">Class/Sec:</span>
                    <span>{receiptData.className} - {receiptData.section}</span>
                </div>

                {receiptData.rollNumber && (
                    <div className="flex">
                        <span className="font-semibold w-20 shrink-0">Roll No:</span>
                        <span>{receiptData.rollNumber}</span>
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-black my-2"></div>

            {/* Fee Items Header */}
            <div className="flex justify-between text-[11px] font-bold border-b border-black pb-1 mb-1">
                <span>Description</span>
                <span>Amount</span>
            </div>

            {/* Fee Items */}
            <div className="space-y-1 text-[11px] min-h-[40px]">
                {receiptData.items.map((item, index) => (
                    <div key={index} className="flex flex-col">
                        <div className="flex justify-between items-start">
                            <span className="pr-2 font-medium">{getFeeDescription(item)}</span>
                            <span className="whitespace-nowrap">₹{formatNumber(item.amount)}</span>
                        </div>
                        {item.remarks && (
                            <span className="text-[10px] text-gray-700 italic border-l block pl-1 ml-1 mt-0.5 border-gray-400">&quot;{item.remarks}&quot;</span>
                        )}
                    </div>
                ))}
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-black my-2"></div>

            {/* Total */}
            <div className="flex justify-between items-center text-sm font-bold">
                <span>GRAND TOTAL:</span>
                <span>₹{formatNumber(receiptData.totalAmount)}</span>
            </div>

            <div className="border-t border-dashed border-black my-4"></div>
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
