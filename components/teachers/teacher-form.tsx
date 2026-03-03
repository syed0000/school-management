"use client"

import { useForm, useFieldArray } from "react-hook-form"
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
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Save, Plus, Trash } from "lucide-react"
import { createTeacher, updateTeacher } from "@/actions/teacher"
import { useRouter, usePathname } from "next/navigation"
import { FileUploader } from "@/components/ui/file-uploader-new"
import { Teacher } from "@/types"
import logger from "@/lib/logger"

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().min(10, "Valid phone number is required"),
  joiningDate: z.string().min(1, "Joining Date is required"),
  aadhaar: z.string().regex(/^\d{12}$/, "Aadhaar number must be 12 digits"),
  
  // Optional
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
})

interface TeacherFormProps {
  teacher?: Teacher
  isEdit?: boolean
}

export function TeacherForm({ teacher, isEdit = false }: TeacherFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(false)
  
  // Local state for files
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [experienceLetterFile, setExperienceLetterFile] = useState<File | null>(null)
  const [documentFiles, setDocumentFiles] = useState<{ index: number, file: File | null }[]>([])

  const form = useForm<z.input<typeof formSchema>>({
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
        amount: teacher?.salary?.amount || "",
        effectiveDate: teacher?.salary?.effectiveDate ? new Date(teacher.salary.effectiveDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      },
      documents: teacher?.documents || [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "documents",
  });
  
  const handleDocumentFileChange = (index: number, file: File | null) => {
      setDocumentFiles(prev => {
          const filtered = prev.filter(item => item.index !== index);
          if (file) {
              return [...filtered, { index, file }];
          }
          return filtered;
      });
  };

  async function onSubmit(values: z.input<typeof formSchema>) {
    setIsLoading(true)
    try {
      const formData = new FormData();
      
      // Basic Fields
      formData.append('name', values.name);
      if (values.email) formData.append('email', values.email);
      formData.append('phone', values.phone);
      formData.append('joiningDate', values.joiningDate);
      formData.append('aadhaar', values.aadhaar);
      if (values.governmentTeacherId) formData.append('governmentTeacherId', values.governmentTeacherId);
      
      // Parents
      if (values.parents.fatherName) formData.append('fatherName', values.parents.fatherName);
      if (values.parents.motherName) formData.append('motherName', values.parents.motherName);
      
      // Salary
      formData.append('salaryAmount', String(values.salary.amount));
      formData.append('salaryEffectiveDate', values.salary.effectiveDate || new Date().toISOString().split('T')[0]);
      
      // Experience
      if (values.pastExperience?.totalExperience) {
          formData.append('totalExperience', values.pastExperience.totalExperience.toString());
      }
      
      // Files
      if (photoFile) {
          formData.append('photo', photoFile);
      }
      if (experienceLetterFile) {
          formData.append('experienceLetter', experienceLetterFile);
      }
      
      // Documents
      const docMeta = values.documents?.map((doc) => {
          return {
              type: doc.type,
              documentNumber: doc.documentNumber
          };
      });
      
      if (docMeta && docMeta.length > 0) {
          formData.append('document_meta', JSON.stringify(docMeta));
          
          values.documents?.forEach((_, index) => {
              const fileEntry = documentFiles.find(f => f.index === index);
              if (fileEntry && fileEntry.file) {
                  formData.append('document_files', fileEntry.file);
              } else {
                  formData.append('document_files', new File([], "empty"));
              }
          });
      }
      
      let result;
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
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="teacher@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="9876543210" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="aadhaar"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aadhaar Number</FormLabel>
                      <FormControl>
                        <Input placeholder="12-digit Aadhaar" maxLength={12} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="joiningDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Joining Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Parents */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Parents (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="parents.fatherName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Father&apos;s Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Father Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="parents.motherName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mother&apos;s Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Mother Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Professional Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Professional Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="governmentTeacherId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Govt Teacher ID (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Unique Govt ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="salary.amount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Salary Amount</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="50000" {...field} value={Number(field.value) || ""} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="salary.effectiveDate"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Effective Date</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="pastExperience.totalExperience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Experience (Years)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g. 5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pastExperience.experienceLetter"
                  render={() => (
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
                  )}
                />
              </div>
            </div>

            {/* Documents */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Documents & Photos</h3>
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
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ type: "", documentNumber: "" })}>
                            <Plus className="mr-2 h-4 w-4" /> Add Document
                        </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        {fields.map((field, index) => (
                            <Card key={field.id} className="p-4 relative">
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                    onClick={() => {
                                        remove(index);
                                        setDocumentFiles(prev => prev.filter(f => f.index !== index));
                                    }}
                                >
                                    <Trash className="h-3 w-3" />
                                </Button>
                                <div className="space-y-3">
                                    <FormField
                                        control={form.control}
                                        name={`documents.${index}.type`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Document Type</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. PAN, Aadhaar, Experience Cert" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`documents.${index}.documentNumber`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Document Number (Optional)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Doc No." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
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
