"use client"

import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRef, useState, useEffect } from "react"
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
import { Loader2, Plus, Trash, Printer } from "lucide-react"
import { registerStudent, getNextRegistrationNumber } from "@/actions/student"
import { useRouter } from "next/navigation"
import { FileUploader } from "@/components/ui/file-uploader-new"
import logger from "@/lib/logger"
import { BackButton } from "@/components/ui/back-button"
import { AdmissionPrintDocument, type AdmissionPrintDocumentData } from "@/components/students/admission-print-document"

const formSchema = z.object({
    registrationNumber: z.string().optional(),
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

    // We don't validate File objects with Zod here as we handle them separately
    // But we can keep track of metadata
    documents: z.array(z.object({
        type: z.string().min(1, "Document Type is required"),
        documentNumber: z.string().optional(),
        // image field removed from Zod schema as it's handled via state
    })).optional(),
})

interface AdmissionFormProps {
    classes: { id: string; name: string }[]
}

export function AdmissionForm({ classes }: AdmissionFormProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [documentFiles, setDocumentFiles] = useState<{ index: number, file: File | null }[]>([])
    const [nextRegNo, setNextRegNo] = useState("")
    const [regNoLoading, setRegNoLoading] = useState(false)
    const [printData, setPrintData] = useState<AdmissionPrintDocumentData | null>(null)
    const createdObjectUrlsRef = useRef<string[]>([])

    useEffect(() => {
        getNextRegistrationNumber().then(setNextRegNo);
    }, []);

    const form = useForm<z.input<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      registrationNumber: "",
      name: "",
      classId: "",
      section: "A",
      rollNumber: "",
      dateOfBirth: "",
      dateOfAdmission: new Date().toISOString().split('T')[0],
      gender: "Male",
      aadhaar: "",
      parents: {
        father: { name: "", aadhaarNumber: "" },
        mother: { name: "", aadhaarNumber: "" }
      },
      address: "",
      email: [],
      mobile: [{ value: "" }],
      pen: "",
      lastInstitution: "",
      tcNumber: "",
      documents: [],
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

    const handleDocumentFileChange = (index: number, file: File | null) => {
        setDocumentFiles(prev => {
            const filtered = prev.filter(item => item.index !== index);
            if (file) {
                return [...filtered, { index, file }];
            }
            return filtered;
        });
    };

    useEffect(() => {
        return () => {
            for (const url of createdObjectUrlsRef.current) {
                if (url.startsWith("blob:")) URL.revokeObjectURL(url)
            }
            createdObjectUrlsRef.current = []
        }
    }, [])

    useEffect(() => {
        const handleAfterPrint = () => {
            for (const url of createdObjectUrlsRef.current) {
                if (url.startsWith("blob:")) URL.revokeObjectURL(url)
            }
            createdObjectUrlsRef.current = []
            setPrintData(null)
        }

        window.addEventListener("afterprint", handleAfterPrint)
        return () => window.removeEventListener("afterprint", handleAfterPrint)
    }, [])

    const handlePrint = () => {
        for (const url of createdObjectUrlsRef.current) {
            if (url.startsWith("blob:")) URL.revokeObjectURL(url)
        }
        createdObjectUrlsRef.current = []

        const values = form.getValues()
        const className = classes.find((c) => c.id === values.classId)?.name || ""

        const photoSrc = photoFile ? URL.createObjectURL(photoFile) : undefined
        if (photoSrc) createdObjectUrlsRef.current.push(photoSrc)

        const documents = (values.documents || []).map((doc, index) => {
            const file = documentFiles.find((f) => f.index === index)?.file
            const imageSrc = file ? URL.createObjectURL(file) : undefined
            if (imageSrc) createdObjectUrlsRef.current.push(imageSrc)
            return {
                type: doc.type,
                documentNumber: doc.documentNumber,
                imageSrc,
            }
        })

        setPrintData({
            student: {
                registrationNumber: values.registrationNumber,
                name: values.name,
                className,
                section: values.section,
                rollNumber: values.rollNumber,
                dateOfBirth: values.dateOfBirth,
                dateOfAdmission: values.dateOfAdmission,
                gender: values.gender,
                aadhaar: values.aadhaar,
                pen: values.pen,
                lastInstitution: values.lastInstitution,
                tcNumber: values.tcNumber,
                address: values.address,
                mobile: values.mobile.map((m) => m.value).filter(Boolean),
                email: (values.email || []).map((e) => e.value).filter(Boolean),
                fatherName: values.parents.father.name,
                fatherAadhaar: values.parents.father.aadhaarNumber,
                motherName: values.parents.mother.name,
                motherAadhaar: values.parents.mother.aadhaarNumber,
                photoSrc,
                documents,
            },
            meta: {
                printedAtIso: new Date().toISOString(),
            },
        })

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                window.print()
            })
        })
    }

    useEffect(() => {
        if (nextRegNo && !form.getValues("registrationNumber")) {
            form.setValue("registrationNumber", nextRegNo);
        }
    }, [nextRegNo, form]);

    // Re-fetch next registration number whenever the class changes
    const watchedClassId = form.watch("classId")
    useEffect(() => {
        if (!watchedClassId) return;
        setRegNoLoading(true)
        getNextRegistrationNumber(watchedClassId).then((reg) => {
            setNextRegNo(reg)
            form.setValue("registrationNumber", reg)
            setRegNoLoading(false)
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedClassId]);

    async function onSubmit(values: z.input<typeof formSchema>) {
        setIsLoading(true)
        try {
            // Create FormData
            const formData = new FormData();

            // Append basic fields
            formData.append('name', values.name);
            formData.append('classId', values.classId);
            formData.append('section', values.section || "A");
            if (values.registrationNumber) formData.append('registrationNumber', values.registrationNumber);
            if (values.rollNumber) formData.append('rollNumber', values.rollNumber);
            formData.append('dateOfBirth', values.dateOfBirth);
            if (values.dateOfAdmission) formData.append('dateOfAdmission', values.dateOfAdmission);
            if (values.gender) formData.append('gender', values.gender);
            if (values.aadhaar) formData.append('aadhaar', values.aadhaar);
            formData.append('address', values.address);

            // Parents
            if (values.parents.father.name) formData.append('fatherName', values.parents.father.name);
            if (values.parents.father.aadhaarNumber) formData.append('fatherAadhaar', values.parents.father.aadhaarNumber);
            if (values.parents.mother.name) formData.append('motherName', values.parents.mother.name);
            if (values.parents.mother.aadhaarNumber) formData.append('motherAadhaar', values.parents.mother.aadhaarNumber);

            // Optional fields
            if (values.pen) formData.append('pen', values.pen);
            if (values.lastInstitution) formData.append('lastInstitution', values.lastInstitution);
            if (values.tcNumber) formData.append('tcNumber', values.tcNumber);

            // Arrays
            values.mobile.forEach(m => formData.append('mobile', m.value));
            values.email?.forEach(e => formData.append('email', e.value));

            // Files
            if (photoFile) {
                formData.append('photo', photoFile);
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

            const result = await registerStudent(formData)

            if (result.success) {
                toast.success(`Student admitted successfully! Reg No: ${result.regNo}`)
                form.reset();
                setPhotoFile(null);
                setDocumentFiles([]);
                getNextRegistrationNumber().then(setNextRegNo);
                router.refresh()
            } else {
                toast.error(`Failed to admit student: ${result.error}`)
            }
        } catch (error) {
            logger.error(error)
            toast.error("Something went wrong")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="w-full max-w-4xl mx-auto">
            <BackButton />
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Student Admission Form</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                            {/* Section 1: Basic Information */}
                            <div className="space-y-4">
                                {/* ... (Basic Info Fields - same as before) ... */}
                                <h3 className="text-lg font-medium">Basic Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="registrationNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Registration No (Auto)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input placeholder={nextRegNo} {...field} />
                                                        {regNoLoading && (
                                                            <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                                                        )}
                                                    </div>
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
                                <h3 className="text-lg font-medium">Previous Institute Details (Optional)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="lastInstitution"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Last Institution Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Previous Institute Name" {...field} />
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
                                            onFileSelect={setPhotoFile}
                                            label="Upload Photo"
                                        />
                                    </div>

                                    <div className="space-y-2 col-span-1 md:col-span-2">
                                        <div className="flex items-center justify-between">
                                            <FormLabel>Documents</FormLabel>
                                            <Button type="button" variant="outline" size="sm" onClick={() => appendDocument({ type: "", documentNumber: "" })}>
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
                                                        onClick={() => {
                                                            removeDocument(index);
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
                                                        <div className="space-y-2">
                                                            <FormLabel className="text-xs">Document Image</FormLabel>
                                                            <FileUploader
                                                                onFileSelect={(file) => handleDocumentFileChange(index, file)}
                                                                label=""
                                                                className="mt-0"
                                                            />
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 print:hidden">
                                <Button type="button" variant="secondary" onClick={handlePrint} disabled={isLoading}>
                                    <Printer className="mr-2 h-4 w-4" />
                                    Print Admission Form
                                </Button>

                                <Button type="submit" className="sm:ml-auto" disabled={isLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Submit Admission
                                </Button>
                            </div>
                        </form>
                    </Form>

                    <div className="hidden print:block admission-print">
                        {printData ? (
                            <div className="p-0">
                                <AdmissionPrintDocument data={printData} />
                            </div>
                        ) : null}
                    </div>

                    <style jsx global>{`
                      @media print {
                        body * {
                          visibility: hidden;
                        }
                        .admission-print, .admission-print * {
                          visibility: visible;
                        }
                        .admission-print {
                          position: absolute;
                          left: 0;
                          top: 0;
                          width: 100%;
                        }
                        @page {
                          size: A4;
                          margin: 12mm;
                        }
                        html, body {
                          background: #fff !important;
                          -webkit-print-color-adjust: exact;
                          print-color-adjust: exact;
                        }
                      }
                    `}</style>
                </CardContent>
            </Card>
        </div>
    )
}
