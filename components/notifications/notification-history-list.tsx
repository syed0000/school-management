"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Trash2, Users, GraduationCap, Clock, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { deleteNotification, getNotificationHistoryPage } from "@/actions/notification"

interface NotificationHistoryProps {
  initialNotifications: Record<string, unknown>[]
  initialNextCursor: string | null
}

export function NotificationHistoryList({ initialNotifications, initialNextCursor }: NotificationHistoryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Record<string, unknown>[]>(initialNotifications)
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  const [loadingMore, setLoadingMore] = useState(false)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await deleteNotification(id)
      if (res.success) {
        setNotifications((prev) => prev.filter((n) => String(n._id) !== id))
        toast.success("Notification deleted permanently.")
      } else {
        toast.error("Failed to delete notification.")
      }
    } catch {
      toast.error("An error occurred.")
    } finally {
      setDeletingId(null)
    }
  }

  const loadMore = async () => {
    if (!nextCursor) return
    setLoadingMore(true)
    try {
      const res = await getNotificationHistoryPage(nextCursor, 20)
      setNotifications((prev) => [...prev, ...res.items])
      setNextCursor(res.nextCursor)
    } catch {
      toast.error("Failed to load more notifications.")
    } finally {
      setLoadingMore(false)
    }
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl">
        <MessageSquare className="h-10 w-10 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No notifications found</h3>
        <p className="text-muted-foreground mt-1 max-w-sm">
          Once you send app notifications, they will appear here for tracking and deletion.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-card/50 backdrop-blur-sm overflow-hidden space-y-3">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-12">S.No</TableHead>
            <TableHead className="w-[30%]">Title & Message</TableHead>
            <TableHead>Recipients</TableHead>
            <TableHead>Sent At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {notifications.map((notif: Record<string, unknown>, index) => (
            <TableRow key={String(notif._id)} className="group transition-colors hover:bg-muted/30">
              <TableCell>{index + 1}</TableCell>
              <TableCell className="font-medium">
                <div className="flex flex-col gap-1">
                   <span className="text-sm font-bold truncate max-w-[200px]">{String(notif.title)}</span>
                   <span className="text-xs text-muted-foreground line-clamp-1">{String(notif.body)}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1.5">
                   {notif.type === 'broadcast' && <Badge variant="secondary">All Users</Badge>}
                   {Array.isArray(notif.targetClasses) && notif.targetClasses.length > 0 && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <GraduationCap className="h-3 w-3" />
                        {notif.targetClasses.length} Classes
                      </Badge>
                   )}
                   {Array.isArray(notif.targetTeachers) && notif.targetTeachers.length > 0 && (
                      <Badge variant="outline" className="flex items-center gap-1 border-blue-200 text-blue-700 bg-blue-50/50">
                        <Users className="h-3 w-3" />
                        {notif.targetTeachers.length} Teachers
                      </Badge>
                   )}
                </div>
              </TableCell>
              <TableCell>
                 <div className="flex items-center gap-2 text-xs text-muted-foreground">
                   <Clock className="h-3.5 w-3.5" />
                   {format(new Date(notif.sentAt as string | number | Date), "MMM d, h:mm a")}
                 </div>
              </TableCell>
              <TableCell className="text-right">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Activity Forever?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this notification record from the database. 
                        It cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                         onClick={() => handleDelete(String(notif._id))}
                         disabled={deletingId === String(notif._id)}
                         className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
                      >
                         Delete Permamently
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {nextCursor && (
        <div className="p-4 border-t bg-muted/20">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  )
}
