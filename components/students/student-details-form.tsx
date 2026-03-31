"use client"

import { useForm, useFieldArray, Resolver } from "react-hook-form"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Plus, Trash, Save } from "lucide-react"
import { updateStudent } from "@/actions/student"
import { useRouter } from "next/navigation"
import { FileUploader } from "@/components/ui/file-uploader"

const formSchema = z.object({
  registrationNumber: z.string().min(1, "Registration Number is required"),
  name: z.string().min(1, "Name is required"),
  classId: z.string().min(1, "Class is required"),
  section: z.enum(["A", "B", "C", "D"]).default("A"),
  rollNumber: z.string().optional(),
  dateOfBirth: z.string().min(1, "Date of Birth is required"),
  dateOfAdmission: z.string().optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  aadhaar: z.string().regex(/^\d{12}$/, "Aadhaar number must be 12 digits").optional().or(z.literal("")),
  
  // Parents
  parents: z.object({
    father: z.object({
      name: z.string().optional(),
      aadhaarNumber: z.string().regex(/^\d{12}$/, "Aadhaar number must be 12 digits").optional().or(z.literal("")),
    }),
    mother: z.object({
      name: z.string().optional(),
      aadhaarNumber: z.string().regex(/^\d{12}$/, "Aadhaar number must be 12 digits").optional().or(z.literal("")),
    })
  }),

  address: z.string().min(1, "Address is required"),
  email: z.array(z.object({ value: z.string().email("Invalid email") })).optional(),
  mobile: z.array(z.object({ value: z.string().min(10, "Valid mobile number is required") })).min(1, "At least one mobile number is required"),
  
  pen: z.string().optional(),
  lastInstitution: z.string().optional(),
  tcNumber: z.string().optional(),

  documents: z.array(z.object({
    type: z.string().min(1, "Document Type is required"),
    image: z.string().min(1, "Document Image is required"),
    documentNumber: z.string().optional(),
  })).optional(),
})

interface StudentData {
  id: string;
  _id?: string;
  registrationNumber: string;
  name: string;
  classId: string;
  className: string;
  section: string;
  rollNumber: string;
  gender: "Male" | "Female" | "Other";
  aadhaar?: string;
  fatherName: string;
  fatherAadhaar: string;
  motherName: string;
  motherAadhaar: string;
  parents?: {
      father?: { name?: string; aadhaarNumber?: string };
      mother?: { name?: string; aadhaarNumber?: string };
  };
  email: string[];
  dateOfBirth: string;
  dateOfAdmission: string;
  address: string;
  mobile: string[];
  photo?: string;
  documents: { type: string; image: string; documentNumber?: string; _id?: string }[];
  pen: string;
  lastInstitution: string;
  tcNumber: string;
}

interface StudentDetailsFormProps {
  student: StudentData
  classes: { id: string; name: string }[]
}

export function StudentDetailsForm({ student, classes }: StudentDetailsFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [photo, setPhoto] = useState<string | null>(student.photo || null)

  const form = useForm<z.infer<typeof formSchema>>({
    
    resolver: zodResolver(formSchema) as Resolver<z.infer<typeof formSchema>>,
    defaultValues: {
      registrationNumber: student.registrationNumber || "",
      name: student.name || "",
      classId: student.classId || "",
      section: (student.section as "A" | "B" | "C" | "D") || "A",
      rollNumber: student.rollNumber || "",
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : "",
      dateOfAdmission: student.dateOfAdmission ? new Date(student.dateOfAdmission).toISOString().split('T')[0] : "",
      gender: student.gender || "Male",
      aadhaar: student.aadhaar || "",
      
      parents: {
        father: { 
            name: student.parents?.father?.name || student.fatherName || "", 
            aadhaarNumber: student.parents?.father?.aadhaarNumber || student.fatherAadhaar || "" 
        },
        mother: { 
            name: student.parents?.mother?.name || student.motherName || "", 
            aadhaarNumber: student.parents?.mother?.aadhaarNumber || student.motherAadhaar || "" 
        }
      },
      
      address: student.address || "",
      email: student.email && student.email.length > 0 
        ? student.email.map((e: string) => ({ value: e })) 
        : [],
      mobile: student.mobile && student.mobile.length > 0 
        ? student.mobile.map((m: string) => ({ value: m })) 
        : [{ value: "" }],
        
      pen: student.pen || "",
      lastInstitution: student.lastInstitution || "",
      tcNumber: student.tcNumber || "",
      documents: student.documents || [],
    },
  })

  const { fields: mobileFields, append: appendMobile, remove: removeMobile } = useFieldArray({
    control: form.control,
    name: "mobile"
  });

  const { fields: emailFields, append: appendEmail, remove: removeEmail } = useFieldArray({
    control: form.control,
    name: "email"
  });

  const { fields: documentFields, append: appendDocument, remove: removeDocument } = useFieldArray({
    control: form.control,
    name: "documents"
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const payload = {
        ...values,
        mobile: values.mobile.map(m => m.value),
        email: values.email?.map(e => e.value),
        photo: photo || undefined,
        // Documents are in values.documents
      }
      
      const result = await updateStudent(student._id || student.id, payload)
      
      if (result.success) {
        toast.success("Student details updated successfully")
        router.refresh()
      } else {
        toast.error(`Failed to update student: ${result.error}`)
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Student Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Section 1: Basic Information */}
            <div className="space-y-4">
               <h3 className="text-lg font-medium">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="registrationNumber"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Registration No</FormLabel>
                            <FormControl>
                            <Input {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    
                    <FormField
                        control={form.control}
                        name="dateOfAdmission"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Date of Admission</FormLabel>
                            <FormControl>
                            <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="pen"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>PEN (Optional)</FormLabel>
                            <FormControl>
                            <Input placeholder="Permanent Education Number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Student Name</FormLabel>
                            <FormControl>
                            <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    
                    <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Gender</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select Gender" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl>
                            <Input type="date" {...field} />
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
                            <FormLabel>Student Aadhaar (Optional)</FormLabel>
                            <FormControl>
                            <Input placeholder="12-digit Aadhaar" maxLength={12} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            </div>

            {/* Section 2: Class Details */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Class Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="classId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Class</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select Class" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {classes.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="section"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Section</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select Section" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="A">A</SelectItem>
                                <SelectItem value="B">B</SelectItem>
                                <SelectItem value="C">C</SelectItem>
                                <SelectItem value="D">D</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="rollNumber"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Roll Number</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g. 01" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            </div>

            {/* Section 3: Parent Information */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Parent Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border p-4 rounded-md">
                    <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground">Father&apos;s Details</h4>
                        <FormField
                            control={form.control}
                            name="parents.father.name"
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
                            name="parents.father.aadhaarNumber"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Father&apos;s Aadhaar</FormLabel>
                                <FormControl>
                                <Input placeholder="12-digit Aadhaar" maxLength={12} {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground">Mother&apos;s Details</h4>
                        <FormField
                            control={form.control}
                            name="parents.mother.name"
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
                        <FormField
                            control={form.control}
                            name="parents.mother.aadhaarNumber"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Mother&apos;s Aadhaar</FormLabel>
                                <FormControl>
                                <Input placeholder="12-digit Aadhaar" maxLength={12} {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                </div>
            </div>

            {/* Section 4: Contact Information */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Contact Information</h3>
                <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                        <Input placeholder="123 Main St" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <FormLabel>Mobile Numbers</FormLabel>
                        {mobileFields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2">
                                <FormField
                                    control={form.control}
                                    name={`mobile.${index}.value`}
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input placeholder="1234567890" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="button" variant="outline" size="icon" onClick={() => removeMobile(index)} disabled={mobileFields.length === 1}>
                                    <Trash className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={() => appendMobile({ value: "" })}>
                            <Plus className="mr-2 h-4 w-4" /> Add Mobile
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <FormLabel>Emails (Optional)</FormLabel>
                        {emailFields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2">
                                <FormField
                                    control={form.control}
                                    name={`email.${index}.value`}
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input placeholder="email@example.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="button" variant="outline" size="icon" onClick={() => removeEmail(index)}>
                                    <Trash className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={() => appendEmail({ value: "" })}>
                            <Plus className="mr-2 h-4 w-4" /> Add Email
                        </Button>
                    </div>
                </div>
            </div>

            {/* Section 5: Previous Institution (Optional) */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Previous School Details (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField
                        control={form.control}
                        name="lastInstitution"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Last Institution Name</FormLabel>
                            <FormControl>
                            <Input placeholder="Previous School Name" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="tcNumber"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>TC Number</FormLabel>
                            <FormControl>
                            <Input placeholder="Transfer Certificate No." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            </div>

            {/* Section 6: Uploads */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Documents & Photo</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <FormLabel>Student Photo</FormLabel>
                        <FileUploader 
                            value={photo} 
                            onChange={setPhoto} 
                            label="Upload Photo" 
                        />
                    </div>

                    <div className="space-y-2 col-span-1 md:col-span-2">
                        <div className="flex items-center justify-between">
                            <FormLabel>Documents</FormLabel>
                            <Button type="button" variant="outline" size="sm" onClick={() => appendDocument({ type: "", image: "", documentNumber: "" })}>
                                <Plus className="mr-2 h-4 w-4" /> Add Document
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            {documentFields.map((field, index) => (
                                <Card key={field.id} className="p-4 relative">
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                        onClick={() => removeDocument(index)}
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
                                                        <Input placeholder="e.g. Birth Cert" {...field} />
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
                                        <FormField
                                            control={form.control}
                                            name={`documents.${index}.image`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Document Image</FormLabel>
                                                    <FormControl>
                                                        <FileUploader 
                                                        value={field.value || null} 
                                                        onChange={field.onChange} 
                                                        label=""
                                                            previewHeight={150}
                                                            previewWidth={200}
                                                            className="mt-0"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
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
              Save Changes
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
