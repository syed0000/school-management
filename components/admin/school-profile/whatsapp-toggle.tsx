"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { updateWhatsAppReceiptSetting } from "@/actions/school-settings"
import { toast } from "sonner"

interface WhatsAppToggleProps {
  initialValue: boolean
}

export function WhatsAppToggle({ initialValue }: WhatsAppToggleProps) {
  const [enabled, setEnabled] = useState(initialValue)
  const [loading, setLoading] = useState(false)

  const handleToggle = async (checked: boolean) => {
    setLoading(true)
    try {
      const result = await updateWhatsAppReceiptSetting(checked)
      if (result.success) {
        setEnabled(checked)
        toast.success(`WhatsApp receipt alerts ${checked ? 'enabled' : 'disabled'}`)
      } else {
        toast.error(result.error || "Failed to update setting")
      }
    } catch (error) {
      console.error(error)
      toast.error("Failed to update setting")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <Switch 
        id="whatsapp-receipt" 
        checked={enabled} 
        onCheckedChange={handleToggle}
        disabled={loading}
      />
      <Label htmlFor="whatsapp-receipt">Send Receipt WhatsApp Alert</Label>
    </div>
  )
}
