import { whatsappConfig } from "./whatsapp-config"
import WhatsAppStat from "@/models/WhatsAppStat"
import WhatsAppPricing from "@/models/WhatsAppPricing"
import License from "@/models/License"
import Setting from "@/models/Setting"
import WhatsAppReceipt from "@/models/WhatsAppReceipt"
import dbConnect from "./db"

interface SendReceiptParams {
    student: any;
    totalAmount: number;
    receiptNumber: string;
    monthsStr: string;
    transactionDate?: Date;
}

export async function sendWhatsAppReceipt({ student, totalAmount, receiptNumber, monthsStr, transactionDate }: SendReceiptParams) {
    try {
        await dbConnect();
        // 1. Check if alerts are enabled globally in Settings
        const whatsappReceiptEnabled = await Setting.findOne({ key: "whatsapp_receipt_alert" }).lean();
        const isAlertEnabled = whatsappReceiptEnabled ? (whatsappReceiptEnabled as any).value === true : false;

        if (!isAlertEnabled || !whatsappConfig.enabled || !student?.contacts?.mobile?.[0]) {
            return { success: false, reason: "Alerts disabled or no mobile number" };
        }

        const mobile = student.contacts.mobile[0];

        // 2. Create Receipt Snapshot for clean URL
        const receiptSnapshot = new WhatsAppReceipt({
            receiptNumber,
            studentName: student.name,
            studentRegNo: student.registrationNumber || 'N/A',
            rollNumber: student.rollNumber || 'N/A',
            className: student.classId?.name || student.className || 'N/A',
            section: student.section || 'A',
            amount: totalAmount,
            date: transactionDate || new Date(),
            feeType: 'Multiple Fees',
            months: monthsStr,
            year: (transactionDate || new Date()).getFullYear().toString(),
        });
        await receiptSnapshot.save();

        const receiptUrl = `${whatsappConfig.appUrl}/api/receipt/${receiptSnapshot._id}/image`;

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
            parentName: student.name,
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
