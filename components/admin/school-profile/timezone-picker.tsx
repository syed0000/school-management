"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateTimezoneSetting } from "@/actions/school-settings"
import { useRouter } from "next/navigation"

const COMMON_TIMEZONES = [
  "Asia/Kolkata",       // IST
  "Asia/Dubai",         // GST
  "Asia/Riyadh",        // AST
  "Asia/Qatar",         // AST
  "Europe/London",      // GMT/BST
  "America/New_York",   // EST/EDT
  "America/Los_Angeles",// PST/PDT
  "Australia/Sydney",   // AEST/AEDT
  "UTC"
]

export function TimezoneEditor({ initialTimezone }: { initialTimezone: string }) {
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  const handleTimezoneChange = async (value: string) => {
    setIsPending(true)
    try {
      const result = await updateTimezoneSetting(value)
      if (result.success) {
        toast.success("Timezone updated successfully")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to update timezone")
      }
    } catch (e) {
      toast.error("An error occurred")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="timezone-select">Institute Timezone</Label>
        <Select 
          value={initialTimezone} 
          onValueChange={handleTimezoneChange} 
          disabled={isPending}
        >
          <SelectTrigger id="timezone-select" className="w-full">
            <SelectValue placeholder="Select a timezone" />
          </SelectTrigger>
          <SelectContent>
            {COMMON_TIMEZONES.map(tz => (
              <SelectItem key={tz} value={tz}>
                {tz} {tz === 'Asia/Kolkata' ? '(IST - Default)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Dates and financial reporting will be anchored to this timezone. Avoid changing this frequently.
        </p>
      </div>
    </div>
  )
}
