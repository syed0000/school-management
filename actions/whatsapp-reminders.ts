"use server"

import { tasks } from "@trigger.dev/sdk/v3";
import { whatsappConfig } from "@/lib/whatsapp-config";

export interface ReminderStudent {
    id: string;
    name: string;
    contactNumber: string;
    className: string;
    details: string[];
    amount: number;
}

export async function sendBulkReminders(students: ReminderStudent[], language: 'hindi' | 'english' | 'urdu') {
    if (!whatsappConfig.enabled) {
        return { success: false, error: "WhatsApp integration is disabled" }
    }

    try {
        if (students.length === 0) {
             return { success: false, error: "No students provided" }
        }

        // Batching strategy: Split students into chunks to avoid timeouts and improve reliability
        // Chunk size of 50 means 1000 students = 20 runs.
        // This is safe for the free plan (5000 runs/month) and runs faster in parallel.
        const BATCH_SIZE = 50;
        const chunks = [];
        for (let i = 0; i < students.length; i += BATCH_SIZE) {
            chunks.push(students.slice(i, i + BATCH_SIZE));
        }

        // Use Promise.all to trigger jobs in parallel. 
        // This is equivalent to batching but uses the standard trigger method we know works.
        const handles = await Promise.all(chunks.map(chunk => 
            tasks.trigger("send-bulk-whatsapp-reminders", {
                students: chunk,
                language
            })
        ));

        return {
            success: true,
            jobId: handles.map(h => h.id).join(', '),
            message: `Started ${handles.length} background jobs for ${students.length} students`
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error("Bulk reminder trigger error:", error)
        return { success: false, error: errorMessage }
    }
}
