"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, Clock } from "lucide-react"
import { toast } from "sonner"
import { getParentNotificationFeed, getTeacherNotificationFeed } from "@/actions/notification"

type Item = {
  _id: { toString: () => string } | string
  title: string
  body: string
  sentAt?: string | number | Date
  type: string
}

type Props =
  | {
    mode: "teacher"
    initialItems: Item[]
    initialNextCursor: string | null
  }
  | {
    mode: "parent"
    studentId: string
    initialItems: Item[]
    initialNextCursor: string | null
  }

export function NotificationFeed(props: Props) {
  const [items, setItems] = useState<Item[]>(props.initialItems)
  const [nextCursor, setNextCursor] = useState<string | null>(props.initialNextCursor)
  const [loading, setLoading] = useState(false)

  const loadMore = async () => {
    if (!nextCursor) return
    setLoading(true)
    try {
      const res =
        props.mode === "teacher"
          ? await getTeacherNotificationFeed(nextCursor, 20)
          : await getParentNotificationFeed(props.studentId, nextCursor, 20)

      setItems((prev) => [...prev, ...(res.items as unknown as Item[])])
      setNextCursor(res.nextCursor)
    } catch {
      toast.error("Failed to load more notifications.")
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl">
        <Bell className="h-10 w-10 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No notifications</h3>
        <p className="text-muted-foreground mt-1 max-w-sm">
          Notifications from your institute will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((n) => {
        const id = typeof n._id === "string" ? n._id : n._id.toString()
        const ts = n.sentAt ? new Date(n.sentAt) : null
        return (
          <Card key={id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{n.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground whitespace-pre-line">{n.body}</p>
              {ts && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {format(ts, "MMM d, h:mm a")}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {nextCursor && (
        <Button type="button" variant="outline" className="w-full" onClick={loadMore} disabled={loading}>
          {loading ? "Loading..." : "Load More"}
        </Button>
      )}
    </div>
  )
}

