import { task } from "@trigger.dev/sdk/v3";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { whatsappConfig } from "@/lib/whatsapp-config";

export interface ReminderStudent {
    id: string;
    name: string;
    contactNumber: string;
    className: string;
    details: string[];
    amount: number;
}

export interface BulkReminderPayload {
    students: ReminderStudent[];
    language: 'hindi' | 'english' | 'urdu';
}

export const sendBulkWhatsAppReminders = task({
  id: "send-bulk-whatsapp-reminders",
  run: async (payload: BulkReminderPayload) => {
    const { students, language } = payload;
    
    if (!whatsappConfig.enabled) {
        // We log it but maybe don't throw if we want to return a failed status structure
        // But throwing is better for retries if it's a temporary config issue.
        // If it's permanently disabled, we should probably check before triggering.
        // Here we just return a failure result.
        return {
            success: false,
            summary: { total: students.length, sent: 0, failed: students.length },
            details: [],
            error: "WhatsApp integration is disabled"
        };
    }

    const results = [];
    
    for (const student of students) {
        if (!student.contactNumber || student.contactNumber === 'N/A') {
            results.push({ id: student.id, name: student.name, status: 'failed', error: 'No contact number' });
            continue;
        }

        const duesList = student.details.join(', ');
        const totalAmount = `₹${student.amount.toLocaleString()}`;
        const template = whatsappConfig.templates.reminders[language];

        try {
            const res = await sendWhatsAppMessage({
                to: student.contactNumber,
                userName: student.name,
                campaignName: template.campaignName,
                params: [
                    student.name,
                    student.className,
                    duesList,
                    totalAmount
                ]
            });

            results.push({ 
                id: student.id, 
                name: student.name, 
                status: res.success ? 'success' : 'failed', 
                error: res.error 
            });
            
            // Add a small delay to avoid rate limiting if necessary
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            results.push({ 
                id: student.id, 
                name: student.name, 
                status: 'failed', 
                error: errorMessage
            });
        }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.filter(r => r.status === 'failed').length;

    return {
        success: true,
        summary: {
            total: students.length,
            sent: successCount,
            failed: failureCount
        },
        details: results
    };
  },
});
