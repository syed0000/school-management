"use server"

import dbConnect from "@/lib/db"
import Setting from "@/models/Setting"
import Counter from "@/models/Counter"
import ClassGroup from "@/models/ClassGroup"
import { revalidatePath } from "next/cache"
import { whatsappConfig } from "@/lib/whatsapp-config"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { demoWriteSuccess, isDemoSession } from "@/lib/demo-guard"
import { coerceBoolean } from "@/lib/setting-coerce"

export async function getWhatsAppReceiptSetting() {
    await dbConnect()
    const setting = await Setting.findOne({ key: "whatsapp_receipt_alert" }).lean()
    // Default to false if not set
    return coerceBoolean((setting as { value?: unknown } | null)?.value, false)
}

export async function updateWhatsAppReceiptSetting(enabled: boolean) {
    const session = await getServerSession(authOptions)
    if (isDemoSession(session)) return demoWriteSuccess()
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

// ── Timezone Setting ────────────────────────────────────────────────────────

export async function getTimezoneSetting() {
    await dbConnect()
    const setting = await Setting.findOne({ key: "school_timezone" }).lean()
    const raw = (setting as { value?: unknown } | null)?.value
    const tz = typeof raw === "string" ? raw.trim() : ""
    if (!tz) return "Asia/Kolkata"
    try {
        Intl.DateTimeFormat("en-US", { timeZone: tz })
        return tz
    } catch {
        return "Asia/Kolkata"
    }
}

export async function updateTimezoneSetting(timezone: string) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "admin") {
        return { success: false, error: "Unauthorized" }
    }
    if (isDemoSession(session)) return demoWriteSuccess()

    if (!timezone) return { success: false, error: "Timezone required" }

    await dbConnect()
    await Setting.findOneAndUpdate(
        { key: "school_timezone" },
        { value: timezone },
        { upsert: true, new: true }
    )
    revalidatePath("/", "layout")
    return { success: true }
}

// ── Fee Policy Settings ────────────────────────────────────────────────────────

export async function getFeePolicySettings() {
    await dbConnect()
    const [admSetting, regSetting] = await Promise.all([
        Setting.findOne({ key: "admission_fee_includes_april" }).lean(),
        Setting.findOne({ key: "registration_fee_includes_april" }).lean()
    ])
    
    // Default to true as requested
    return {
        admissionFeeIncludesApril: coerceBoolean((admSetting as { value?: unknown } | null)?.value, true),
        registrationFeeIncludesApril: coerceBoolean((regSetting as { value?: unknown } | null)?.value, true),
    }
}

export async function updateFeePolicySettings(admission: boolean, registration: boolean) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "admin") {
        return { success: false, error: "Unauthorized" }
    }
    if (isDemoSession(session)) return demoWriteSuccess()

    await dbConnect()
    await Promise.all([
        Setting.findOneAndUpdate(
            { key: "admission_fee_includes_april" },
            { value: admission },
            { upsert: true, new: true }
        ),
        Setting.findOneAndUpdate(
            { key: "registration_fee_includes_april" },
            { value: registration },
            { upsert: true, new: true }
        )
    ])

    revalidatePath("/admin/school-profile")
    revalidatePath("/admin/dashboard")
    revalidatePath("/admin/reports/fees")
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
    if (isDemoSession(session)) return demoWriteSuccess()

    // Allow main counters and class-group-specific counters (prefixed with 'classGroup_')
    const isGroupCounter = id.startsWith("classGroup_")
    if (!["registrationNumber", "receiptNumber"].includes(id) && !isGroupCounter) {
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

// ── Class Group Management ────────────────────────────────────────────────────────

export interface ClassGroupInfo {
    id: string
    name: string
    classIds: string[]
    startFrom: number
    currentSeq: number // live counter seq value
    nextFormatted: string
}

export async function getClassGroups(): Promise<ClassGroupInfo[]> {
    await dbConnect()
    const groups = await ClassGroup.find({ isActive: true }).lean() as Array<{
        _id: { toString: () => string }
        name: string
        classIds: Array<{ toString: () => string }>
        startFrom: number
    }>

    const counterIds = groups.map((g) => `classGroup_${g._id.toString()}`)
    const counters = await Counter.find({ _id: { $in: counterIds } }).lean() as Array<{ _id: string; seq?: number }>
    const counterById = new Map(counters.map((c) => [c._id, c]))

    const result: ClassGroupInfo[] = []
    for (const g of groups) {
        const counterId = `classGroup_${g._id.toString()}`
        const counter = counterById.get(counterId) as { seq?: number } | undefined
        const currentSeq = counter?.seq ?? (g.startFrom - 1)
        result.push({
            id: g._id.toString(),
            name: g.name,
            classIds: g.classIds.map((c) => c.toString()),
            startFrom: g.startFrom,
            currentSeq,
            nextFormatted: String(currentSeq + 1).padStart(4, "0"),
        })
    }
    return result
}

export async function createClassGroup(name: string, classIds: string[], startFrom: number) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "admin") {
        return { success: false, error: "Unauthorized" }
    }
    if (isDemoSession(session)) return demoWriteSuccess()
    if (!name.trim()) return { success: false, error: "Group name is required" }
    if (!classIds.length) return { success: false, error: "Select at least one class" }
    if (!Number.isInteger(startFrom) || startFrom < 0) {
        return { success: false, error: "Start from must be a non-negative integer" }
    }

    await dbConnect()

    // Verify no class is already in another active group
    const existing = await ClassGroup.findOne({
        classIds: { $in: classIds },
        isActive: true,
    }).lean()
    if (existing) {
        return { success: false, error: "One or more selected classes already belong to another group" }
    }

    const group = await ClassGroup.create({ name: name.trim(), classIds, startFrom })

    // Initialise the counter so seq = startFrom - 1 (next issued number = startFrom)
    const counterId = `classGroup_${group._id.toString()}`
    await Counter.findByIdAndUpdate(
        counterId,
        { seq: startFrom - 1 },
        { upsert: true, new: true }
    )

    revalidatePath("/admin/school-profile")
    return { success: true }
}

export async function updateClassGroup(
    groupId: string,
    name: string,
    classIds: string[],
    startFrom: number,
    resetCounter?: boolean
) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "admin") {
        return { success: false, error: "Unauthorized" }
    }
    if (isDemoSession(session)) return demoWriteSuccess()
    if (!name.trim()) return { success: false, error: "Group name is required" }
    if (!classIds.length) return { success: false, error: "Select at least one class" }

    await dbConnect()

    // Verify no class is already in another active group (exclude self)
    const conflict = await ClassGroup.findOne({
        classIds: { $in: classIds },
        isActive: true,
        _id: { $ne: groupId },
    }).lean()
    if (conflict) {
        return { success: false, error: "One or more selected classes already belong to another group" }
    }

    await ClassGroup.findByIdAndUpdate(groupId, { name: name.trim(), classIds, startFrom })

    if (resetCounter) {
        const counterId = `classGroup_${groupId}`
        await Counter.findByIdAndUpdate(
            counterId,
            { seq: startFrom - 1 },
            { upsert: true, new: true }
        )
    }

    revalidatePath("/admin/school-profile")
    return { success: true }
}

export async function deleteClassGroup(groupId: string) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "admin") {
        return { success: false, error: "Unauthorized" }
    }
    if (isDemoSession(session)) return demoWriteSuccess()

    await dbConnect()
    await ClassGroup.findByIdAndUpdate(groupId, { isActive: false })

    revalidatePath("/admin/school-profile")
    return { success: true }
}

/**
 * Given a classId, finds the active group it belongs to and returns its counter key.
 * Returns null if no group is found (fall back to global counter).
 */
export async function findGroupForClass(classId: string): Promise<{ groupId: string; counterId: string } | null> {
    await dbConnect()
    const group = await ClassGroup.findOne({
        classIds: classId,
        isActive: true,
    }).lean() as { _id: { toString: () => string } } | null

    if (!group) return null
    return {
        groupId: group._id.toString(),
        counterId: `classGroup_${group._id.toString()}`,
    }
}
