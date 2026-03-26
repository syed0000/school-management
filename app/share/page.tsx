"use client"

import { useQRCode } from "next-qrcode"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Share2, Copy, Check } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { BackButton } from "@/components/ui/back-button"

export default function SharePage() {
  const { Canvas } = useQRCode()
  const [origin, setOrigin] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "School Management System",
          text: "Check out our school management system!",
          url: origin,
        })
      } catch (error) {
        console.error("Error sharing:", error)
      }
    } else {
      handleCopy()
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(origin)
    setCopied(true)
    toast.success("URL copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  if (!origin) return null

  return (
    <div className="container max-w-md mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <BackButton />
        <h1 className="text-2xl font-bold">Share App</h1>
      </div>

      <Card className="overflow-hidden border-2 border-primary/10 shadow-xl bg-card">
        <CardHeader className="text-center pb-2 bg-primary/5">
          <CardTitle className="text-xl">App QR Code</CardTitle>
          <CardDescription>Scan this code to open the app on another device</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center pt-8 pb-8 space-y-6">
          <div className="p-4 bg-white rounded-2xl shadow-inner border-4 border-muted">
            <Canvas
              text={origin}
              options={{
                errorCorrectionLevel: 'M',
                margin: 1,
                scale: 4,
                width: 200,
                color: {
                  dark: '#000000',
                  light: '#FFFFFF',
                },
              }}
            />
          </div>

          <div className="w-full space-y-3">
            <Button
              onClick={handleShare}
              className="w-full h-12 text-lg font-semibold gap-2 shadow-lg"
            >
              <Share2 className="h-5 w-5" />
              Share App Link
            </Button>

            <Button
              variant="outline"
              onClick={handleCopy}
              className="w-full h-11 gap-2"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy URL"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground px-4">
        Share this app with teachers, parents, and staff to streamline school management.
      </p>
    </div>
  )
}
