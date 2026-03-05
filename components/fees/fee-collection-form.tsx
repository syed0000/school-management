"use client"

import { useForm } from "react-hook-form"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Check, ChevronsUpDown } from "lucide-react"
import { collectFee, getStudentFeeDetails } from "@/actions/fee-collection"
import { useRouter } from "next/navigation"
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
import { BackButton } from "../ui/back-button"

const formSchema = z.object({
  classId: z.string().optional(),
  studentId: z.string().min(1, "Student is required"),
  feeType: z.string().min(1, "Fee type is required"),
  amount: z.string(),
  months: z.array(z.number()).optional(),
  year: z.string(),
  examType: z.string().optional(),
  title: z.string().optional(),
  remarks: z.string().optional(),
})

interface FeeCollectionFormProps {
  students: { id: string; name: string; registrationNumber: string; className: string }[]
  classes: { id: string; name: string; exams: string[] }[]
  userId: string
}

export function FeeCollectionForm({ students, classes, userId }: FeeCollectionFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [feeDetails, setFeeDetails] = useState<{
    fees: { type: string; amount: number; id: string; title?: string; month?: string }[];
    exams: string[];
  } | null>(null)
  const [baseFee, setBaseFee] = useState<number>(0)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      classId: "",
      studentId: "",
      feeType: "monthly",
      amount: "0",
      months: [new Date().getMonth()], // Defaults to current month index (0=Jan, 2=March)
      year: new Date().getFullYear().toString(),
      examType: "",
      title: "",
      remarks: "",
    },
  })

  const selectedClassId = form.watch("classId");
  const selectedStudentId = form.watch("studentId");
  const feeType = form.watch("feeType");
  const selectedMonths = form.watch("months") || [];

  const filteredStudents = selectedClassId
    ? students.filter(s => s.className === classes.find(c => c.id === selectedClassId)?.name)
    : students;

  useEffect(() => {
    if (selectedStudentId) {
      getStudentFeeDetails(selectedStudentId).then((details) => {
        if (details) {
          setFeeDetails(details);
          // Default to monthly if available, else first type
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

    // Special handling for examination fees to select specific exam
    if (feeType === 'examination') {
       // Reset or keep default? 
       // We might want to clear amount until specific exam is selected in UI, 
       // but for now, let's just handle it via the examType selection if we change that logic.
       // Or better: In this form, 'feeType' is just 'examination'. 
       // We need to match the specific exam selected in 'examType' field.
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
  }, [feeType, feeDetails, form]); // Added dependency on examType change would be needed if we want real-time update

  // Watch examType to update amount for examination fees
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


  async function onSubmit(values: z.input<typeof formSchema>) {
    setIsLoading(true)
    try {
      let unitAmount = Number(values.amount);
      if (values.feeType === 'monthly' && values.months && values.months.length > 0) {
        unitAmount = unitAmount / values.months.length;
      }

      const payload = {
        studentId: values.studentId,
        feeType: values.feeType,
        amount: unitAmount,
        months: values.feeType === 'monthly' ? values.months : undefined,
        year: parseInt(values.year),
        examType: values.feeType === 'examination' ? values.examType : undefined,
        title: values.title,
        remarks: values.remarks,
      }

      const result = await collectFee(payload, userId)
      if (result.success && result.receiptData) {
        toast.success(`Fee collected successfully!`)

        const params = new URLSearchParams({
          receiptNumber: result.receiptNumber,
          studentName: result.receiptData.studentName,
          studentRegNo: result.receiptData.studentRegNo,
          className: result.receiptData.className,
          feeType: result.receiptData.feeType,
          year: result.receiptData.year.toString(),
          amount: result.receiptData.amount.toString(),
        })

        if (result.receiptData.months) {
          params.append('months', result.receiptData.months.join(','))
        }
        if (result.receiptData.examType) {
          params.append('examType', result.receiptData.examType)
        }
        if (result.receiptData.title) {
          params.append('title', result.receiptData.title)
        }

        router.push(`/fees/receipt?${params.toString()}`)
      } else {
        toast.error(`Failed: ${result.error}`)
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

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

  const standardMonthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  // Display order: April (3) to March (2)
  const displayMonthOrder = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];

  // Helper to format fee type label
  const formatFeeLabel = (type: string) => {
    switch (type) {
      case 'monthly': return 'Monthly Fee';
      case 'examination': return 'Examination Fee';
      case 'admission': return 'Admission Fee';
      case 'admissionFees': return 'Admission Fees';
      case 'registrationFees': return 'Registration Fees';
      default: return type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1').trim();
    }
  }

  return (
    <>
      <div className="max-w-3xl mx-auto p-4">
        <BackButton />
        <Card>
          <CardHeader>
            <CardTitle>Collect Fee</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="classId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Filter by Class</FormLabel>
                        <Select onValueChange={(val) => {
                          field.onChange(val);
                          form.setValue("studentId", "");
                        }} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="All Classes" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">All Classes</SelectItem>
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
                        <FormLabel>Student</FormLabel>
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="feeType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fee Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from(new Set((feeDetails?.fees || []).map(f => f.type))).map((type) => (
                              <SelectItem key={type} value={type}>
                                {formatFeeLabel(type)}
                              </SelectItem>
                            ))}
                            <SelectItem value="other">Other</SelectItem>
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
                        <FormLabel>Year</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {feeType === 'monthly' && (
                  <div className="space-y-3 border p-4 rounded-md">
                    <FormLabel>Select Months</FormLabel>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Exam" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {/* Filter exams from fees instead of class default list if fees exist */}
                            {(() => {
                                const examFees = feeDetails?.fees.filter(f => f.type === 'examination');
                                if (examFees && examFees.length > 0) {
                                    return examFees.map((fee) => (
                                        <SelectItem key={fee.id} value={fee.title || "Unknown Exam"}>
                                            {fee.title} ({fee.month})
                                        </SelectItem>
                                    ));
                                }
                                // Fallback to class exam list if no fees configured (though amount won't be auto-filled correctly)
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

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Total Amount
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

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Collect Payment
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
