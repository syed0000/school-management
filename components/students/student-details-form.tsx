"use client"

import { useForm, useFieldArray, Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useMemo, useState } from "react"
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
import { Loader2, Plus, Trash, Save, Printer } from "lucide-react"
import { updateStudent } from "@/actions/student"
import { useParams, useRouter } from "next/navigation"
import { FileUploader } from "@/components/ui/file-uploader"
import { AdmissionPrintDocument, type AdmissionPrintDocumentData } from "@/components/students/admission-print-document"
import { defaultLocale, hasLocale } from "@/lib/i18n"

type Copy = {
  toast: {
    updated: string
    updateFailedPrefix: string
    somethingWentWrong: string
  }
  validation: {
    registrationRequired: string
    nameRequired: string
    classRequired: string
    dobRequired: string
    aadhaarDigits: string
    addressRequired: string
    invalidEmail: string
    mobileValidRequired: string
    mobileAtLeastOne: string
    docTypeRequired: string
    docImageRequired: string
  }
  title: string
  sections: {
    basic: string
    classDetails: string
    parents: string
    contact: string
    previous: string
    uploads: string
  }
  fields: Record<string, string>
  actions: {
    printAdmission: string
    save: string
  }
}

const copy: Record<"en" | "hi" | "ur", Copy> = {
  en: {
    toast: {
      updated: "Student details updated successfully",
      updateFailedPrefix: "Failed to update student:",
      somethingWentWrong: "Something went wrong",
    },
    validation: {
      registrationRequired: "Registration Number is required",
      nameRequired: "Name is required",
      classRequired: "Class is required",
      dobRequired: "Date of Birth is required",
      aadhaarDigits: "Aadhaar number must be 12 digits",
      addressRequired: "Address is required",
      invalidEmail: "Invalid email",
      mobileValidRequired: "Valid mobile number is required",
      mobileAtLeastOne: "At least one mobile number is required",
      docTypeRequired: "Document Type is required",
      docImageRequired: "Document Image is required",
    },
    title: "Edit Student Details",
    sections: {
      basic: "Basic Information",
      classDetails: "Class Details",
      parents: "Parent Information",
      contact: "Contact Information",
      previous: "Previous Institute Details (Optional)",
      uploads: "Documents & Photo",
    },
    fields: {
      registrationNo: "Registration No",
      admissionDate: "Date of Admission",
      penOptional: "PEN (Optional)",
      penPlaceholder: "Permanent Education Number",
      studentName: "Student Name",
      namePlaceholder: "John Doe",
      gender: "Gender",
      selectGender: "Select Gender",
      male: "Male",
      female: "Female",
      other: "Other",
      dob: "Date of Birth",
      studentAadhaarOptional: "Student Aadhaar (Optional)",
      aadhaarPlaceholder: "12-digit Aadhaar",
      class: "Class",
      selectClass: "Select Class",
      section: "Section",
      selectSection: "Select Section",
      rollNumber: "Roll Number",
      rollPlaceholder: "e.g. 01",
      fatherDetails: "Father's Details",
      fatherName: "Father's Name",
      fatherNamePlaceholder: "Father Name",
      fatherAadhaar: "Father's Aadhaar",
      motherDetails: "Mother's Details",
      motherName: "Mother's Name",
      motherNamePlaceholder: "Mother Name",
      motherAadhaar: "Mother's Aadhaar",
      address: "Address",
      addressPlaceholder: "123 Main St",
      mobileNumbers: "Mobile Numbers",
      mobilePlaceholder: "1234567890",
      addMobile: "Add Mobile",
      emailsOptional: "Emails (Optional)",
      emailPlaceholder: "email@example.com",
      addEmail: "Add Email",
      previousInstituteName: "Last Institution Name",
      previousInstitutePlaceholder: "Previous Institute Name",
      tcNumber: "TC Number",
      tcPlaceholder: "Transfer Certificate No.",
      studentPhoto: "Student Photo",
      uploadPhoto: "Upload Photo",
      documents: "Documents",
      addDocument: "Add Document",
      documentType: "Document Type",
      documentTypePlaceholder: "e.g. Birth Cert",
      documentNumberOptional: "Document Number (Optional)",
      documentNumberPlaceholder: "Doc No.",
      documentImage: "Document Image",
    },
    actions: {
      printAdmission: "Print Admission Form",
      save: "Save Changes",
    },
  },
  hi: {
    toast: {
      updated: "छात्र विवरण सफलतापूर्वक अपडेट हुआ",
      updateFailedPrefix: "छात्र अपडेट करने में असफल:",
      somethingWentWrong: "कुछ गलत हो गया",
    },
    validation: {
      registrationRequired: "रजिस्ट्रेशन नंबर आवश्यक है",
      nameRequired: "नाम आवश्यक है",
      classRequired: "कक्षा आवश्यक है",
      dobRequired: "जन्म तिथि आवश्यक है",
      aadhaarDigits: "आधार नंबर 12 अंकों का होना चाहिए",
      addressRequired: "पता आवश्यक है",
      invalidEmail: "अमान्य ईमेल",
      mobileValidRequired: "मान्य मोबाइल नंबर आवश्यक है",
      mobileAtLeastOne: "कम से कम एक मोबाइल नंबर आवश्यक है",
      docTypeRequired: "दस्तावेज़ प्रकार आवश्यक है",
      docImageRequired: "दस्तावेज़ इमेज आवश्यक है",
    },
    title: "छात्र विवरण संपादित करें",
    sections: {
      basic: "मूल जानकारी",
      classDetails: "कक्षा विवरण",
      parents: "अभिभावक जानकारी",
      contact: "संपर्क जानकारी",
      previous: "पिछले संस्थान का विवरण (वैकल्पिक)",
      uploads: "दस्तावेज़ और फोटो",
    },
    fields: {
      registrationNo: "रजिस्ट्रेशन नंबर",
      admissionDate: "प्रवेश तिथि",
      penOptional: "PEN (वैकल्पिक)",
      penPlaceholder: "स्थायी शिक्षा नंबर",
      studentName: "छात्र का नाम",
      namePlaceholder: "जैसे: John Doe",
      gender: "लिंग",
      selectGender: "लिंग चुनें",
      male: "पुरुष",
      female: "महिला",
      other: "अन्य",
      dob: "जन्म तिथि",
      studentAadhaarOptional: "छात्र आधार (वैकल्पिक)",
      aadhaarPlaceholder: "12-अंकों का आधार",
      class: "कक्षा",
      selectClass: "कक्षा चुनें",
      section: "सेक्शन",
      selectSection: "सेक्शन चुनें",
      rollNumber: "रोल नंबर",
      rollPlaceholder: "जैसे: 01",
      fatherDetails: "पिता का विवरण",
      fatherName: "पिता का नाम",
      fatherNamePlaceholder: "पिता का नाम",
      fatherAadhaar: "पिता का आधार",
      motherDetails: "माता का विवरण",
      motherName: "माता का नाम",
      motherNamePlaceholder: "माता का नाम",
      motherAadhaar: "माता का आधार",
      address: "पता",
      addressPlaceholder: "जैसे: 123 Main St",
      mobileNumbers: "मोबाइल नंबर",
      mobilePlaceholder: "1234567890",
      addMobile: "मोबाइल जोड़ें",
      emailsOptional: "ईमेल (वैकल्पिक)",
      emailPlaceholder: "email@example.com",
      addEmail: "ईमेल जोड़ें",
      previousInstituteName: "पिछले संस्थान का नाम",
      previousInstitutePlaceholder: "पिछले संस्थान का नाम",
      tcNumber: "TC नंबर",
      tcPlaceholder: "ट्रांसफर सर्टिफिकेट नंबर",
      studentPhoto: "छात्र फोटो",
      uploadPhoto: "फोटो अपलोड करें",
      documents: "दस्तावेज़",
      addDocument: "दस्तावेज़ जोड़ें",
      documentType: "दस्तावेज़ प्रकार",
      documentTypePlaceholder: "जैसे: जन्म प्रमाणपत्र",
      documentNumberOptional: "दस्तावेज़ नंबर (वैकल्पिक)",
      documentNumberPlaceholder: "Doc No.",
      documentImage: "दस्तावेज़ इमेज",
    },
    actions: {
      printAdmission: "प्रवेश फॉर्म प्रिंट करें",
      save: "परिवर्तन सहेजें",
    },
  },
  ur: {
    toast: {
      updated: "طالب علم کی تفصیلات کامیابی سے اپڈیٹ ہوگئیں",
      updateFailedPrefix: "طالب علم اپڈیٹ کرنے میں ناکامی:",
      somethingWentWrong: "کچھ غلط ہوگیا",
    },
    validation: {
      registrationRequired: "رجسٹریشن نمبر ضروری ہے",
      nameRequired: "نام ضروری ہے",
      classRequired: "کلاس ضروری ہے",
      dobRequired: "تاریخِ پیدائش ضروری ہے",
      aadhaarDigits: "آدھار نمبر 12 ہندسوں کا ہونا چاہیے",
      addressRequired: "پتہ ضروری ہے",
      invalidEmail: "غلط ای میل",
      mobileValidRequired: "درست موبائل نمبر ضروری ہے",
      mobileAtLeastOne: "کم از کم ایک موبائل نمبر ضروری ہے",
      docTypeRequired: "دستاویز کی قسم ضروری ہے",
      docImageRequired: "دستاویز کی تصویر ضروری ہے",
    },
    title: "طالب علم کی تفصیلات میں ترمیم کریں",
    sections: {
      basic: "بنیادی معلومات",
      classDetails: "کلاس کی تفصیلات",
      parents: "والدین کی معلومات",
      contact: "رابطہ معلومات",
      previous: "پچھلے ادارے کی تفصیلات (اختیاری)",
      uploads: "دستاویزات اور تصویر",
    },
    fields: {
      registrationNo: "رجسٹریشن نمبر",
      admissionDate: "داخلہ کی تاریخ",
      penOptional: "PEN (اختیاری)",
      penPlaceholder: "مستقل تعلیمی نمبر",
      studentName: "طالب علم کا نام",
      namePlaceholder: "مثلاً: John Doe",
      gender: "جنس",
      selectGender: "جنس منتخب کریں",
      male: "مرد",
      female: "عورت",
      other: "دیگر",
      dob: "تاریخِ پیدائش",
      studentAadhaarOptional: "طالب علم آدھار (اختیاری)",
      aadhaarPlaceholder: "12 ہندسوں کا آدھار",
      class: "کلاس",
      selectClass: "کلاس منتخب کریں",
      section: "سیکشن",
      selectSection: "سیکشن منتخب کریں",
      rollNumber: "رول نمبر",
      rollPlaceholder: "مثلاً: 01",
      fatherDetails: "والد کی تفصیلات",
      fatherName: "والد کا نام",
      fatherNamePlaceholder: "والد کا نام",
      fatherAadhaar: "والد کا آدھار",
      motherDetails: "والدہ کی تفصیلات",
      motherName: "والدہ کا نام",
      motherNamePlaceholder: "والدہ کا نام",
      motherAadhaar: "والدہ کا آدھار",
      address: "پتہ",
      addressPlaceholder: "مثلاً: 123 Main St",
      mobileNumbers: "موبائل نمبرز",
      mobilePlaceholder: "1234567890",
      addMobile: "موبائل شامل کریں",
      emailsOptional: "ای میلز (اختیاری)",
      emailPlaceholder: "email@example.com",
      addEmail: "ای میل شامل کریں",
      previousInstituteName: "پچھلے ادارے کا نام",
      previousInstitutePlaceholder: "پچھلے ادارے کا نام",
      tcNumber: "TC نمبر",
      tcPlaceholder: "ٹرانسفر سرٹیفکیٹ نمبر",
      studentPhoto: "طالب علم کی تصویر",
      uploadPhoto: "تصویر اپلوڈ کریں",
      documents: "دستاویزات",
      addDocument: "دستاویز شامل کریں",
      documentType: "دستاویز کی قسم",
      documentTypePlaceholder: "مثلاً: برتھ سرٹیفکیٹ",
      documentNumberOptional: "دستاویز نمبر (اختیاری)",
      documentNumberPlaceholder: "Doc No.",
      documentImage: "دستاویز کی تصویر",
    },
    actions: {
      printAdmission: "داخلہ فارم پرنٹ کریں",
      save: "تبدیلیاں محفوظ کریں",
    },
  },
}

type CopyLocale = keyof typeof copy

const createSchema = (c: Copy) =>
  z.object({
    registrationNumber: z.string().min(1, c.validation.registrationRequired),
    name: z.string().min(1, c.validation.nameRequired),
    classId: z.string().min(1, c.validation.classRequired),
    section: z.enum(["A", "B", "C", "D"]).default("A"),
    rollNumber: z.string().optional(),
    dateOfBirth: z.string().min(1, c.validation.dobRequired),
    dateOfAdmission: z.string().optional(),
    gender: z.enum(["Male", "Female", "Other"]).optional(),
    aadhaar: z.string().regex(/^\d{12}$/, c.validation.aadhaarDigits).optional().or(z.literal("")),
    parents: z.object({
      father: z.object({
        name: z.string().optional(),
        aadhaarNumber: z.string().regex(/^\d{12}$/, c.validation.aadhaarDigits).optional().or(z.literal("")),
      }),
      mother: z.object({
        name: z.string().optional(),
        aadhaarNumber: z.string().regex(/^\d{12}$/, c.validation.aadhaarDigits).optional().or(z.literal("")),
      }),
    }),
    address: z.string().min(1, c.validation.addressRequired),
    email: z.array(z.object({ value: z.string().email(c.validation.invalidEmail) })).optional(),
    mobile: z
      .array(z.object({ value: z.string().min(10, c.validation.mobileValidRequired) }))
      .min(1, c.validation.mobileAtLeastOne),
    pen: z.string().optional(),
    lastInstitution: z.string().optional(),
    tcNumber: z.string().optional(),
    documents: z
      .array(
        z.object({
          type: z.string().min(1, c.validation.docTypeRequired),
          image: z.string().min(1, c.validation.docImageRequired),
          documentNumber: z.string().optional(),
        })
      )
      .optional(),
  })

type FormValues = z.infer<ReturnType<typeof createSchema>>

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
  const params = useParams<{ lang?: string }>()
  const lang = hasLocale(params.lang ?? "") ? (params.lang as CopyLocale) : defaultLocale
  const c = copy[lang] ?? copy.en
  const schema = useMemo(() => createSchema(c), [c])
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [photo, setPhoto] = useState<string | null>(student.photo || null)
  const [printData, setPrintData] = useState<AdmissionPrintDocumentData | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
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

  async function onSubmit(values: FormValues) {
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
        toast.success(c.toast.updated)
        router.refresh()
      } else {
        toast.error(`${c.toast.updateFailedPrefix} ${result.error}`)
      }
    } catch {
      toast.error(c.toast.somethingWentWrong)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = () => {
    const values = form.getValues()
    const className = classes.find((c) => c.id === values.classId)?.name || student.className || ""

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
        photoSrc: photo || undefined,
        documents: (values.documents || []).map((d) => ({
          type: d.type,
          documentNumber: d.documentNumber,
          imageSrc: d.image,
        })),
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{c.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Section 1: Basic Information */}
            <div className="space-y-4">
               <h3 className="text-lg font-medium">{c.sections.basic}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="registrationNumber"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>{c.fields.registrationNo}</FormLabel>
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
                            <FormLabel>{c.fields.admissionDate}</FormLabel>
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
                            <FormLabel>{c.fields.penOptional}</FormLabel>
                            <FormControl>
                            <Input placeholder={c.fields.penPlaceholder} {...field} />
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
                            <FormLabel>{c.fields.studentName}</FormLabel>
                            <FormControl>
                            <Input placeholder={c.fields.namePlaceholder} {...field} />
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
                            <FormLabel>{c.fields.gender}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder={c.fields.selectGender} />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Male">{c.fields.male}</SelectItem>
                                <SelectItem value="Female">{c.fields.female}</SelectItem>
                                <SelectItem value="Other">{c.fields.other}</SelectItem>
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
                            <FormLabel>{c.fields.dob}</FormLabel>
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
                            <FormLabel>{c.fields.studentAadhaarOptional}</FormLabel>
                            <FormControl>
                            <Input placeholder={c.fields.aadhaarPlaceholder} maxLength={12} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            </div>

            {/* Section 2: Class Details */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium">{c.sections.classDetails}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="classId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>{c.fields.class}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder={c.fields.selectClass} />
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
                            <FormLabel>{c.fields.section}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder={c.fields.selectSection} />
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
                            <FormLabel>{c.fields.rollNumber}</FormLabel>
                            <FormControl>
                            <Input placeholder={c.fields.rollPlaceholder} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            </div>

            {/* Section 3: Parent Information */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium">{c.sections.parents}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border p-4 rounded-md">
                    <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground">{c.fields.fatherDetails}</h4>
                        <FormField
                            control={form.control}
                            name="parents.father.name"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>{c.fields.fatherName}</FormLabel>
                                <FormControl>
                                <Input placeholder={c.fields.fatherNamePlaceholder} {...field} />
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
                                <FormLabel>{c.fields.fatherAadhaar}</FormLabel>
                                <FormControl>
                                <Input placeholder={c.fields.aadhaarPlaceholder} maxLength={12} {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground">{c.fields.motherDetails}</h4>
                        <FormField
                            control={form.control}
                            name="parents.mother.name"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>{c.fields.motherName}</FormLabel>
                                <FormControl>
                                <Input placeholder={c.fields.motherNamePlaceholder} {...field} />
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
                                <FormLabel>{c.fields.motherAadhaar}</FormLabel>
                                <FormControl>
                                <Input placeholder={c.fields.aadhaarPlaceholder} maxLength={12} {...field} />
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
                <h3 className="text-lg font-medium">{c.sections.contact}</h3>
                <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>{c.fields.address}</FormLabel>
                        <FormControl>
                        <Input placeholder={c.fields.addressPlaceholder} {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <FormLabel>{c.fields.mobileNumbers}</FormLabel>
                        {mobileFields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2">
                                <FormField
                                    control={form.control}
                                    name={`mobile.${index}.value`}
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input placeholder={c.fields.mobilePlaceholder} {...field} />
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
                            <Plus className="mr-2 h-4 w-4" /> {c.fields.addMobile}
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <FormLabel>{c.fields.emailsOptional}</FormLabel>
                        {emailFields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2">
                                <FormField
                                    control={form.control}
                                    name={`email.${index}.value`}
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input placeholder={c.fields.emailPlaceholder} {...field} />
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
                            <Plus className="mr-2 h-4 w-4" /> {c.fields.addEmail}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Section 5: Previous Institution (Optional) */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium">{c.sections.previous}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField
                        control={form.control}
                        name="lastInstitution"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>{c.fields.previousInstituteName}</FormLabel>
                            <FormControl>
                            <Input placeholder={c.fields.previousInstitutePlaceholder} {...field} />
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
                            <FormLabel>{c.fields.tcNumber}</FormLabel>
                            <FormControl>
                            <Input placeholder={c.fields.tcPlaceholder} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            </div>

            {/* Section 6: Uploads */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium">{c.sections.uploads}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <FormLabel>{c.fields.studentPhoto}</FormLabel>
                        <FileUploader 
                            value={photo} 
                            onChange={setPhoto} 
                            label={c.fields.uploadPhoto} 
                        />
                    </div>

                    <div className="space-y-2 col-span-1 md:col-span-2">
                        <div className="flex items-center justify-between">
                            <FormLabel>{c.fields.documents}</FormLabel>
                            <Button type="button" variant="outline" size="sm" onClick={() => appendDocument({ type: "", image: "", documentNumber: "" })}>
                                <Plus className="mr-2 h-4 w-4" /> {c.fields.addDocument}
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
                                                    <FormLabel className="text-xs">{c.fields.documentType}</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder={c.fields.documentTypePlaceholder} {...field} />
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
                                                    <FormLabel className="text-xs">{c.fields.documentNumberOptional}</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder={c.fields.documentNumberPlaceholder} {...field} />
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
                                                    <FormLabel className="text-xs">{c.fields.documentImage}</FormLabel>
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

            <div className="flex flex-col sm:flex-row gap-3 print:hidden">
              <Button type="button" variant="secondary" onClick={handlePrint} disabled={isLoading}>
                <Printer className="mr-2 h-4 w-4" />
                {c.actions.printAdmission}
              </Button>
              <Button type="submit" className="sm:ml-auto" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {c.actions.save}
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
  )
}
