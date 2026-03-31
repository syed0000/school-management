"use client"

import { useState, useEffect } from "react"
import { Bell, BellOff, Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { updatePushToken, togglePushSetting } from "@/actions/notification"

interface PushNotificationToggleProps {
  userId: string
  role: 'teacher' | 'parent'
  initialEnabled: boolean
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function PushNotificationToggle({ userId, role, initialEnabled }: PushNotificationToggleProps) {
  const [isEnabled, setIsEnabled] = useState(initialEnabled)
  const [isLoading, setIsLoading] = useState(false)
  const [isSupported, setIsSupported] = useState(true)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsSupported("serviceWorker" in navigator && "PushManager" in window)
    }
  }, [])

  const handleToggle = async (checked: boolean) => {
    if (!isSupported) {
      toast.error("Push notifications are not supported on this browser.")
      return
    }

    setIsLoading(true)
    try {
      if (checked) {
        // Request permission
        const permission = await Notification.requestPermission()
        if (permission !== "granted") {
          toast.error("Permission denied for notifications.")
          setIsEnabled(false)
          return
        }

        // Register/Get SW
        const registration = await navigator.serviceWorker.ready
        
        // Subscribe
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })

        // Save token to DB
        const res = await updatePushToken(userId, role, JSON.stringify(subscription), true)
        if (res.success) {
          setIsEnabled(true)
          toast.success("Push notifications enabled successfully!")
        } else {
          toast.error("Failed to save notification settings.")
          setIsEnabled(false)
        }
      } else {
        // Disable
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        
        if (subscription) {
          await subscription.unsubscribe()
          await updatePushToken(userId, role, JSON.stringify(subscription), false)
        } else {
          await togglePushSetting(userId, role, false)
        }
        
        setIsEnabled(false)
        toast.info("Push notifications disabled.")
      }
    } catch (error) {
      console.error("Push Error:", error)
      toast.error("An error occurred while setting up notifications.")
      setIsEnabled(!checked)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSupported) return null

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30 backdrop-blur-sm transition-all hover:bg-muted/50">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
          {isEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </div>
        <div className="space-y-0.5">
          <Label htmlFor="push-toggle" className="text-sm font-semibold cursor-pointer">
            Push Notifications
          </Label>
          <p className="text-xs text-muted-foreground">
            {isEnabled ? "You are receiving real-time updates" : "Get notified about classes & announcements"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Switch
          id="push-toggle"
          checked={isEnabled}
          onCheckedChange={handleToggle}
          disabled={isLoading}
        />
      </div>
    </div>
  )
}
