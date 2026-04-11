import { schoolConfig } from "@/lib/config"

export function getStorageRootFolder(): string {
  const raw = (schoolConfig.name || "").trim()
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")

  return normalized || "institute"
}

