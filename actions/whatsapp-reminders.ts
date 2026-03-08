"use server"

import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { whatsappConfig } from "@/lib/whatsapp-config"

export interface ReminderStudent {
    id: string;
    name: string;
    contactNumber: string;
    className: string;
    details: string[];
}

interface ReminderResult {
    id: string;
    name: string;
    status: 'success' | 'failed';
    error?: string;
}

export async function sendBulkReminders(students: ReminderStudent[], language: 'hindi' | 'english' | 'urdu') {
    if (!whatsappConfig.enabled) {
        return { success: false, error: "WhatsApp integration is disabled" }
    }

    try {
        if (students.length === 0) {
             return { success: false, error: "No students provided" }
        }

        const results: ReminderResult[] = await Promise.all(students.map(async (student) => {
            if (!student.contactNumber || student.contactNumber === 'N/A') {
                return { id: student.id, name: student.name, status: 'failed', error: 'No contact number' }
            }

            const duesString = student.details.join(', ')
            const template = whatsappConfig.templates.reminders[language]
            
            try {
                const res = await sendWhatsAppMessage({
                    to: student.contactNumber,
                    userName: student.name,
                    campaignName: template.campaignName,
                    params: [
                        student.name,
                        student.className,
                        duesString
                    ]
                })
                
                return { 
                    id: student.id, 
                    name: student.name,
                    status: res.success ? 'success' : 'failed', 
                    error: res.error 
                }
            } catch (err) {
                 const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                 return { 
                     id: student.id, 
                     name: student.name,
                     status: 'failed', 
                     error: errorMessage
                 }
            }
        }))

        const successCount = results.filter(r => r.status === 'success').length
        const failureCount = results.filter(r => r.status === 'failed').length

        return {
            success: true,
            summary: {
                total: students.length,
                sent: successCount,
                failed: failureCount
            },
            details: results
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error("Bulk reminder error:", error)
        return { success: false, error: errorMessage }
    }
}
