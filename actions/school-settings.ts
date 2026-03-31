"use server"

import dbConnect from "@/lib/db"
import Setting from "@/models/Setting"
import { revalidatePath } from "next/cache"
import { whatsappConfig } from "@/lib/whatsapp-config"

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
