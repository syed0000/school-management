"use server"

import dbConnect from "@/lib/db"
import Setting from "@/models/Setting"
import Counter from "@/models/Counter"
import { revalidatePath } from "next/cache"
import { whatsappConfig } from "@/lib/whatsapp-config"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function getWhatsAppReceiptSetting() {
    await dbConnect()
    const setting = await Setting.findOne({ key: "whatsapp_receipt_alert" }).lean()
    // Default to false if not set
    return setting ? setting.value === true : false
}

export async function updateWhatsAppReceiptSetting(enabled: boolean) {
    if (enabled && !whatsappConfig.enabled) {
        return {
            success: false,
            error: "WhatsApp integration is not enabled in this project. Please contact FeeEase support get this enabled."
        }
    }

    await dbConnect()
    await Setting.findOneAndUpdate(
        { key: "whatsapp_receipt_alert" },
        { value: enabled },
        { upsert: true, new: true }
    )
    revalidatePath("/admin/school-profile")
    return { success: true }
}

// ── Counter Management ────────────────────────────────────────────────────────

export interface CounterInfo {
    id: string
    label: string
    seq: number
    nextFormatted: string
    description: string
}

export async function getCounters(): Promise<CounterInfo[]> {
    await dbConnect()

    const [regCounter, receiptCounter] = await Promise.all([
        Counter.findById("registrationNumber").lean(),
        Counter.findById("receiptNumber").lean(),
    ])

    return [
        {
            id: "registrationNumber",
            label: "Student Registration Number",
            seq: (regCounter as { seq?: number } | null)?.seq ?? 214,
            nextFormatted: String(((regCounter as { seq?: number } | null)?.seq ?? 214) + 1).padStart(4, "0"),
            description: "Controls the next auto-generated student registration number.",
        },
        {
            id: "receiptNumber",
            label: "Fee Receipt Number",
            seq: (receiptCounter as { seq?: number } | null)?.seq ?? 1200,
            nextFormatted: String(((receiptCounter as { seq?: number } | null)?.seq ?? 1200) + 1),
            description: "Controls the next auto-generated fee receipt number.",
        },
    ]
}

export async function updateCounter(id: string, seq: number) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "admin") {
        return { success: false, error: "Unauthorized" }
    }

    if (!["registrationNumber", "receiptNumber"].includes(id)) {
        return { success: false, error: "Unknown counter" }
    }

    if (!Number.isInteger(seq) || seq < 0) {
        return { success: false, error: "Sequence must be a non-negative integer" }
    }

    await dbConnect()
    await Counter.findByIdAndUpdate(id, { seq }, { upsert: true, new: true })

    revalidatePath("/admin/school-profile")
    return { success: true }
}
