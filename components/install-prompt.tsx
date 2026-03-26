'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void> | void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>
}

export function InstallPrompt() {
  const [isIOSDismissed, setIsIOSDismissed] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  const isIOS =
    !isIOSDismissed &&
    typeof window !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !('MSStream' in window)

  const isStandalone =
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  if (isStandalone) {
    return null // Don't show install button if already installed
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return
    }
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  if (isIOS) {
    return (
      <div className="fixed bottom-16 left-4 right-4 z-50 rounded-lg border bg-background p-4 shadow-lg md:left-auto md:right-4 md:w-96 cursor-pointer">
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">Install App</h3>
          <p className="text-sm text-muted-foreground">
            To install this app on your iOS device, tap the share button
            <span className="mx-1 inline-block">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </span>
            and then {`"Add to Home Screen"`}
            <span className="mx-1 inline-block">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="2" width="20" height="20" rx="4" ry="4" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </span>
            .
          </p>
          <Button variant="outline" size="sm" onClick={() => setIsIOSDismissed(true)}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  if (!deferredPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 flex justify-center pointer-events-none cursor-pointer">
      <div className="pointer-events-auto shadow-lg">
          <Button onClick={handleInstallClick} className="gap-2 rounded-full" size="sm">
            <Download className="h-4 w-4" />
            Install App
          </Button>
      </div>
    </div>
  )
}
