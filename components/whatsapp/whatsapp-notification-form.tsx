"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { FileUploader } from "@/components/ui/file-uploader-new"
import { toast } from "sonner"
import { sendBulkNotification, getNotificationEstimate } from "@/actions/whatsapp-notification"
import { Bold, Italic, Strikethrough, MessageSquare, Image as ImageIcon, Loader2, Clock, AlertTriangle, Wallet, Send } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
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

interface Class {
  id: string
  name: string
}

interface WhatsAppNotificationFormProps {
  classes: Class[]
}

interface CostEstimate {
  validCount: number
  totalCost: number
  balance: number
  hasSufficientBalance: boolean
}

export function WhatsAppNotificationForm({ classes }: WhatsAppNotificationFormProps) {
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [notificationType, setNotificationType] = useState("General")
  const [mainMessage, setMainMessage] = useState("")
  const [messageType, setMessageType] = useState<'text' | 'image'>('text')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [estimate, setEstimate] = useState<CostEstimate | null>(null)
  const [estimating, setEstimating] = useState(false)
  // Controls the styled confirmation dialog
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Fetch cost estimate whenever class selection changes
  useEffect(() => {
    if (selectedClasses.length === 0) {
      setEstimate(null)
      return
    }
    setEstimating(true)
    ;(async () => {
      const est = await getNotificationEstimate(selectedClasses)
      if (est.success) {
        setEstimate({
          validCount: est.validCount ?? 0,
          totalCost: est.totalCost ?? 0,
          balance: est.balance ?? 0,
          hasSufficientBalance: est.hasSufficientBalance ?? false,
        })
      } else {
        setEstimate(null)
      }
      setEstimating(false)
    })()
  }, [selectedClasses])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClasses(classes.map(c => c.id))
    } else {
      setSelectedClasses([])
    }
  }

  const handleClassToggle = (classId: string, checked: boolean) => {
    if (checked) {
      setSelectedClasses(prev => [...prev, classId])
    } else {
      setSelectedClasses(prev => prev.filter(id => id !== classId))
    }
  }

  const applyFormat = (format: 'bold' | 'italic' | 'strikethrough') => {
    const textarea = document.getElementById('message-textarea') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = mainMessage.substring(start, end)

    let formattedText = selectedText
    switch (format) {
      case 'bold':
        formattedText = `*${selectedText}*`
        break
      case 'italic':
        formattedText = `_${selectedText}_`
        break
      case 'strikethrough':
        formattedText = `~${selectedText}~`
        break
    }

    const newMessage = mainMessage.substring(0, start) + formattedText + mainMessage.substring(end)
    setMainMessage(newMessage)

    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + formattedText.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  // Step 1: validate inputs and open the confirmation dialog
  const handleSend = async () => {
    if (selectedClasses.length === 0) {
      toast.error("Please select at least one class")
      return
    }
    if (!mainMessage.trim()) {
      toast.error("Please enter a message")
      return
    }
    if (messageType === 'image' && !mediaFile) {
      toast.error("Please upload an image")
      return
    }

    const hasInvalidChars = /[\n\r\t]/g.test(mainMessage) || /[\n\r\t]/g.test(notificationType)
    const hasExcessiveSpacing = / {4,}/g.test(mainMessage) || / {4,}/g.test(notificationType)
    if (hasInvalidChars || hasExcessiveSpacing) {
      toast.error("Format Violation", {
        description: "Due to AiSensy guidelines, you cannot use newlines (Enter), tabs, or more than 4 consecutive spaces."
      })
      return
    }

    // Refresh estimate right before confirming
    const freshEst = await getNotificationEstimate(selectedClasses)
    if (!freshEst.success) {
      toast.error(freshEst.error || "Failed to estimate cost")
      return
    }
    if (!freshEst.hasSufficientBalance) {
      toast.error(
        `Insufficient balance. Required ₹${(freshEst.totalCost ?? 0).toFixed(2)}, available ₹${(freshEst.balance ?? 0).toFixed(2)}`
      )
      return
    }

    setEstimate({
      validCount: freshEst.validCount ?? 0,
      totalCost: freshEst.totalCost ?? 0,
      balance: freshEst.balance ?? 0,
      hasSufficientBalance: freshEst.hasSufficientBalance ?? false,
    })
    setConfirmOpen(true)
  }

  // Step 2: called when user clicks "Confirm" inside the dialog
  const handleConfirmedSend = async () => {
    setSending(true)
    try {
      const formData = new FormData()
      selectedClasses.forEach(id => formData.append('classIds', id))
      formData.append('notificationType', notificationType.trim())
      formData.append('mainMessage', mainMessage.trim())
      formData.append('messageType', messageType)
      if (mediaFile) {
        formData.append('mediaFile', mediaFile)
      }

      const result = await sendBulkNotification(formData)

      if (result.success) {
        toast.success(`Broadcast scheduled! ${result.message}`, {
          description: `Job ID: ${result.jobId}`,
          duration: 6000,
        })
        setMainMessage("")
        setMediaFile(null)
        setSelectedClasses([])
        setEstimate(null)
      } else {
        toast.error(result.error || "Failed to schedule notification")
      }
    } catch {
      toast.error("An error occurred while scheduling the notification")
    } finally {
      setSending(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
      {/* Styled Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Broadcast</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-1">
                <p>You are about to send a WhatsApp notification. Please review the cost below before proceeding.</p>
                <div className="rounded-md border bg-muted/50 p-4 text-sm space-y-2 text-foreground">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recipients</span>
                    <span className="font-semibold">{estimate?.validCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost per message</span>
                    <span className="font-semibold">
                      ₹{estimate && estimate.validCount > 0
                        ? (estimate.totalCost / estimate.validCount).toFixed(2)
                        : "0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2 mt-1">
                    <span className="text-muted-foreground font-medium">Total Credits</span>
                    <span className="font-bold text-primary">₹{(estimate?.totalCost ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Balance after</span>
                    <span className="font-semibold">
                      ₹{((estimate?.balance ?? 0) - (estimate?.totalCost ?? 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedSend} disabled={sending}>
              {sending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Scheduling...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />Confirm &amp; Send</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Class Selection */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Select Recipients</CardTitle>
            <CardDescription>Choose classes to send the message to</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b">
              <Checkbox
                id="select-all"
                checked={selectedClasses.length === classes.length && classes.length > 0}
                onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
              />
              <Label htmlFor="select-all" className="font-bold">Select All Classes</Label>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {classes.map((cls) => (
                <div key={cls.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`class-${cls.id}`}
                    checked={selectedClasses.includes(cls.id)}
                    onCheckedChange={(checked) => handleClassToggle(cls.id, checked as boolean)}
                  />
                  <Label htmlFor={`class-${cls.id}`}>{cls.name}</Label>
                </div>
              ))}
            </div>
            <div className="pt-2 text-sm text-muted-foreground">
              {selectedClasses.length} class{selectedClasses.length !== 1 ? 'es' : ''} selected
            </div>

            {/* Cost Estimate Panel */}
            {selectedClasses.length > 0 && (
              <div className={`rounded-lg border p-3 text-sm space-y-1 ${
                estimate?.hasSufficientBalance === false
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-green-50 border-green-200 text-green-800'
              }`}>
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  <Wallet className="h-4 w-4" />
                  Cost Estimate
                </div>
                {estimating ? (
                  <p className="text-muted-foreground italic">Calculating...</p>
                ) : estimate ? (
                  <>
                    <p>Recipients: <span className="font-medium">{estimate.validCount}</span></p>
                    <p>Cost: <span className="font-medium">₹{estimate.totalCost.toFixed(2)}</span></p>
                    <p>Balance: <span className="font-medium">₹{estimate.balance.toFixed(2)}</span></p>
                    {!estimate.hasSufficientBalance && (
                      <p className="font-semibold mt-1">⚠ Insufficient balance</p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground italic">Unable to calculate</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Message Content */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Message Content</CardTitle>
            <CardDescription>Compose your WhatsApp notification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={messageType} onValueChange={(v) => setMessageType(v as 'text' | 'image')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Text Message
                </TabsTrigger>
                <TabsTrigger value="image" className="gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Image Message
                </TabsTrigger>
              </TabsList>

              <Alert className="mt-6 bg-amber-50 text-amber-900 border-amber-200">
                <AlertTriangle className="h-4 w-4 stroke-amber-600" />
                <AlertTitle className="text-amber-800">Strict Guidelines for WhatsApp Approval</AlertTitle>
                <AlertDescription className="text-amber-700/90 text-sm">
                  AiSensy strictly prohibits the use of <b>new-lines (Enter), tabs, or more than 4 consecutive spaces</b> in dynamic variables. All alerts must be formatted as one contiguous block of text.
                </AlertDescription>
              </Alert>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notification-type">Notification Type</Label>
                  <Input
                    id="notification-type"
                    placeholder="e.g. Leave, Event, Fee"
                    value={notificationType}
                    onChange={(e) => setNotificationType(e.target.value)}
                  />
                </div>

                {messageType === 'image' && (
                  <div className="space-y-2">
                    <Label>Image Attachment</Label>
                    <FileUploader
                      onFileSelect={setMediaFile}
                      label="Upload notification image"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="message-textarea">Main Message Content</Label>
                    <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/50">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => applyFormat('bold')} title="Bold (*text*)">
                        <Bold className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => applyFormat('italic')} title="Italic (_text_)">
                        <Italic className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => applyFormat('strikethrough')} title="Strikethrough (~text~)">
                        <Strikethrough className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="message-textarea"
                    placeholder="Type your main message here..."
                    className="min-h-[150px] font-sans"
                    value={mainMessage}
                    onChange={(e) => setMainMessage(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use the toolbar or manual characters (*bold*, _italic_, ~strikethrough~) for WhatsApp formatting.
                  </p>
                </div>
              </div>
            </Tabs>

            <div className="flex justify-end pt-4">
              <Button
                size="lg"
                className="gap-2"
                onClick={handleSend}
                disabled={sending || estimating || estimate?.hasSufficientBalance === false}
              >
                {sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Scheduling...</>
                ) : (
                  <><Clock className="h-4 w-4" />Schedule Broadcast</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
