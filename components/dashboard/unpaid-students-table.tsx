"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Globe, MessageCircle, Phone, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { sendBulkReminders } from "@/actions/whatsapp-reminders"
import { formatNumber } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const isWhatsAppEnabled = process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_INTEGRATION === 'true';

export interface UnpaidStudent {
  id: string
  name: string
  className: string
  amount: number
  months: string[]
  photo?: string
  mobile: string[]
  email: string[]
  registrationNumber?: string
  rollNumber?: string
}

interface UnpaidStudentsTableProps {
  students: UnpaidStudent[]
}

export function UnpaidStudentsTable({ students }: UnpaidStudentsTableProps) {
  const [language, setLanguage] = useState("en")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  const normalizePhoneDigits = (value: string) => value.replace(/[^\d]/g, "")

  const toggleSelectAll = () => {
    if (selected.size === students.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(students.map(s => s.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelected(next)
  }

  const handleSendReminders = async () => {
    if (selected.size === 0) return
    setSending(true)
    try {
      const lang = language === 'hi' ? 'hindi' : language === 'ur' ? 'urdu' : 'english'

      const studentsToSend = students.filter(s => selected.has(s.id)).map(s => ({
        id: s.id,
        name: s.name,
        contactNumber: formatForWaMe(s.mobile?.[0] || ''),
        className: s.className,
        details: s.months,
        amount: s.amount
      }));

      const result = await sendBulkReminders(studentsToSend, lang)
      if (result.success) {
        toast.success(result.message || 'Reminders sheduled to send one by one, you may check the process form you AI Sensy dashbaord')
        setSelected(new Set())
      } else {
        toast.error(`Failed to send reminders: ${result.error}`)
      }
    } catch {
      toast.error("An error occurred")
    } finally {
      setSending(false)
    }
  }

  const formatForWaMe = (value: string) => {
    const digits = normalizePhoneDigits(value)
    if (digits.length === 10) return `91${digits}`
    if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`
    return digits
  }

  const formatForTel = (value: string) => {
    const digits = normalizePhoneDigits(value)
    if (digits.length === 10) return `+91${digits}`
    if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`
    if (digits.startsWith("00")) return `+${digits.slice(2)}`
    if (digits.startsWith("91") && digits.length === 12) return `+${digits}`
    return value
  }

  const buildWhatsAppMessage = (student: UnpaidStudent) => {
    const monthsText = student.months.length > 0 ? student.months.join(", ") : "the selected period"

    switch (language) {
      case "hi":
        return `*फीस रिमाइंडर*\n\nयह *${student.name}* (कक्षा: ${student.className}) के लिए फीस रिमाइंडर है।\n\n*बकाया विवरण:*\n- महीना: ${monthsText}\n- कुल देय: *₹${formatNumber(student.amount)}*\n\nकृपया जल्द से जल्द फीस जमा करें।\nधन्यवाद।`
      case "ur":
        return `*فیس کی یاد دہانی*\n\nآداب،\n\nیہ *${student.name}* (کلاس: ${student.className}) کے لیے فیس کی یاد دہانی ہے۔\n\n *بقایا تفصیلات:*\n- مہینہ: ${monthsText}\n- کل واجب الادا: *₹${formatNumber(student.amount)}*\n\nبراہ کرم جلد از جلد فیس جمع کرائیں۔\nشکریہ۔`
      case "en":
      default:
        return `*Fee Reminder*\n\nHello,\n\nThis is a gentle reminder regarding the pending fees for *${student.name}* (Class: ${student.className}).\n\n *Details:*\n- Due for: ${monthsText}\n- Total Amount: *₹${formatNumber(student.amount)}*\n\nPlease clear the dues at your earliest convenience.\nThank you.`
    }
  }

  return (
    <Card className="col-span-4 shadow-sm mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold">Unpaid Students</CardTitle>
            <CardDescription>Students who haven&apos;t submitted fees in the selected period.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && isWhatsAppEnabled && (
              <Button
                size="sm"
                variant="default"
                onClick={handleSendReminders}
                disabled={sending}
                className="h-8 text-xs gap-2"
              >
                <Send className="h-3 w-3" />
                {sending ? 'Sending...' : `Send (${selected.size})`}
              </Button>
            )}
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="ur">Urdu</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="max-h-[460px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {isWhatsAppEnabled && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={students.length > 0 && selected.size === students.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              <TableHead>Student</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isWhatsAppEnabled ? 6 : 5} className="text-center text-muted-foreground">
                  No unpaid students for the selected period.
                </TableCell>
              </TableRow>
            ) : (
              students.map((student) => {
                const phones = (student.mobile || []).filter(Boolean).slice(0, 2)
                const emails = (student.email || []).filter(Boolean)
                const primaryEmail = emails[0]
                const extraEmails = Math.max(0, emails.length - 1)
                const extraPhones = Math.max(0, (student.mobile || []).filter(Boolean).length - phones.length)

                return (
                  <TableRow key={student.id}>
                    {isWhatsAppEnabled && (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(student.id)}
                          onCheckedChange={() => toggleSelect(student.id)}
                          aria-label={`Select ${student.name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={student.photo || ""} alt={student.name} />
                          <AvatarFallback>{student.name?.charAt(0) || "S"}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">{student.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {student.registrationNumber ? `Reg: ${student.registrationNumber}` : "Reg: N/A"}
                            {" • "}
                            {student.rollNumber ? `Roll: ${student.rollNumber}` : "Roll: N/A"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{student.className}</Badge>
                    </TableCell>
                    <TableCell className="space-y-1">
                      <div className="flex flex-wrap gap-2">
                        {phones.length === 0 ? (
                          <span className="text-sm text-muted-foreground">N/A</span>
                        ) : (
                          phones.map((phone) => {
                            const waTo = formatForWaMe(phone)
                            const telTo = formatForTel(phone)
                            const message = buildWhatsAppMessage(student)
                            const waUrl = `https://wa.me/${waTo}?text=${encodeURIComponent(message)}`

                            return (
                              <DropdownMenu key={phone}>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="link" className="h-auto p-0 text-sm">
                                    {phone}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuLabel>{phone}</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem asChild>
                                    <a href={waUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                                      <MessageCircle className="size-4" />
                                      WhatsApp message
                                    </a>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <a href={`tel:${telTo}`} className="flex items-center gap-2">
                                      <Phone className="size-4" />
                                      Call
                                    </a>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )
                          })
                        )}
                        {extraPhones > 0 ? (
                          <span className="text-xs text-muted-foreground">+{extraPhones} more</span>
                        ) : null}
                      </div>
                      {primaryEmail ? (
                        <div className="text-xs">
                          <a href={`mailto:${primaryEmail}`} className="text-primary underline underline-offset-4">
                            {primaryEmail}
                          </a>
                          {extraEmails > 0 ? (
                            <span className="text-muted-foreground"> +{extraEmails} more</span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">No email</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {student.months.slice(0, 4).map((m, i) => (
                          <Badge key={`${m}-${i}`} variant="secondary" className="text-xs">
                            {m}
                          </Badge>
                        ))}
                        {student.months.length > 4 ? (
                          <span className="text-xs text-muted-foreground">+{student.months.length - 4} more</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-red-600">₹{formatNumber(student.amount)}</span>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
            {students.length > 0 && (
              <TableRow>
                <TableCell colSpan={isWhatsAppEnabled ? 5 : 4} className="text-right font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right font-bold">
                  ₹{formatNumber(students.reduce((total, student) => total + student.amount, 0))}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
