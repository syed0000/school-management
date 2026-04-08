"use client"

import { useState } from "react"
import { useForm, Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { CalendarIcon, Loader2, Trash } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { addHoliday, deleteHoliday } from "@/actions/holiday"
import { useRouter } from "next/navigation"

const formSchema = z.object({
  dateRange: z.object({
    from: z.date({
      message: "Start date is required",
    }),
    to: z.date().optional(),
  }),
  description: z.string().min(1, "Description is required"),
  affectedClasses: z.array(z.string()).optional(),
})

interface HolidayListProps {
  holidays: { id: string; startDate: string; endDate: string; description: string; affectedClasses: { id: string; name: string }[] }[]
  classes: { id: string; name: string }[]
}

export function HolidayManager({ holidays: initialHolidays, classes }: HolidayListProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  
  const holidays = initialHolidays;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as Resolver<z.infer<typeof formSchema>>,
    defaultValues: {
      description: "",
      affectedClasses: [],
    },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true)
    try {
      const fromDate = values.dateRange.from;
      const toDate = values.dateRange.to || fromDate;

      const result = await addHoliday({
        startDate: fromDate.toISOString(),
        endDate: toDate.toISOString(),
        description: values.description,
        affectedClasses: values.affectedClasses,
      })

      if (result.success) {
        toast.success("Holiday added successfully")
        form.reset({
            dateRange: undefined,
          description: "",
          affectedClasses: [],
        })
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      const result = await deleteHoliday(id)
      if (result.success) {
        toast.success("Holiday deleted successfully")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error("An error occurred")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-6">
        <h3 className="text-lg font-medium">Add New Holiday</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="dateRange"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date Range</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value?.from ? (
                            field.value.to ? (
                              <>
                                {format(field.value.from, "LLL dd, y")} -{" "}
                                {format(field.value.to, "LLL dd, y")}
                              </>
                            ) : (
                              format(field.value.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Pick a date range</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
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
                    <Input placeholder="e.g. Winter Break" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="affectedClasses"
              render={({ field }) => (
                <FormItem className="space-y-4">
                  <div className="flex items-center justify-between">
                    <FormLabel>Affected Classes (Optional)</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px]"
                      onClick={() => {
                        const allIds = classes.map(c => c.id);
                        if (field.value?.length === allIds.length) {
                          field.onChange([]);
                        } else {
                          field.onChange(allIds);
                        }
                      }}
                    >
                      {field.value?.length === classes.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  <FormControl>
                    <div className="border rounded-md p-4 bg-muted/50">
                      <div className="h-[150px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-muted">
                        <div className="grid grid-cols-2 gap-4">
                          {classes.map((cls) => (
                            <div key={cls.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={cls.id}
                                checked={field.value?.includes(cls.id)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, cls.id]);
                                  } else {
                                    field.onChange(current.filter((id) => id !== cls.id));
                                  }
                                }}
                              />
                              <label
                                htmlFor={cls.id}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {cls.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </FormControl>
                  <p className="text-[10px] text-muted-foreground italic">
                    * If no classes are selected, the holiday will apply to all classes by default.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Holiday
            </Button>
          </form>
        </Form>
      </div>

      <div className="space-y-6">
        <h3 className="text-lg font-medium">Upcoming Holidays</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">S.No</TableHead>
                <TableHead>Date(s)</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Affected Classes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                    No holidays found.
                  </TableCell>
                </TableRow>
              ) : (
                holidays.map((holiday, index) => {
                  const start = new Date(holiday.startDate);
                  const end = new Date(holiday.endDate);
                  const isSameDay = start.toDateString() === end.toDateString();
                  
                  return (
                    <TableRow key={holiday.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        {isSameDay 
                          ? format(start, "PPP") 
                          : `${format(start, "PPP")} - ${format(end, "PPP")}`
                        }
                      </TableCell>
                      <TableCell>{holiday.description}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {holiday.affectedClasses.length === 0 ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Global (All)</Badge>
                          ) : (
                            holiday.affectedClasses.map(c => (
                              <Badge key={c.id} variant="secondary" className="text-[10px] h-5">{c.name}</Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(holiday.id)}
                          disabled={deleting === holiday.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deleting === holiday.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
