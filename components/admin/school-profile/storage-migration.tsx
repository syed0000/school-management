"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { migrateCloudinaryFilesToContaboBatch } from "@/actions/storage-migration"
import { useRouter } from "next/navigation"

type Props = {
  contaboConfigured: boolean
  hasCloudinaryFiles: boolean
  status: {
    status: "idle" | "running" | "done" | "error"
    processed: number
    migrated: number
    failed: number
    lastError?: string
    startedAt?: string
    updatedAt?: string
  }
}

export function StorageMigration({ contaboConfigured, hasCloudinaryFiles, status }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [lastRun, setLastRun] = useState<{ migrated: number; failed: number; batches: number } | null>(null)

  const disabledReason = useMemo(() => {
    if (!contaboConfigured) return "Contabo Object Storage is not configured."
    if (!hasCloudinaryFiles) return "No Cloudinary files found to migrate."
    return null
  }, [contaboConfigured, hasCloudinaryFiles])

  const runMigration = async () => {
    setLoading(true)
    setLastRun(null)

    let migrated = 0
    let failed = 0
    let batches = 0

    try {
      for (let i = 0; i < 200; i++) {
        const result = await migrateCloudinaryFilesToContaboBatch(25)
        if (!result.success) {
          toast.error(result.error || "Migration failed")
          return
        }
        batches += 1
        migrated += result.migrated || 0
        failed += result.failed || 0

        if (result.done) {
          break
        }
      }

      setLastRun({ migrated, failed, batches })

      if (failed > 0) {
        toast.error(`Migration finished with ${failed} failures`)
      } else {
        toast.success("Migration completed")
      }
    } catch (err) {
      console.error(err)
      toast.error("Migration failed")
    } finally {
      setLoading(false)
      router.refresh()
    }
  }

  return (
    <div className="space-y-3">
      {!contaboConfigured && (
        <Alert variant="destructive">
          <AlertTitle>Contabo Not Configured</AlertTitle>
          <AlertDescription>
            Set CONTABO_ACCESS_KEY, CONTABO_SECRET_KEY, and CONTABO_PUBLIC_URL (or CONTABO_ENDPOINT + CONTABO_BUCKET).
          </AlertDescription>
        </Alert>
      )}

      {status.lastError && (
        <Alert variant="destructive">
          <AlertTitle>Last Migration Error</AlertTitle>
          <AlertDescription>{status.lastError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <div>Status: {status.status}</div>
        <div>Processed: {status.processed} · Migrated: {status.migrated} · Failed: {status.failed}</div>
        {lastRun && <div>Last run: {lastRun.migrated} migrated · {lastRun.failed} failed · {lastRun.batches} batches</div>}
      </div>

      <Button
        onClick={runMigration}
        disabled={loading || Boolean(disabledReason)}
        variant="outline"
        className="w-full"
      >
        {loading ? "Migrating..." : "Migrate Cloudinary Files to Contabo"}
      </Button>

      {disabledReason && <p className="text-xs text-muted-foreground">{disabledReason}</p>}
    </div>
  )
}

