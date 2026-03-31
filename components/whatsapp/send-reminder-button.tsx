"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Send, Wallet } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { sendBulkReminders, type ReminderStudent } from "@/actions/whatsapp-reminders"
import { getWhatsAppSummary } from "@/actions/whatsapp-stats"
import WhatsAppPricing from "@/models/WhatsAppPricing"

interface CostEstimate {
  recipientCount: number
  costPerMessage: number
  totalCost: number
  balance: number
  hasSufficientBalance: boolean
}

interface SendReminderButtonProps {
  /** Students prepared and ready to dispatch */
  students: ReminderStudent[]
  language: "english" | "hindi" | "urdu"
  /** Called after a successful send so the parent can reset selection */
  onSuccess?: () => void
  /** Optional button sizing / variant overrides */
  size?: "sm" | "default" | "lg"
  className?: string
}

async function getReminderEstimate(count: number): Promise<CostEstimate> {
  // We call both in parallel — safe for server actions
  const [summary] = await Promise.all([getWhatsAppSummary()])
  // WhatsAppPricing is a Mongoose model — can't be called directly from the
  // client bundle. Instead we call the server action that already aggregates it.
  // We infer per-message cost from the summary averages approach; instead, we
  // re-use the balance already fetched and calculate cost via the reminder action
  // which does its own pricing check. Here we just need an estimate for UI display.
  // To avoid a circular dep we derive per-message cost separately via a tiny helper.
  const { balance } = summary
  // Fetch price via a public route is complex; use a lightweight inline call:
  const costPerMessage = await fetch("/api/whatsapp/pricing")
    .then((r) => r.json())
    .then((d) => Number(d.price) || 0)
    .catch(() => 0)

  const totalCost = costPerMessage * count
  return {
    recipientCount: count,
    costPerMessage,
    totalCost,
    balance,
    hasSufficientBalance: balance >= totalCost,
  }
}

export function SendReminderButton({
  students,
  language,
  onSuccess,
  size = "sm",
  className = "",
}: SendReminderButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [estimate, setEstimate] = useState<CostEstimate | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  if (students.length === 0) return null

  const handleClick = async () => {
    setLoading(true)
    try {
      const est = await getReminderEstimate(students.length)
      setEstimate(est)

      if (!est.hasSufficientBalance) {
        toast.error(
          `Insufficient WhatsApp balance. Required ₹${est.totalCost.toFixed(2)}, available ₹${est.balance.toFixed(2)}`
        )
        return
      }
      setConfirmOpen(true)
    } catch {
      toast.error("Failed to fetch cost estimate")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmedSend = async () => {
    setSending(true)
    try {
      const result = await sendBulkReminders(students, language)
      if (result.success) {
        toast.success(result.message || "Reminders scheduled successfully")
        onSuccess?.()
        setConfirmOpen(false)
      } else {
        toast.error(result.error || "Failed to send reminders")
      }
    } catch {
      toast.error("An error occurred while sending reminders")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Fee Reminders</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-1">
                <p>
                  You are about to send fee reminders via WhatsApp. Please review the cost before
                  proceeding.
                </p>
                {estimate && (
                  <div className="rounded-md border bg-muted/50 p-4 text-sm space-y-2 text-foreground">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recipients</span>
                      <span className="font-semibold">{estimate.recipientCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost per message</span>
                      <span className="font-semibold">
                        ₹{estimate.costPerMessage.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-muted-foreground font-medium">Total Credits</span>
                      <span className="font-bold text-primary">
                        ₹{estimate.totalCost.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Balance after</span>
                      <span className="font-semibold">
                        ₹{(estimate.balance - estimate.totalCost).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
                {estimate && !estimate.hasSufficientBalance && (
                  <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
                    <Wallet className="h-4 w-4" />
                    Insufficient balance to complete this send.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedSend}
              disabled={sending || !estimate?.hasSufficientBalance}
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Confirm &amp; Send
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Trigger Button */}
      <Button
        size={size}
        variant="default"
        onClick={handleClick}
        disabled={loading || sending}
        className={`gap-2 ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking...
          </>
        ) : (
          <>
            <Send className="h-3 w-3" />
            Send Reminder{students.length > 1 ? `s (${students.length})` : ""}
          </>
        )}
      </Button>
    </>
  )
}
