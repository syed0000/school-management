"use client"

import { useForm, useFieldArray } from "react-hook-form"
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
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Loader2, Pencil, Trash2, Plus } from "lucide-react"
import { updateClassWithFees } from "@/actions/class"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const months = [
  "April", "May", "June", "July", "August", "September", 
  "October", "November", "December", "January", "February", "March"
];

export const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  monthlyFee: z.number().min(0),
  monthlyFeeEffectiveFrom: z.string().min(1, "Effective Date is required"),
  admissionFee: z.number().min(0),
  admissionFeeEffectiveFrom: z.string().min(1, "Effective Date is required"),
  registrationFee: z.number().min(0),
  registrationFeeEffectiveFrom: z.string().min(1, "Effective Date is required"),
  examFees: z.array(z.object({
    title: z.string().min(1, "Exam name is required"),
    month: z.string().min(1, "Month is required"),
    amount: z.number().min(0),
    effectiveFrom: z.string().min(1, "Effective Date is required")
  }))
})

export type FormValues = z.infer<typeof formSchema>

export interface EditClassDialogProps {
  classData: {
    id: string
    name: string
    monthlyFee: number
    monthlyFeeEffectiveFrom?: Date
    admissionFee: number
    admissionFeeEffectiveFrom?: Date
    registrationFee: number
    registrationFeeEffectiveFrom?: Date
    examFees: { title: string; month: string; amount: number; effectiveFrom?: Date }[]
  }
}

export function EditClassDialog({ classData }: EditClassDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const defaultDate = new Date().toISOString().split('T')[0];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: classData.name,
      monthlyFee: classData.monthlyFee,
      monthlyFeeEffectiveFrom: classData.monthlyFeeEffectiveFrom ? new Date(classData.monthlyFeeEffectiveFrom).toISOString().split('T')[0] : defaultDate,
      admissionFee: classData.admissionFee,
      admissionFeeEffectiveFrom: classData.admissionFeeEffectiveFrom ? new Date(classData.admissionFeeEffectiveFrom).toISOString().split('T')[0] : defaultDate,
      registrationFee: classData.registrationFee,
      registrationFeeEffectiveFrom: classData.registrationFeeEffectiveFrom ? new Date(classData.registrationFeeEffectiveFrom).toISOString().split('T')[0] : defaultDate,
      examFees: classData.examFees.map(e => ({
        ...e,
        effectiveFrom: e.effectiveFrom ? new Date(e.effectiveFrom).toISOString().split('T')[0] : defaultDate
      })) || [],
    },
    mode: "onChange",
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "examFees"
  });

  // Update form values when classData changes
  useEffect(() => {
    const defaultDate = new Date().toISOString().split('T')[0];
    form.reset({
      name: classData.name,
      monthlyFee: classData.monthlyFee,
      monthlyFeeEffectiveFrom: classData.monthlyFeeEffectiveFrom ? new Date(classData.monthlyFeeEffectiveFrom).toISOString().split('T')[0] : defaultDate,
      admissionFee: classData.admissionFee,
      admissionFeeEffectiveFrom: classData.admissionFeeEffectiveFrom ? new Date(classData.admissionFeeEffectiveFrom).toISOString().split('T')[0] : defaultDate,
      registrationFee: classData.registrationFee,
      registrationFeeEffectiveFrom: classData.registrationFeeEffectiveFrom ? new Date(classData.registrationFeeEffectiveFrom).toISOString().split('T')[0] : defaultDate,
      examFees: classData.examFees.map(e => ({
        ...e,
        effectiveFrom: e.effectiveFrom ? new Date(e.effectiveFrom).toISOString().split('T')[0] : defaultDate
      })) || [],
    })
  }, [classData, form])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const result = await updateClassWithFees({
        classId: classData.id,
        name: values.name,
        monthlyFee: values.monthlyFee,
        monthlyFeeEffectiveFrom: values.monthlyFeeEffectiveFrom,
        admissionFee: values.admissionFee,
        admissionFeeEffectiveFrom: values.admissionFeeEffectiveFrom,
        registrationFee: values.registrationFee,
        registrationFeeEffectiveFrom: values.registrationFeeEffectiveFrom,
        examFees: values.examFees
      })
      
      if (result.success) {
        toast.success("Class updated successfully")
        setOpen(false)
      } else {
        toast.error(`Failed to update class: ${result.error}`)
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
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Class</DialogTitle>
          <DialogDescription>
            Update class details and fee structure.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Class 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 border p-4 rounded-md bg-muted/10">
              <h4 className="font-medium text-sm border-b pb-2 mb-4">Standard Fees</h4>
              
              {/* Monthly Fee */}
              <div className="grid grid-cols-2 gap-4 items-end">
                <FormField
                  control={form.control}
                  name="monthlyFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Fee</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field} 
                          value={field.value} 
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="monthlyFeeEffectiveFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Effective Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Admission Fee */}
              <div className="grid grid-cols-2 gap-4 items-end">
                <FormField
                  control={form.control}
                  name="admissionFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admission Fee</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field} 
                          value={field.value} 
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="admissionFeeEffectiveFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Effective Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Registration Fee */}
              <div className="grid grid-cols-2 gap-4 items-end">
                <FormField
                  control={form.control}
                  name="registrationFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Fee</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field} 
                          value={field.value} 
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="registrationFeeEffectiveFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Effective Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base">Examination Fees</FormLabel>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => append({ title: "", month: "", amount: 0, effectiveFrom: new Date().toISOString().split('T')[0] })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Exam
                </Button>
              </div>
              
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border p-2 rounded-md bg-muted/20">
                  <div className="md:col-span-3">
                    <FormField
                      control={form.control}
                      name={`examFees.${index}.title`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Exam Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Annual Exam" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <FormField
                      control={form.control}
                      name={`examFees.${index}.month`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Month</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {months.map((month) => (
                                <SelectItem key={month} value={month}>
                                  {month}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name={`examFees.${index}.amount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Fee</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              {...field} 
                              value={field.value}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="md:col-span-3">
                      <FormField
                          control={form.control}
                          name={`examFees.${index}.effectiveFrom`}
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel className="text-xs">Date</FormLabel>
                                  <FormControl>
                                      <Input type="date" className="px-2 text-xs" {...field} />
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                  </div>
                  <div className="md:col-span-1 flex justify-center pb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive/90"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {fields.length === 0 && (
                 <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
                   No exams added. Click &quot;Add Exam&quot; to configure examination fees.
                 </p>
              )}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
