import { whatsappConfig } from "./whatsapp-config"
import WhatsAppStat from "@/models/WhatsAppStat"
import WhatsAppPricing from "@/models/WhatsAppPricing"
import License from "@/models/License"
import Setting from "@/models/Setting"
import dbConnect from "./db"

type ReceiptStudent = {
    name?: string;
    registrationNumber?: string;
    rollNumber?: string;
    classId?: { name?: string };
    className?: string;
    section?: string;
    contacts?: { mobile?: string[] };
    parents?: { father?: { name?: string }; mother?: { name?: string } };
}

interface SendReceiptParams {
    student: ReceiptStudent | null | undefined;
    totalAmount: number;
    receiptNumber: string;
    monthsStr: string;
    transactionDate?: Date;
    remarks?: string;
}

export async function sendWhatsAppReceipt({ student, totalAmount, receiptNumber, monthsStr, transactionDate, remarks }: SendReceiptParams) {
    try {
        await dbConnect();
        // 1. Check if alerts are enabled globally in Settings
        const whatsappReceiptEnabled = await Setting.findOne({ key: "whatsapp_receipt_alert" }).lean();
        const isAlertEnabled = whatsappReceiptEnabled ? (whatsappReceiptEnabled as { value?: boolean }).value === true : false;

        if (!student) {
            return { success: false, reason: "Missing student" };
        }

        const studentContacts = student.contacts?.mobile;
        if (!isAlertEnabled || !whatsappConfig.enabled || !studentContacts?.[0]) {
            return { success: false, reason: "Alerts disabled or no mobile number" };
        }

        const mobile = studentContacts[0];

        // 2. Format Receipt URL via query parameters
        const classIdObj = student.classId;
        const searchParams = new URLSearchParams({
            receiptNumber,
            studentName: student.name || 'Student',
            studentRegNo: student.registrationNumber || 'N/A',
            rollNumber: student.rollNumber || 'N/A',
            className: classIdObj?.name || student.className || 'N/A',
            section: student.section || 'A',
            amount: totalAmount.toString(),
            date: (transactionDate || new Date()).toISOString(),
            feeType: 'Multiple Fees',
            months: monthsStr,
            year: (transactionDate || new Date()).getFullYear().toString()
        });

        if (remarks) {
            searchParams.set('remarks', remarks);
        }

        const receiptUrl = `${whatsappConfig.appUrl}/api/public-receipt?${searchParams.toString()}`;

        // 3. Track statistics
        const cost = await WhatsAppPricing.getCurrentPrice();

        const { getWhatsAppSummary } = await import("@/actions/whatsapp-stats");
        const { balance } = await getWhatsAppSummary();

        if (balance < cost) {
            return { success: false, reason: "Insufficient WhatsApp balance." };
        }
        const stat = new WhatsAppStat({
            type: 'receipt',
            description: `Fee receipt for ${student.name} (₹${totalAmount})`,
            recipientCount: 1,
            cost,
            status: 'failed',
            mediaUrl: receiptUrl,
        });
        await stat.save();

        // 4. Verify License
        const license = await License.findOne().sort({ createdAt: -1 }).lean();
        if (!license || !license.schoolId || !license.key) {
           console.error("Worker configuration missing for WhatsApp integration.")
           return { success: false, reason: "Missing license" };
        }

        // 5. Send to Worker
        const payload = {
            schoolId: license.schoolId,
            licenseKey: license.key,
            mode: 'single',
            phone: mobile,
            parentName: student.parents?.father?.name || student.parents?.mother?.name || 'Parent/Guardian',
            studentName: student.name,
            amount: totalAmount.toString(),
            receiptNumber: receiptNumber,
            month: monthsStr,
            media: { url: receiptUrl, filename: `Receipt-${receiptNumber}.png` }
        };

        const workerRes = await fetch(`${whatsappConfig.worker.url}/api/v1/whatsapp/receipt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (workerRes.ok) {
            await WhatsAppStat.findByIdAndUpdate(stat._id, { status: 'success' });
            return { success: true };
        } else {
            console.error("Failed to send WhatsApp receipt via Worker:", await workerRes.text());
            return { success: false, reason: "Worker failure" };
        }
    } catch (error) {
        console.error("Failed to send WhatsApp receipt helper:", error);
        return { success: false, error };
    }
}
