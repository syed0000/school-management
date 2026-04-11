"use server"

import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import Teacher from "@/models/Teacher"
import Expense from "@/models/Expense"
import Setting from "@/models/Setting"
import logger from "@/lib/logger"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { demoWriteSuccess, isDemoSession } from "@/lib/demo-guard"
import { revalidatePath } from "next/cache"
import { getContaboStorageConfig, putToContabo } from "@/lib/contabo-storage"
import crypto from "crypto"
import { getStorageRootFolder } from "@/lib/storage-root"

type MigrationStatus = {
  status: "idle" | "running" | "done" | "error"
  processed: number
  migrated: number
  failed: number
  lastError?: string
  startedAt?: string
  updatedAt?: string
}

const STATUS_KEY = "storage_migration_contabo"
const cloudinaryRegex = /cloudinary\.com/i
const LEGACY_ROOT = "modern-nursery"

function nowIso() {
  return new Date().toISOString()
}

export async function getStorageMigrationStatus(): Promise<{
  done: boolean
  hasCloudinaryFiles: boolean
  contaboConfigured: boolean
  status: MigrationStatus
}> {
  await dbConnect()

  const contaboConfigured = Boolean(getContaboStorageConfig())
  const hasCloudinaryFiles = await hasAnyCloudinaryRefs()

  const setting = await Setting.findOne({ key: STATUS_KEY }).lean() as { value?: unknown } | null
  const raw = (setting?.value ?? null) as MigrationStatus | null

  const base: MigrationStatus = raw && typeof raw === "object"
    ? {
      status: (raw.status ?? "idle") as MigrationStatus["status"],
      processed: Number.isFinite(raw.processed) ? raw.processed : 0,
      migrated: Number.isFinite(raw.migrated) ? raw.migrated : 0,
      failed: Number.isFinite(raw.failed) ? raw.failed : 0,
      lastError: typeof raw.lastError === "string" ? raw.lastError : undefined,
      startedAt: typeof raw.startedAt === "string" ? raw.startedAt : undefined,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    }
    : { status: "idle", processed: 0, migrated: 0, failed: 0 }

  const done = !hasCloudinaryFiles
  return {
    done,
    hasCloudinaryFiles,
    contaboConfigured,
    status: done ? { ...base, status: "done", updatedAt: nowIso() } : base,
  }
}

export async function migrateCloudinaryFilesToContaboBatch(limit = 25): Promise<{
  success: boolean
  done?: boolean
  migrated?: number
  failed?: number
  processed?: number
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" }
  }
  if (isDemoSession(session)) return demoWriteSuccess()

  const cfg = getContaboStorageConfig()
  if (!cfg) return { success: false, error: "Contabo Object Storage is not configured" }

  await dbConnect()

  const status: MigrationStatus = await readStatus()
  const startedAt = status.startedAt || nowIso()
  const running: MigrationStatus = { ...status, status: "running", startedAt, updatedAt: nowIso() }
  await writeStatus(running)

  const refs = await collectCloudinaryRefs(limit)
  if (refs.length === 0) {
    const final: MigrationStatus = { ...status, status: "done", updatedAt: nowIso(), startedAt }
    await writeStatus(final)
    revalidatePath("/admin/school-profile")
    return { success: true, done: true, processed: final.processed, migrated: final.migrated, failed: final.failed }
  }

  const urlToNewUrl = new Map<string, string>()
  let migrated = 0
  let failed = 0
  let lastError: string | undefined

  for (const ref of refs) {
    try {
      const oldUrl = ref.url
      let newUrl = urlToNewUrl.get(oldUrl)
      if (!newUrl) {
        newUrl = await migrateSingleUrl({ cfg, oldUrl })
        urlToNewUrl.set(oldUrl, newUrl)
      }
      await applyRefUpdate(ref, newUrl)
      migrated += 1
    } catch (err) {
      failed += 1
      logger.error({ err }, "Storage migration failed for one file")
      if (!lastError) lastError = err instanceof Error ? err.message : "Unknown error"
    }
  }

  const hasRemaining = await hasAnyCloudinaryRefs()
  const nextStatus: MigrationStatus = {
    ...status,
    status: hasRemaining ? "running" : "done",
    processed: status.processed + refs.length,
    migrated: status.migrated + migrated,
    failed: status.failed + failed,
    lastError: lastError || status.lastError,
    updatedAt: nowIso(),
    startedAt,
  }
  await writeStatus(nextStatus)
  revalidatePath("/admin/school-profile")
  return {
    success: true,
    done: !hasRemaining,
    processed: refs.length,
    migrated,
    failed,
  }
}

type CloudinaryRef =
  | { model: "Student"; id: string; path: string; url: string }
  | { model: "Teacher"; id: string; path: string; url: string }
  | { model: "Expense"; id: string; path: string; url: string }
  | { model: "Setting"; id: string; path: string; url: string }

async function hasAnyCloudinaryRefs(): Promise<boolean> {
  const checks = await Promise.all([
    Student.exists({ $or: [{ photo: cloudinaryRegex }, { "documents.image": cloudinaryRegex }] }),
    Teacher.exists({
      $or: [
        { photo: cloudinaryRegex },
        { "documents.image": cloudinaryRegex },
        { "pastExperience.experienceLetter": cloudinaryRegex },
      ],
    }),
    Expense.exists({ receipt: cloudinaryRegex }),
    Setting.exists({ key: "id_card_signature", "value.url": cloudinaryRegex }),
  ])
  return checks.some(Boolean)
}

async function collectCloudinaryRefs(limit: number): Promise<CloudinaryRef[]> {
  const refs: CloudinaryRef[] = []

  const push = (r: CloudinaryRef) => {
    if (refs.length < limit) refs.push(r)
  }

  const students = await Student.find({ $or: [{ photo: cloudinaryRegex }, { "documents.image": cloudinaryRegex }] })
    .select("_id photo documents")
    .lean()
    .limit(Math.max(50, limit))

  for (const s of students as Array<{ _id: { toString: () => string }; photo?: string; documents?: Array<{ image?: string }> }>) {
    if (refs.length >= limit) break
    const id = s._id.toString()
    if (typeof s.photo === "string" && cloudinaryRegex.test(s.photo)) push({ model: "Student", id, path: "photo", url: s.photo })
    const docs = Array.isArray(s.documents) ? s.documents : []
    for (let i = 0; i < docs.length; i++) {
      if (refs.length >= limit) break
      const img = docs[i]?.image
      if (typeof img === "string" && cloudinaryRegex.test(img)) {
        push({ model: "Student", id, path: `documents.${i}.image`, url: img })
      }
    }
  }

  if (refs.length >= limit) return refs

  const teachers = await Teacher.find({
    $or: [
      { photo: cloudinaryRegex },
      { "documents.image": cloudinaryRegex },
      { "pastExperience.experienceLetter": cloudinaryRegex },
    ],
  })
    .select("_id photo documents pastExperience")
    .lean()
    .limit(Math.max(50, limit))

  for (const t of teachers as Array<{
    _id: { toString: () => string }
    photo?: string
    documents?: Array<{ image?: string }>
    pastExperience?: { experienceLetter?: string }
  }>) {
    if (refs.length >= limit) break
    const id = t._id.toString()
    if (typeof t.photo === "string" && cloudinaryRegex.test(t.photo)) push({ model: "Teacher", id, path: "photo", url: t.photo })
    const docs = Array.isArray(t.documents) ? t.documents : []
    for (let i = 0; i < docs.length; i++) {
      if (refs.length >= limit) break
      const img = docs[i]?.image
      if (typeof img === "string" && cloudinaryRegex.test(img)) {
        push({ model: "Teacher", id, path: `documents.${i}.image`, url: img })
      }
    }
    const exp = t.pastExperience?.experienceLetter
    if (refs.length < limit && typeof exp === "string" && cloudinaryRegex.test(exp)) {
      push({ model: "Teacher", id, path: "pastExperience.experienceLetter", url: exp })
    }
  }

  if (refs.length >= limit) return refs

  const expenses = await Expense.find({ receipt: cloudinaryRegex }).select("_id receipt").lean().limit(Math.max(50, limit))
  for (const e of expenses as Array<{ _id: { toString: () => string }; receipt?: string }>) {
    if (refs.length >= limit) break
    const url = e.receipt
    if (typeof url === "string" && cloudinaryRegex.test(url)) {
      push({ model: "Expense", id: e._id.toString(), path: "receipt", url })
    }
  }

  if (refs.length >= limit) return refs

  const sig = await Setting.findOne({ key: "id_card_signature", "value.url": cloudinaryRegex }).select("_id value").lean()
  if (sig) {
    const v = (sig as { value?: unknown }).value as { url?: unknown } | undefined
    const url = typeof v?.url === "string" ? v.url : ""
    if (url && cloudinaryRegex.test(url)) {
      push({ model: "Setting", id: (sig as { _id: { toString: () => string } })._id.toString(), path: "value.url", url })
    }
  }

  return refs
}

async function migrateSingleUrl(params: { cfg: NonNullable<ReturnType<typeof getContaboStorageConfig>>; oldUrl: string }): Promise<string> {
  const { cfg, oldUrl } = params

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)
  const res = await fetch(oldUrl, { signal: controller.signal }).finally(() => clearTimeout(timeoutId))
  if (!res.ok) throw new Error(`Failed to download source file: ${res.status} ${res.statusText}`)
  const contentType = res.headers.get("content-type") || "application/octet-stream"
  const buf = Buffer.from(await res.arrayBuffer())

  const key = deriveKeyFromCloudinaryUrl(oldUrl, contentType)
  return await putToContabo({ cfg, key, body: buf, contentType })
}

function deriveKeyFromCloudinaryUrl(oldUrl: string, contentType: string): string {
  const root = getStorageRootFolder()
  try {
    const u = new URL(oldUrl)
    const path = decodeURIComponent(u.pathname || "")
    const marker = `/${LEGACY_ROOT}/`
    const idx = path.indexOf(marker)
    if (idx !== -1) {
      const legacyKey = path.slice(idx + 1)
      if (legacyKey.startsWith(`${LEGACY_ROOT}/`)) {
        return legacyKey.replace(new RegExp(`^${LEGACY_ROOT}/`), `${root}/`)
      }
    }

    const basename = path.split("/").filter(Boolean).pop() || ""
    const safeBase = basename.replace(/[^a-z0-9.]/gi, "_").toLowerCase() || crypto.randomUUID()
    const ext = safeBase.includes(".") ? "" : `.${extensionFromContentType(contentType)}`
    return `${root}/migrated/${Date.now()}-${safeBase}${ext}`
  } catch {
    return `${root}/migrated/${Date.now()}-${crypto.randomUUID()}.${extensionFromContentType(contentType)}`
  }
}

function extensionFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase()
  if (ct.includes("image/webp")) return "webp"
  if (ct.includes("image/png")) return "png"
  if (ct.includes("image/jpeg")) return "jpg"
  if (ct.includes("application/pdf")) return "pdf"
  if (ct.includes("text/plain")) return "txt"
  return "bin"
}

async function applyRefUpdate(ref: CloudinaryRef, newUrl: string): Promise<void> {
  if (ref.model === "Student") {
    await Student.updateOne({ _id: ref.id }, { $set: { [ref.path]: newUrl } })
    return
  }
  if (ref.model === "Teacher") {
    await Teacher.updateOne({ _id: ref.id }, { $set: { [ref.path]: newUrl } })
    return
  }
  if (ref.model === "Expense") {
    await Expense.updateOne({ _id: ref.id }, { $set: { [ref.path]: newUrl } })
    return
  }
  if (ref.model === "Setting") {
    await Setting.updateOne({ _id: ref.id }, { $set: { [ref.path]: newUrl } })
    return
  }
}

async function readStatus(): Promise<MigrationStatus> {
  const setting = await Setting.findOne({ key: STATUS_KEY }).lean() as { value?: unknown } | null
  const raw = (setting?.value ?? null) as MigrationStatus | null
  if (!raw || typeof raw !== "object") return { status: "idle", processed: 0, migrated: 0, failed: 0 }
  return {
    status: (raw.status ?? "idle") as MigrationStatus["status"],
    processed: Number.isFinite(raw.processed) ? raw.processed : 0,
    migrated: Number.isFinite(raw.migrated) ? raw.migrated : 0,
    failed: Number.isFinite(raw.failed) ? raw.failed : 0,
    lastError: typeof raw.lastError === "string" ? raw.lastError : undefined,
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  }
}

async function writeStatus(value: MigrationStatus): Promise<void> {
  await Setting.findOneAndUpdate({ key: STATUS_KEY }, { value }, { upsert: true, returnDocument: "after" })
}
