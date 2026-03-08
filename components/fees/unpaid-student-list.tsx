'use client'

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Users, Send, Globe } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { sendBulkReminders } from "@/actions/whatsapp-reminders"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const isWhatsAppEnabled = process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_INTEGRATION === 'true';

interface UnpaidStudent {
  id: string
  name: string
  registrationNumber: string
  className: string
  amount: number
  details: string[]
  photo?: string
  contactNumber?: string
}

interface UnpaidStudentListProps {
  students: UnpaidStudent[]
}

export function UnpaidStudentList({ students }: UnpaidStudentListProps) {
  const [language, setLanguage] = useState("en")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

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
        contactNumber: s.contactNumber || '',
        className: s.className,
        details: s.details,
        amount: s.amount
      }));

      const result = await sendBulkReminders(studentsToSend, lang)
      if (result.success) {
        const successCount = result.summary?.sent || 0
        const failedCount = result.summary?.failed || 0
        
        if (failedCount > 0) {
            const failures = result.details?.filter(r => r.status === 'failed')
            const failureMsg = failures?.map(f => `${f.name}: ${f.error}`).join('\n')
            
            toast.message(`Sent ${successCount} reminders`, {
                description: `Failed for ${failedCount}\nstudents:\n${failureMsg}`,
                duration: 5000,
            })
        } else {
            toast.success(`Successfully sent ${successCount} reminders`)
        }
        
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

  if (students.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No unpaid students found</h3>
        <p className="text-muted-foreground">All students have paid their fees!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {selected.size > 0 && isWhatsAppEnabled && (
        <div className="flex items-center justify-between bg-muted/50 p-2 rounded-lg border">
          <span className="text-sm font-medium px-2">{selected.size} students selected</span>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[120px] h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="ur">Urdu</SelectItem>
              </SelectContent>
            </Select>
            <Button 
                size="sm" 
                variant="default"
                onClick={handleSendReminders} 
                disabled={sending}
                className="h-8 text-xs gap-2"
            >
                <Send className="h-3 w-3" />
                {sending ? 'Sending...' : 'Send Reminder'}
            </Button>
          </div>
        </div>
      )}
      <div className="rounded-md border">
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
            <TableHead>Unpaid Details</TableHead>
            <TableHead className="text-right">Amount Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
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
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={student.photo} />
                    <AvatarFallback>{student.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{student.name}</div>
                    <div className="text-xs text-muted-foreground">{student.registrationNumber}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{student.className}</Badge>
              </TableCell>
              <TableCell className="text-sm">
                {student.contactNumber || 'N/A'}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {student.details.map((detail, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {detail}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="font-bold text-red-600 text-lg">
                  ₹{student.amount.toLocaleString()}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
