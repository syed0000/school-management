"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Edit } from "lucide-react"
import { FileUploader } from "@/components/ui/file-uploader-new"
import { createExpense, updateExpense } from "@/actions/expense"

// Schema needs to match server-side validation
const formSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  amount: z.string(),
  expenseDate: z.string(),
  category: z.enum(['Salary', 'Maintenance', 'Supplies', 'Utilities', 'Others']),
  teacherId: z.string().optional(),
  salaryMonth: z.string().optional(), 
  salaryYear: z.string().optional(),
  // receipt removed from Zod as it is handled via state
}).refine((data) => {
  if (data.category !== 'Salary' && !data.title) {
    return false;
  }
  return true;
}, {
  message: "Title is required for non-salary expenses",
  path: ["title"],
});

interface ExpenseData {
  id: string
  title: string
  description?: string
  amount: number
  expenseDate: string
  category: string
  teacherId?: { _id: string; name: string } | null
  salaryMonth?: number
  salaryYear?: number
  receipt?: string
  createdBy?: { _id: string; name: string } | null
}

interface ExpenseDialogProps {
  mode?: "create" | "edit"
  expense?: ExpenseData
  teachers: { id: string; name: string; salary?: { amount: number } }[]
}

export function ExpenseDialog({ mode = "create", expense, teachers }: ExpenseDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Local state for file
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  const defaultValues = {
    title: expense?.title || "",
    description: expense?.description || "",
    amount: expense?.amount?.toString() || "0",
    expenseDate: expense?.expenseDate ? new Date(expense.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    category: (expense?.category as "Salary" | "Maintenance" | "Supplies" | "Utilities" | "Others") || "Others",
    teacherId: expense?.teacherId?._id || "",
    salaryMonth: expense?.salaryMonth?.toString() || new Date().getMonth() + 1 + "",
    salaryYear: expense?.salaryYear?.toString() || new Date().getFullYear().toString(),
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  const category = form.watch("category")
  const selectedTeacherId = form.watch("teacherId")
  const selectedMonth = form.watch("salaryMonth")
  const selectedYear = form.watch("salaryYear")

  // Auto-fill amount when teacher is selected for Salary
  useEffect(() => {
    if (category === 'Salary' && selectedTeacherId && mode === 'create') {
      const teacher = teachers.find(t => t.id === selectedTeacherId)
      if (teacher?.salary?.amount) {
        form.setValue("amount", teacher.salary.amount.toString())
      }
    }
  }, [category, selectedTeacherId, teachers, form, mode])

  // Auto-generate title for Salary
  useEffect(() => {
    if (category === 'Salary' && selectedTeacherId && selectedMonth && selectedYear) {
       const teacher = teachers.find(t => t.id === selectedTeacherId)
       if (teacher) {
           const date = new Date();
           date.setMonth(parseInt(selectedMonth) - 1);
           const monthName = date.toLocaleString('default', { month: 'long' });
           const autoTitle = `Salary for ${teacher.name} - ${monthName} ${selectedYear}`;
           // Only set if user hasn't manually edited it significantly or it's empty
           const currentTitle = form.getValues("title");
           if (!currentTitle || currentTitle.startsWith("Salary for")) {
               form.setValue("title", autoTitle);
           }
       }
    }
  }, [category, selectedTeacherId, selectedMonth, selectedYear, teachers, form])


  async function onSubmit(values: z.input<typeof formSchema>) {
    setIsLoading(true)
    try {
      const formData = new FormData();
      
      if (values.title) formData.append('title', values.title);
      if (values.description) formData.append('description', values.description);
      formData.append('amount', values.amount);
      formData.append('expenseDate', values.expenseDate);
      formData.append('category', values.category);
      
      if (values.teacherId) formData.append('teacherId', values.teacherId);
      if (values.salaryMonth) formData.append('salaryMonth', values.salaryMonth);
      if (values.salaryYear) formData.append('salaryYear', values.salaryYear);
      
      if (receiptFile) {
          formData.append('receipt', receiptFile);
      }

      let result
      if (mode === "create") {
        result = await createExpense(formData)
      } else if (expense) {
        result = await updateExpense(expense.id, formData)
      } else {
        return
      }

      if (result.success) {
        toast.success(mode === "create" ? "Expense created successfully" : "Expense updated successfully")
        setOpen(false)
        form.reset(defaultValues)
        setReceiptFile(null)
      } else {
        toast.error(result.error || "Operation failed")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add New Expense" : "Edit Expense"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Record a new expense or salary payment." : "Update existing expense details."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Others">Others</SelectItem>
                        <SelectItem value="Salary">Salary</SelectItem>
                        <SelectItem value="Maintenance">Maintenance</SelectItem>
                        <SelectItem value="Supplies">Supplies</SelectItem>
                        <SelectItem value="Utilities">Utilities</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expenseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {category === 'Salary' && (
              <div className="space-y-4 border p-4 rounded-md bg-muted/20">
                <FormField
                  control={form.control}
                  name="teacherId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teacher</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Teacher" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {teachers.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="salaryMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salary Month</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Month" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => (
                              <SelectItem key={i + 1} value={(i + 1).toString()}>
                                {new Date(0, i).toLocaleString('default', { month: 'long' })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="salaryYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salary Year</FormLabel>
                        <FormControl>
                           <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title {category === 'Salary' && <span className="text-muted-foreground font-normal">(Auto-generated)</span>}</FormLabel>
                  <FormControl>
                    <Input placeholder="Expense Title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormDescription>
                    {category === 'Salary' ? "Auto-fetched from teacher profile (editable)" : "Enter expense amount"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Details about the expense..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
                <FormLabel>Receipt / Invoice</FormLabel>
                <FileUploader 
                    onFileSelect={setReceiptFile}
                    accept="image/*,.pdf"
                    label="Upload Receipt"
                    previewUrl={expense?.receipt}
                />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Create Expense" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
