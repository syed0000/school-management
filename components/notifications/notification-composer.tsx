"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { sendAppNotification } from "@/actions/notification"
import { Loader2, Send } from "lucide-react"

const formSchema = z.object({
  title: z.string().min(2, "Title is required"),
  body: z.string().min(5, "Message body is required"),
  targetClassIds: z.array(z.string()),
  targetTeacherIds: z.array(z.string()),
  targetAllTeachers: z.boolean(),
})

type NotificationFormValues = z.infer<typeof formSchema>

interface NotificationComposerProps {
  classes: { _id: string; name: string }[]
  teachers: { _id: string; name: string }[]
}

export function NotificationComposer({ classes, teachers }: NotificationComposerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      body: "",
      targetClassIds: [],
      targetTeacherIds: [],
      targetAllTeachers: false,
    },
  })

  async function onSubmit(values: NotificationFormValues) {
    if (!values.targetAllTeachers && values.targetClassIds.length === 0 && values.targetTeacherIds.length === 0) {
      toast.error("Please select at least one recipient (class or teacher)")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await sendAppNotification({
        title: values.title,
        body: values.body,
        targetClassIds: values.targetClassIds,
        targetTeacherIds: values.targetTeacherIds,
        targetAllTeachers: values.targetAllTeachers,
      })

      if (res.success) {
        toast.success("Notification sent successfully!")
        form.reset()
      } else {
        toast.error("Failed to send notification: " + res.error)
      }
    } catch (error) {
      toast.error("An error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-card p-6 rounded-xl border shadow-sm">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notification Title</FormLabel>
                <FormControl>
                  <Input placeholder="Urgent Announcement..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message Content</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Provide details about the announcement..." 
                    className="min-h-[120px]"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Targets</h3>
            
            <FormField
              control={form.control}
              name="targetClassIds"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FormLabel>Select Classes</FormLabel>
                    <span className="text-xs text-muted-foreground">{field.value.length} selected</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 max-h-[200px] overflow-y-auto p-2 border rounded-md">
                    {classes.map((cls: { _id: string; name: string }) => (
                      <div key={cls._id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`class-${cls._id}`}
                          checked={field.value.includes(cls._id)}
                          onCheckedChange={(checked) => {
                            const current = field.value
                            const updated = checked
                              ? [...current, cls._id]
                              : current.filter((id: string) => id !== cls._id)
                            field.onChange(updated)
                          }}
                        />
                        <Label htmlFor={`class-${cls._id}`} className="text-sm font-normal cursor-pointer">
                          {cls.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <FormDescription>Parents of students in these classes will receive the notification.</FormDescription>
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormField
                control={form.control}
                name="targetAllTeachers"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 bg-muted/30">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">All Teachers</FormLabel>
                      <p className="text-xs text-muted-foreground">Notify ALL registered teachers regardless of their class assigning.</p>
                    </div>
                  </FormItem>
                )}
              />

              {!form.watch("targetAllTeachers") && (
                <FormField
                  control={form.control}
                  name="targetTeacherIds"
                  render={({ field }) => (
                    <FormItem className="space-y-2 mt-4 ml-4 pl-4 border-l-2 border-primary/20">
                      <div className="flex items-center justify-between">
                        <FormLabel>Specific Teachers</FormLabel>
                        <span className="text-xs text-muted-foreground">{field.value.length} selected</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 max-h-[200px] overflow-y-auto p-2 border rounded-md">
                        {teachers.map((t: { _id: string; name: string }) => (
                          <div key={t._id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`teacher-${t._id}`}
                              checked={field.value.includes(t._id)}
                              onCheckedChange={(checked) => {
                                const current = field.value
                                const updated = checked
                                  ? [...current, t._id]
                                  : current.filter((id: string) => id !== t._id)
                                field.onChange(updated)
                              }}
                            />
                            <Label htmlFor={`teacher-${t._id}`} className="text-sm font-normal cursor-pointer">
                              {t.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </FormItem>
                  )}
                />
              )}
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
             <>
               <Loader2 className="mr-2 h-4 w-4 animate-spin" />
               Sending Notifications...
             </>
          ) : (
            <>
               <Send className="mr-2 h-4 w-4" />
               Finalize & Post Notification
            </>
          )}
        </Button>
      </form>
    </Form>
  )
}
