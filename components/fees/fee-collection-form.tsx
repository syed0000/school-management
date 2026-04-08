"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useMemo, useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react"
import { collectFees, getStudentFeeDetails } from "@/actions/fee-collection"
import { useParams, useRouter } from "next/navigation"
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
import { cn, getCurrentSessionStartYear } from "@/lib/utils"
import { BackButton } from "../ui/back-button"
import { useI18n } from "@/components/i18n-provider"
import { defaultLocale, hasLocale } from "@/lib/i18n"
import { withLocale } from "@/lib/locale-path"

// Schema for a single fee item input
const feeItemInputSchema = z.object({
  feeType: z.string().min(1),
  amount: z.string(), // Input as string for easier handling
  months: z.array(z.number()).optional(),
  year: z.string(),
  examType: z.string().optional(),
  title: z.string().optional(),
  remarks: z.string().optional(),
})

// Schema for the overall form (mainly for student selection)
const formSchemaBase = z.object({
  classId: z.string().optional(),
  studentId: z.string().min(1),
  transactionDate: z.string().min(1),
  ...feeItemInputSchema.shape,
})

interface FeeCollectionFormProps {
  students: { id: string; name: string; registrationNumber: string; className: string }[]
  classes: { id: string; name: string; exams: string[] }[]
  userId: string
}

interface FeeItem {
  id: string; // Temp ID for list management
  feeType: string;
  amount: number;
  months?: number[];
  year: number;
  examType?: string;
  title?: string;
  remarks?: string;
}

export function FeeCollectionForm({ students, classes, userId }: FeeCollectionFormProps) {
  const { t } = useI18n()
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const lang = hasLocale(params.lang ?? "") ? (params.lang as string) : defaultLocale
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [feeDetails, setFeeDetails] = useState<{
    fees: { type: string; amount: number; id: string; title?: string; month?: number }[];
    exams: string[];
  } | null>(null)
  const [baseFee, setBaseFee] = useState<number>(0)

  // List of added fees
  const [feeItems, setFeeItems] = useState<FeeItem[]>([])

  const formSchema = useMemo(
    () =>
      formSchemaBase.extend({
        feeType: z.string().min(1, t("fees.validationFeeTypeRequired", "Fee type is required")),
        studentId: z.string().min(1, t("fees.validationStudentRequired", "Student is required")),
        transactionDate: z.string().min(1, t("fees.validationCollectionDateRequired", "Collection date is required")),
      }),
    [t]
  )

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      classId: "",
      studentId: "",
      feeType: "monthly",
      amount: "0",
      months: [new Date().getMonth()],
      year: getCurrentSessionStartYear().toString(),
      examType: "",
      title: "",
      remarks: "",
      transactionDate: new Date().toISOString().split('T')[0],
    },
  })

  const selectedClassId = form.watch("classId");
  const selectedStudentId = form.watch("studentId");
  const feeType = form.watch("feeType");
  const selectedMonths = form.watch("months") || [];

  const filteredStudents = selectedClassId
    ? students.filter(s => s.className === classes.find(c => c.id === selectedClassId)?.name)
    : students;

  // Fetch fee details when student changes
  useEffect(() => {
    if (selectedStudentId) {
      setFeeItems([]); // Clear added fees when student changes
      getStudentFeeDetails(selectedStudentId).then((details) => {
        if (details) {
          setFeeDetails(details);
          const hasMonthly = details.fees.some(f => f.type === 'monthly');
          if (hasMonthly) {
            form.setValue("feeType", "monthly");
          } else if (details.fees.length > 0) {
            form.setValue("feeType", details.fees[0].type);
          }
        }
      });
    }
  }, [selectedStudentId, form]);

  // Update amount when fee type changes
  useEffect(() => {
    if (!feeDetails) return;

    if (feeType === 'examination') {
      const examType = form.getValues("examType");
      if (examType) {
        const selectedExamFee = feeDetails.fees.find(f => f.type === 'examination' && f.title === examType);
        if (selectedExamFee) {
          setBaseFee(selectedExamFee.amount);
          form.setValue("amount", selectedExamFee.amount.toString());
          return;
        }
      }
    }

    const selectedFee = feeDetails.fees.find(f => f.type === feeType);

    if (selectedFee) {
      setBaseFee(selectedFee.amount);
      if (feeType === 'monthly') {
        const currentMonths = form.getValues("months") || [];
        form.setValue("amount", (selectedFee.amount * currentMonths.length).toString());
      } else if (feeType !== 'examination') {
        form.setValue("amount", selectedFee.amount.toString());
      }
    } else if (feeType === 'other') {
      setBaseFee(0);
      form.setValue("amount", "0");
    }
  }, [feeType, feeDetails, form]);

  // Watch examType
  const examType = form.watch("examType");
  useEffect(() => {
    if (feeType === 'examination' && feeDetails && examType) {
      const selectedExamFee = feeDetails.fees.find(f => f.type === 'examination' && f.title === examType);
      if (selectedExamFee) {
        setBaseFee(selectedExamFee.amount);
        form.setValue("amount", selectedExamFee.amount.toString());
      }
    }
  }, [examType, feeType, feeDetails, form]);

  const toggleMonth = (monthIndex: number) => {
    const current = form.getValues("months") || [];
    let newMonths;
    if (current.includes(monthIndex)) {
      newMonths = current.filter((m: number) => m !== monthIndex);
    } else {
      newMonths = [...current, monthIndex].sort((a: number, b: number) => a - b);
    }
    form.setValue("months", newMonths);

    if (feeType === 'monthly' && baseFee > 0) {
      const newTotal = baseFee * newMonths.length;
      form.setValue("amount", newTotal.toString());
    }
  };

  const handleAddFee = async () => {
    // Validate fields relevant to adding a fee
    const isValid = await form.trigger(["feeType", "amount", "year", "months", "examType", "title"]);
    if (!isValid) return;

    const values = form.getValues();
    const amount = Number(values.amount);

    if (amount <= 0) {
      form.setError("amount", { message: t("fees.validationAmountPositive", "Amount must be positive") });
      return;
    }

    if (values.feeType === 'monthly' && (!values.months || values.months.length === 0)) {
      form.setError("months", { message: t("fees.validationSelectMonth", "Select at least one month") });
      return;
    }

    if (values.feeType === 'other' && !values.title) {
      form.setError("title", { message: t("fees.validationOtherTitleRequired", "Title is required for Other fee") });
      return;
    }

    const newItem: FeeItem = {
      id: Math.random().toString(36).substr(2, 9),
      feeType: values.feeType,
      amount: amount,
      months: values.feeType === 'monthly' ? values.months : undefined,
      year: parseInt(values.year),
      examType: values.feeType === 'examination' ? values.examType : undefined,
      title: values.title,
      remarks: values.remarks,
    };

    setFeeItems([...feeItems, newItem]);

    // Reset fields to allow adding more
    // Keep year and student, maybe reset type to default?
    form.setValue("remarks", "");
    form.setValue("amount", "0");
    form.setValue("months", []);
    form.setValue("title", "");
    form.setValue("examType", "");

    // Reset amount logic triggers automatically via useEffect on feeType change if we change type
    // If we keep type, we might want to reset selection.
    if (values.feeType === 'monthly') {
      form.setValue("months", []);
      form.setValue("amount", "0");
    }

    toast.success(t("fees.toastItemAdded", "Fee item added"));
  };

  const handleRemoveFee = (id: string) => {
    setFeeItems(feeItems.filter(item => item.id !== id));
  };

  const calculateTotal = () => {
    return feeItems.reduce((sum, item) => sum + item.amount, 0);
  };

  async function onSubmit() {
    // If there are no items in list, try to add the current form content first?
    // Or just require items in the list.
    // UX decision: If list is empty, treat current form as the item.
    // If list has items, ignore current form unless user clicks "Add".

    const itemsToSubmit = [...feeItems];

    if (itemsToSubmit.length === 0) {
      // Try to add current form
      const isValid = await form.trigger(["studentId", "feeType", "amount", "year", "months", "examType", "title"]);
      if (!isValid) return;

      const values = form.getValues();
      if (Number(values.amount) > 0) {
        itemsToSubmit.push({
          id: "single",
          feeType: values.feeType,
          amount: Number(values.amount),
          months: values.feeType === 'monthly' ? values.months : undefined,
          year: parseInt(values.year),
          examType: values.feeType === 'examination' ? values.examType : undefined,
          title: values.title,
          remarks: values.remarks,
        });
      } else {
        toast.error(t("fees.toastAddAtLeastOne", "Please add at least one fee item with valid amount"));
        return;
      }
    }

    if (!selectedStudentId) {
      form.setError("studentId", { message: t("fees.validationStudentRequired", "Student is required") });
      return;
    }

    setIsLoading(true)
    try {
      const payload = {
        studentId: selectedStudentId,
        transactionDate: form.getValues("transactionDate"),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        fees: itemsToSubmit.map(({ id, ...rest }) => rest)
      }

      const result = await collectFees(payload, userId)
      if (result.success && 'receiptNumber' in result && typeof result.receiptNumber === 'string') {
        const demoReceipt = (result as unknown as { demoReceipt?: unknown }).demoReceipt
        if (demoReceipt) {
          try {
            sessionStorage.setItem(`demoReceipt:${result.receiptNumber}`, JSON.stringify(demoReceipt))
          } catch {
          }
        }
        toast.success(t("fees.toastCollected", "Fee collected successfully!"))
        router.push(withLocale(lang, `/fees/receipt?receiptNumber=${result?.receiptNumber}`))
      } else {
        const error = 'error' in result ? result.error : 'Failed to collect fee'
        toast.error(`${t("fees.toastFailedPrefix", "Failed:")} ${error}`)
      }
    } catch {
      toast.error(t("fees.toastSomethingWentWrong", "Something went wrong"))
    } finally {
      setIsLoading(false)
    }
  }

  const standardMonthNames = [
    t("months.jan", "January"),
    t("months.feb", "February"),
    t("months.mar", "March"),
    t("months.apr", "April"),
    t("months.may", "May"),
    t("months.jun", "June"),
    t("months.jul", "July"),
    t("months.aug", "August"),
    t("months.sep", "September"),
    t("months.oct", "October"),
    t("months.nov", "November"),
    t("months.dec", "December"),
  ];
  const displayMonthOrder = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];

  const formatFeeLabel = (type: string) => {
    switch (type) {
      case 'monthly': return t("fees.feeTypeMonthly", "Monthly Fee");
      case 'examination': return t("fees.feeTypeExam", "Examination Fee");
      case 'admission': return t("fees.feeTypeAdmission", "Admission Fee");
      case 'admissionFees': return t("fees.feeTypeAdmissionFees", "Admission Fees");
      case 'registrationFees': return t("fees.feeTypeRegistrationFees", "Registration Fees");
      default: return type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1').trim();
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <BackButton />
      <Card>
        <CardHeader>
          <CardTitle>{t("fees.collectTitle", "Collect Fee")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <div className="space-y-6">

              {/* Student Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="classId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fees.filterByClass", "Filter by Class")}</FormLabel>
                      <Select onValueChange={(val) => {
                        field.onChange(val);
                        form.setValue("studentId", "");
                      }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("fees.allClasses", "All Classes")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">{t("fees.allClasses", "All Classes")}</SelectItem>
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
                  name="studentId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col mt-2">
                      <FormLabel>{t("fees.student", "Student")}</FormLabel>
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
                                : t("fees.selectStudent", "Select Student")}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput placeholder={t("fees.searchStudent", "Search student...")} />
                            <CommandList>
                              <CommandEmpty>{t("fees.noStudentFound", "No student found.")}</CommandEmpty>
                              <CommandGroup>
                                {filteredStudents.map((student) => (
                                  <CommandItem
                                    key={student.id}
                                    value={student.name + " " + student.registrationNumber}
                                    onSelect={() => {
                                      form.setValue("studentId", student.id)
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

                <FormField
                  control={form.control}
                  name="transactionDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col mt-2">
                      <FormLabel>{t("fees.collectionDate", "Collection Date")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Add Fee Section */}
              <div className="border rounded-md p-4 bg-muted/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">{t("fees.addFeeItem", "Add Fee Item")}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="feeType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fees.feeType", "Fee Type")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("fees.selectType", "Select Type")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from(new Set((feeDetails?.fees || []).map(f => f.type))).map((type) => (
                              <SelectItem key={type} value={type}>
                                {formatFeeLabel(type)}
                              </SelectItem>
                            ))}
                            <SelectItem value="other">{t("fees.other", "Other")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fees.sessionStartYear", "Session Start Year")}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription className="text-[10px]">
                          {t("fees.sessionNote", "Academic session starts in April of this year.")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {feeType === 'monthly' && (
                  <div className="space-y-3 border p-4 rounded-md bg-background">
                    <FormLabel>{t("fees.selectMonths", "Select Months")}</FormLabel>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {displayMonthOrder.map((monthIndex) => (
                        <div key={monthIndex} className="flex items-center space-x-2">
                          <Checkbox
                            id={`month-${monthIndex}`}
                            checked={selectedMonths.includes(monthIndex)}
                            onCheckedChange={() => toggleMonth(monthIndex)}
                          />
                          <label
                            htmlFor={`month-${monthIndex}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {standardMonthNames[monthIndex]}
                          </label>
                        </div>
                      ))}
                    </div>
                    {selectedMonths.length === 0 && <p className="text-xs text-destructive">Select at least one month</p>}
                  </div>
                )}

                {feeType === 'examination' && (
                  <FormField
                    control={form.control}
                    name="examType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Exam Name</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Exam" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(() => {
                              const examFees = feeDetails?.fees.filter(f => f.type === 'examination');
                              if (examFees && examFees.length > 0) {
                                return examFees.map((fee) => (
                                  <SelectItem key={fee.id} value={fee.title || "Unknown Exam"}>
                                    {fee.title} ({fee.month})
                                  </SelectItem>
                                ));
                              }
                              if (feeDetails?.exams?.length) {
                                return feeDetails.exams.map((exam) => (
                                  <SelectItem key={exam} value={exam}>{exam}</SelectItem>
                                ));
                              }
                              return <SelectItem value="Annual">Annual (Default)</SelectItem>;
                            })()}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {feeType === 'other' && (
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title (Required for Other)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Sports Fee, Library Fee" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Amount
                          {feeType === 'monthly' && selectedMonths.length > 0 && baseFee > 0 && (
                            <span className="ml-2 text-muted-foreground font-normal">
                              (Unit: {baseFee.toLocaleString()} x {selectedMonths.length})
                            </span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="remarks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remarks (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Any notes..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="button" variant="secondary" onClick={handleAddFee} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Add Fee Type
                </Button>
              </div>

              {/* Added Fees List */}
              {feeItems.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Items to Collect</h3>
                  <div className="border rounded-md divide-y">
                    {feeItems.map((item) => (
                      <div key={item.id} className="p-3 flex justify-between items-center bg-card">
                        <div className="text-sm">
                          <div className="font-medium">
                            {formatFeeLabel(item.feeType)}
                            {item.feeType === 'monthly' && item.months && (
                              <span className="text-muted-foreground ml-1">
                                ({item.months.length} months)
                              </span>
                            )}
                            {item.feeType === 'examination' && (
                              <span className="text-muted-foreground ml-1">
                                - {item.examType}
                              </span>
                            )}
                            {item.title && (
                              <span className="text-muted-foreground ml-1">
                                - {item.title}
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Year: {item.year}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-semibold">₹{item.amount.toLocaleString()}</span>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleRemoveFee(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="p-3 bg-muted/50 flex justify-between items-center font-bold">
                      <span>Total</span>
                      <span>₹{calculateTotal().toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              <Button type="button" onClick={onSubmit} className="w-full" size="lg" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Collect Payment {feeItems.length > 0 && `(₹${calculateTotal().toLocaleString()})`}
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
