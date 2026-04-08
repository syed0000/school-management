"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Printer, Check, ChevronsUpDown } from "lucide-react"
import { generateIdCard, generateBulkIdCards, saveSignature, getSignature } from "@/actions/id-card"
import { format } from "date-fns"
import { useEffect } from "react"
import { Upload, Sliders } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import { BackButton } from "../ui/back-button"
import { schoolConfig } from "@/lib/config"

const singleFormSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
})

const bulkFormSchema = z.object({
  classId: z.string().min(1, "Class is required"),
})

interface IDCardGeneratorProps {
  students: { id: string; name: string; registrationNumber: string }[]
  classes: { id: string; name: string }[]
}

interface IDCard {
  id: string
  name: string
  registrationNumber: string
  className: string
  section: string
  fatherName: string
  dob: string | Date
  address: string
  mobile: string
  photo?: string
}

export function IDCardGenerator({ students, classes }: IDCardGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [idCards, setIdCards] = useState<IDCard[]>([])
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState("2026-27")
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [sigConfig, setSigConfig] = useState({ x: 0, y: 0, scale: 80 })
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    getSignature().then(data => {
      if (data) {
        setSignatureUrl(data.url)
        setSigConfig({ x: data.x, y: data.y, scale: data.scale })
      }
    })
  }, [])

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await saveSignature(formData, sigConfig)
      if (res.success) {
        setSignatureUrl(res.url)
        toast.success("Signature uploaded and saved")
      }
    } catch {
      toast.error("Failed to upload signature")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!signatureUrl) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('signatureUrl', signatureUrl)
      await saveSignature(formData, sigConfig)
      toast.success("Signature settings saved")
    } catch {
      toast.error("Failed to save config")
    } finally {
      setIsUploading(false)
    }
  }

  const singleForm = useForm<z.infer<typeof singleFormSchema>>({
    resolver: zodResolver(singleFormSchema),
    defaultValues: {
      studentId: "",
    },
  })

  const bulkForm = useForm<z.infer<typeof bulkFormSchema>>({
    resolver: zodResolver(bulkFormSchema),
    defaultValues: {
      classId: "",
    },
  })

  async function onSingleSubmit(values: z.infer<typeof singleFormSchema>) {
    setIsLoading(true)
    try {
      const result = await generateIdCard(values.studentId)
      if (result.success) {
        setIdCards([result.data])
        toast.success("ID Card generated successfully")
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast.error("Failed to generate ID Card")
    } finally {
      setIsLoading(false)
    }
  }

  async function onBulkSubmit(values: z.infer<typeof bulkFormSchema>) {
    setIsLoading(true)
    try {
      const result = await generateBulkIdCards(values.classId)
      if (result.success && result.data) {
        setIdCards(result.data)
        toast.success(`Generated ${result.data.length} ID Cards`)
      } else {
        toast.error(result.error || "Failed to generate ID Cards")
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast.error("Failed to generate ID Cards")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-8">
      <div className="no-print">
        <BackButton />
      </div>
      <Card className="no-print">
        <CardHeader>
          <CardTitle>Generate Student ID Cards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="session">Session</Label>
            <Input
              type="text"
              id="session"
              placeholder="e.g. 2024-25"
              value={session}
              onChange={(e) => setSession(e.target.value)}
            />
          </div>

          <Tabs defaultValue="single" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">Single Student</TabsTrigger>
              <TabsTrigger value="bulk">Bulk (By Class)</TabsTrigger>
            </TabsList>

            <TabsContent value="single">
              <Form {...singleForm}>
                <form onSubmit={singleForm.handleSubmit(onSingleSubmit)} className="space-y-4 mt-4">
                  <FormField
                    control={singleForm.control}
                    name="studentId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Select Student</FormLabel>
                        <Popover open={open} onOpenChange={setOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value
                                  ? students.find((s) => s.id === field.value)?.name + ` (${students.find((s) => s.id === field.value)?.registrationNumber})`
                                  : "Select Student"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0">
                            <Command>
                              <CommandInput placeholder="Search student..." />
                              <CommandList>
                                <CommandEmpty>No student found.</CommandEmpty>
                                <CommandGroup>
                                  {students.map((student) => (
                                    <CommandItem
                                      key={student.id}
                                      value={student.name + " " + student.registrationNumber}
                                      onSelect={() => {
                                        singleForm.setValue("studentId", student.id)
                                        setOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          student.id === field.value
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      {student.name} ({student.registrationNumber})
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Preview
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="bulk">
              <Form {...bulkForm}>
                <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-4 mt-4">
                  <FormField
                    control={bulkForm.control}
                    name="classId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Class</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Class" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {classes.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate All ID Cards
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="no-print">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5" />
            Signature Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
                <div className="space-y-2">
                    <Label>Signature File (Transparent PNG)</Label>
                    <div className="flex gap-2">
                         <Input 
                            type="file" 
                            accept="image/png" 
                            onChange={handleSignatureUpload}
                            className="text-xs"
                            disabled={isUploading}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="sig-x">Pos X (mm)</Label>
                    <Input 
                        id="sig-x"
                        type="number" 
                        value={sigConfig.x} 
                        onChange={(e) => setSigConfig(prev => ({ ...prev, x: Number(e.target.value) }))}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="sig-y">Pos Y (mm)</Label>
                    <Input 
                        id="sig-y"
                        type="number" 
                        value={sigConfig.y} 
                        onChange={(e) => setSigConfig(prev => ({ ...prev, y: Number(e.target.value) }))}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="sig-scale">Scale (px)</Label>
                    <Input 
                        id="sig-scale"
                        type="number" 
                        value={sigConfig.scale} 
                        onChange={(e) => setSigConfig(prev => ({ ...prev, scale: Number(e.target.value) }))}
                    />
                </div>
                <Button onClick={handleSaveConfig} variant="secondary" className="lg:w-full" disabled={isUploading || !signatureUrl}>
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Save Config
                </Button>
            </div>
            
            {signatureUrl && (
                <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-center border border-dashed h-24 relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                        src={signatureUrl} 
                        alt="Current Signature" 
                        className="max-h-full transition-all"
                        style={{ transform: `scale(${sigConfig.scale/100})` }}
                    />
                    <div className="absolute top-2 right-2 text-[10px] bg-background px-2 py-1 rounded shadow-sm">Current Preview</div>
                </div>
            )}
        </CardContent>
      </Card>

      {idCards.length > 0 && (
        <div className="flex flex-col items-center space-y-8">
          <Button onClick={handlePrint} className="no-print w-full max-w-xs">
            <Printer className="mr-2 h-4 w-4" />
            Print ID Cards ({idCards.length})
          </Button>

          <div className="id-cards-grid grid grid-cols-1 gap-8 w-full justify-items-center print:block">
            {idCards.map((card, index) => (
              <div
                key={index}
                className="id-card-container relative bg-white overflow-hidden shadow-lg print:shadow-none print:border print:border-gray-200 flex flex-col"
                style={{ width: '3.39in', height: '2.13in' }}
              >
                {/* Header */}
                <div className="h-[12mm] bg-[#1E3A8A] flex items-center px-2 relative overflow-hidden shrink-0">
                  <div className="absolute right-0 top-0 h-full w-8 bg-[#F59E0B] skew-x-12 translate-x-3 opacity-90" />

                  <div className="w-[10mm] h-[10mm] bg-white rounded-full flex items-center justify-center p-0.5 z-10 shadow-sm border overflow-clip shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.jpeg" alt="Logo" className="w-full h-full object-contain" />
                  </div>

                  <div className="ml-2 flex flex-col justify-center text-white z-10 w-full">
                    <h2 className="text-[14px] font-bold tracking-wide uppercase leading-tight">{schoolConfig.name}</h2>
                    <p className="text-[8px] opacity-90 font-medium tracking-wider">{schoolConfig.address}</p>
                  </div>
                </div>

                {/* Gold Strip */}
                <div className="h-[1mm] bg-[#F59E0B] w-full shrink-0" />

                {/* Content Area */}
                <div className="flex-1 p-2 flex flex-row gap-3 overflow-hidden relative">
                  {/* Photo Column */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="w-[25mm] h-[30mm] overflow-hidden bg-gray-50 border-2 border-black relative">
                      {card.photo ? (
                        <Image
                          src={card.photo}
                          alt={card.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[5px] text-gray-400 text-center font-medium p-1">
                          PHOTO
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info Column */}
                  <div className="flex-1 flex flex-col justify-start space-y-[2px] pt-0.5 min-w-0 relative z-10">
                    <div className="border-b border-gray-100 pb-1 mb-1">
                      <h3 className="text-[13px] font-bold text-black uppercase leading-none truncate">{card.name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] text-[#1E3A8A] font-bold uppercase">{card.className}</span>
                        {card.section && <span className="text-[9px] text-[#1E3A8A] font-bold uppercase">- {card.section}</span>}
                      </div>
                    </div>

                    <div className="space-y-[2px] w-full">
                      <div className="grid grid-cols-[40px_1fr] gap-1 items-baseline">
                        <span className="text-[9px] font-bold text-black uppercase">Reg. No.</span>
                        <span className="text-[9px] font-medium text-black truncate">: {card.registrationNumber}</span>
                      </div>
                      <div className="grid grid-cols-[40px_1fr] gap-1 items-baseline">
                        <span className="text-[9px] font-bold text-black uppercase">DOB</span>
                        <span className="text-[9px] font-medium text-black truncate">: {card.dob ? format(new Date(card.dob), "dd MMM yyyy") : '-'}</span>
                      </div>
                      <div className="grid grid-cols-[40px_1fr] gap-1 items-baseline">
                        <span className="text-[9px] font-bold text-black uppercase">Father</span>
                        <span className="text-[9px] font-medium text-black truncate">: {card.fatherName.toUpperCase()}</span>
                      </div>
                      <div className="grid grid-cols-[40px_1fr] gap-1 items-baseline">
                        <span className="text-[9px] font-bold text-black uppercase">Phone</span>
                        <span className="text-[9px] font-medium text-black truncate">: {card.mobile}</span>
                      </div>
                      <div className="grid grid-cols-[40px_1fr] gap-1 items-start">
                        <span className="text-[9px] font-bold text-black uppercase mt-px">Address</span>
                        <span className="text-[8px] font-medium text-black leading-tight line-clamp-2">: {card.address}</span>
                      </div>
                    </div>
                  </div>

                  {/* Authority Sign and session */}
                  <div className="absolute bottom-1.5 flex flex-row justify-between w-[95%] h-[12mm] overflow-visible items-end px-1 ml-1" style={{ width: 'calc(100% - 10px)' }}>
                    <div className="flex flex-col relative w-1/2 min-h-[10mm]">
                      {signatureUrl && (
                        <div 
                          className="absolute pointer-events-none"
                          style={{ 
                            bottom: `${sigConfig.y}mm`, 
                            left: `${sigConfig.x}mm`,
                            width: `${sigConfig.scale}px`,
                            zIndex: 20
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={signatureUrl} alt="" className="w-full object-contain" />
                        </div>
                      )}
                      <div className="w-full border-t border-black/80 mt-auto" />
                      <span className="text-[6px] font-black text-black uppercase tracking-[0.5px]">Authority Signature</span>
                    </div>
                    <span className="text-[7px] text-gray-800 font-black uppercase tracking-widest bg-gray-100/50 px-1 py-0.5 rounded border border-gray-200 shadow-sm mb-0.5">Session: {session}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page {
            margin: 10mm;
            size: A4;
          }
          .no-print {
            display: none !important;
          }
          .id-cards-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10mm;
            justify-items: center; 
            padding-top: 5mm;
            width: 100%;
          }
          .id-card-container {
             break-inside: avoid;
             page-break-inside: avoid;
             margin: 0;
             print-color-adjust: exact;
             -webkit-print-color-adjust: exact;
             border: 0.5px solid #e5e7eb;
          }
        }
      `}</style>
    </div>
  )
}
