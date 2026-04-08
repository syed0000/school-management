"use client"

import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useState, useEffect } from "react"
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
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save, Plus, Trash } from "lucide-react"
import { createTeacher, updateTeacher } from "@/actions/teacher"
import { getClasses } from "@/actions/class"
import { useRouter, usePathname } from "next/navigation"
import { FileUploader } from "@/components/ui/file-uploader-new"
import { Teacher } from "@/types"
import logger from "@/lib/logger"

const SECTIONS = ["A", "B", "C", "D"] as const

const assignedClassSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  section: z.enum(SECTIONS),
  attendanceAccess: z.boolean().default(false),
  feeAccess: z.boolean().default(false),
})

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().min(10, "Valid phone number is required"),
  joiningDate: z.string().min(1, "Joining Date is required"),
  aadhaar: z.string().regex(/^\d{12}$/, "Aadhaar number must be 12 digits"),
  
  pastExperience: z.object({
    schoolName: z.string().optional(),
    totalExperience: z.string().optional(),
    experienceLetter: z.string().optional(),
  }).optional(),
  governmentTeacherId: z.string().optional(),
  
  parents: z.object({
    fatherName: z.string().optional(),
    motherName: z.string().optional(),
  }),

  salary: z.object({
    amount: z.coerce.number().min(0, "Salary amount is required").default(0),
    effectiveDate: z.string().default(new Date().toISOString().split('T')[0]),
  }),

  documents: z.array(z.object({
    type: z.string().min(1, "Document Type is required"),
    documentNumber: z.string().optional(),
    image: z.string().optional(),
  })).optional(),

  assignedClasses: z.array(assignedClassSchema).default([]),
})

type FormValues = z.input<typeof formSchema>

interface ClassOption {
  id: string
  name: string
}

interface TeacherFormProps {
  teacher?: Teacher
  isEdit?: boolean
}

export function TeacherForm({ teacher, isEdit = false }: TeacherFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(false)
  const [availableClasses, setAvailableClasses] = useState<ClassOption[]>([])
  
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [experienceLetterFile, setExperienceLetterFile] = useState<File | null>(null)
  const [documentFiles, setDocumentFiles] = useState<{ index: number, file: File | null }[]>([])

  useEffect(() => {
    getClasses().then(setAvailableClasses)
  }, [])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: teacher?.name || "",
      email: teacher?.email || "",
      phone: teacher?.phone || "",
      joiningDate: teacher?.joiningDate ? new Date(teacher.joiningDate).toISOString().split('T')[0] : "",
      aadhaar: teacher?.aadhaar || "",
      pastExperience: {
        totalExperience: teacher?.pastExperience?.totalExperience?.toString() || "",
      },
      governmentTeacherId: teacher?.governmentTeacherId || "",
      parents: {
        fatherName: teacher?.parents?.fatherName || "",
        motherName: teacher?.parents?.motherName || "",
      },
      salary: {
        amount: teacher?.salary?.amount || 0,
        effectiveDate: teacher?.salary?.effectiveDate ? new Date(teacher.salary.effectiveDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      },
      documents: teacher?.documents || [],
      assignedClasses: teacher?.assignedClasses?.map((ac: { classId?: string | { _id?: string }; section?: string; attendanceAccess?: boolean; feeAccess?: boolean }) => ({
        classId: typeof ac.classId === 'object' && ac.classId !== null ? String(ac.classId._id || ac.classId) : String(ac.classId || ''),
        section: ac.section as typeof SECTIONS[number],
        attendanceAccess: Boolean(ac.attendanceAccess),
        feeAccess: Boolean(ac.feeAccess),
      })) || [],
    },
  })

  const { fields: docFields, append: appendDoc, remove: removeDoc } = useFieldArray({
    control: form.control,
    name: "documents",
  })

  const { fields: classFields, append: appendClass, remove: removeClass } = useFieldArray({
    control: form.control,
    name: "assignedClasses",
  })
  
  const handleDocumentFileChange = (index: number, file: File | null) => {
    setDocumentFiles(prev => {
      const filtered = prev.filter(item => item.index !== index)
      if (file) return [...filtered, { index, file }]
      return filtered
    })
  }

  async function onSubmit(values: FormValues) {
    setIsLoading(true)
    try {
      const formData = new FormData()
      
      formData.append('name', values.name)
      if (values.email) formData.append('email', values.email)
      formData.append('phone', values.phone)
      formData.append('joiningDate', values.joiningDate)
      formData.append('aadhaar', values.aadhaar)
      if (values.governmentTeacherId) formData.append('governmentTeacherId', values.governmentTeacherId)
      
      if (values.parents.fatherName) formData.append('fatherName', values.parents.fatherName)
      if (values.parents.motherName) formData.append('motherName', values.parents.motherName)
      
      formData.append('salaryAmount', String(values.salary.amount))
      formData.append('salaryEffectiveDate', values.salary.effectiveDate || new Date().toISOString().split('T')[0])
      
      if (values.pastExperience?.totalExperience) {
        formData.append('totalExperience', values.pastExperience.totalExperience.toString())
      }
      
      if (photoFile) formData.append('photo', photoFile)
      if (experienceLetterFile) formData.append('experienceLetter', experienceLetterFile)
      
      // Documents
      const docMeta = values.documents?.map((doc) => ({
        type: doc.type,
        documentNumber: doc.documentNumber,
      }))
      
      if (docMeta && docMeta.length > 0) {
        formData.append('document_meta', JSON.stringify(docMeta))
        values.documents?.forEach((_, index) => {
          const fileEntry = documentFiles.find(f => f.index === index)
          if (fileEntry && fileEntry.file) {
            formData.append('document_files', fileEntry.file)
          } else {
            formData.append('document_files', new File([], "empty"))
          }
        })
      }
      
      // Assigned Classes
      formData.append('assignedClasses', JSON.stringify(values.assignedClasses))
      
      let result
      if (isEdit && teacher) {
        result = await updateTeacher(teacher._id, formData)
      } else {
        result = await createTeacher(formData)
      }
      
      if (result.success) {
        toast.success(`Teacher ${isEdit ? 'updated' : 'created'} successfully`)
        const redirectPath = pathname?.startsWith("/admin") ? "/admin/teachers" : "/teachers"
        router.push(redirectPath) 
        router.refresh()
      } else {
        toast.error(`Failed to ${isEdit ? 'update' : 'create'} teacher: ${result.error}`)
      }
    } catch (error) {
      logger.error(error)
      toast.error("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? 'Edit Teacher Details' : 'Add New Teacher'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
            
            {/* Personal Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Personal Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input placeholder="teacher@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input placeholder="9876543210" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="aadhaar" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aadhaar Number</FormLabel>
                    <FormControl><Input placeholder="12-digit Aadhaar" maxLength={12} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="joiningDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Joining Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Parents */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Parents (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="parents.fatherName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Father&apos;s Name</FormLabel>
                    <FormControl><Input placeholder="Father Name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="parents.motherName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mother&apos;s Name</FormLabel>
                    <FormControl><Input placeholder="Mother Name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Professional Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Professional Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="governmentTeacherId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Govt Teacher ID (Optional)</FormLabel>
                    <FormControl><Input placeholder="Unique Govt ID" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="salary.amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salary Amount</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="50000" {...field} value={Number(field.value) || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="salary.effectiveDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="pastExperience.totalExperience" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Experience (Years)</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g. 5" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="pastExperience.experienceLetter" render={() => (
                  <FormItem>
                    <FormLabel>Experience Letter (Image)</FormLabel>
                    <FormControl>
                      <FileUploader 
                        onFileSelect={setExperienceLetterFile}
                        label="Upload Letter"
                        className="mt-0"
                        previewUrl={teacher?.pastExperience?.experienceLetter}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* ── Portal Access: Assigned Classes ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Portal Access — Assigned Classes</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Each entry grants the teacher access to that class&apos;s data. Enable Attendance Access to allow marking/editing attendance for that class.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendClass({ classId: "", section: "A", attendanceAccess: false, feeAccess: false })}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Class
                </Button>
              </div>

              {classFields.length === 0 && (
                <div className="text-sm text-muted-foreground border rounded-lg p-4 text-center">
                  No classes assigned. The teacher will not have portal access.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {classFields.map((field, index) => (
                  <Card key={field.id} className="relative p-4">
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={() => removeClass(index)}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        {/* Class */}
                        <FormField control={form.control} name={`assignedClasses.${index}.classId`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Class</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableClasses.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />

                        {/* Section */}
                        <FormField control={form.control} name={`assignedClasses.${index}.section`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Section</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Sec" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {SECTIONS.map((s) => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Attendance Access toggle */}
                        <FormField control={form.control} name={`assignedClasses.${index}.attendanceAccess`} render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-md border px-3 py-2 bg-green-50/50">
                            <div>
                              <FormLabel className="text-xs font-medium cursor-pointer">Attendance</FormLabel>
                              <p className="text-[9px] text-muted-foreground">Mark/edit</p>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="scale-75 data-[state=checked]:bg-green-500"
                              />
                            </FormControl>
                          </FormItem>
                        )} />

                        {/* Fee Access toggle */}
                        <FormField control={form.control} name={`assignedClasses.${index}.feeAccess`} render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-md border px-3 py-2 bg-blue-50/50">
                            <div>
                              <FormLabel className="text-xs font-medium cursor-pointer">Fee Reports</FormLabel>
                              <p className="text-[9px] text-muted-foreground">View dues</p>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="scale-75 data-[state=checked]:bg-blue-500"
                              />
                            </FormControl>
                          </FormItem>
                        )} />
                      </div>

                      {/* Preview badge */}
                      <div className="flex gap-1 flex-wrap">
                        {form.watch(`assignedClasses.${index}.classId`) && (
                          <Badge variant="secondary" className="text-[10px]">
                            {availableClasses.find(c => c.id === form.watch(`assignedClasses.${index}.classId`))?.name}
                            {' '}{form.watch(`assignedClasses.${index}.section`)}
                          </Badge>
                        )}
                        {form.watch(`assignedClasses.${index}.attendanceAccess`) && (
                          <Badge className="text-[10px] bg-green-100 text-green-700 hover:bg-green-100 px-1 py-0 h-4">
                            Att ✓
                          </Badge>
                        )}
                        {form.watch(`assignedClasses.${index}.feeAccess`) && (
                          <Badge className="text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-100 px-1 py-0 h-4">
                            Fee ✓
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Documents & Photos */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Documents &amp; Photos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <FormLabel>Teacher Photo</FormLabel>
                  <FileUploader 
                    onFileSelect={setPhotoFile} 
                    label="Upload Photo"
                    previewUrl={teacher?.photo}
                  />
                </div>

                <div className="space-y-2 col-span-1 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <FormLabel>Documents</FormLabel>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendDoc({ type: "", documentNumber: "" })}>
                      <Plus className="mr-2 h-4 w-4" /> Add Document
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {docFields.map((field, index) => (
                      <Card key={field.id} className="p-4 relative">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          onClick={() => {
                            removeDoc(index)
                            setDocumentFiles(prev => prev.filter(f => f.index !== index))
                          }}
                        >
                          <Trash className="h-3 w-3" />
                        </Button>
                        <div className="space-y-3">
                          <FormField control={form.control} name={`documents.${index}.type`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Document Type</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. PAN, Aadhaar, Experience Cert" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`documents.${index}.documentNumber`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Document Number (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Doc No." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <div className="space-y-2">
                            <FormLabel className="text-xs">Document Image</FormLabel>
                            <FileUploader 
                              onFileSelect={(file) => handleDocumentFileChange(index, file)}
                              label=""
                              className="mt-0"
                              previewUrl={field.image}
                            />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {isEdit ? 'Update Teacher' : 'Create Teacher'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
