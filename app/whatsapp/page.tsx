import { getClasses } from "@/actions/student"
import { WhatsAppNotificationForm } from "@/components/whatsapp/whatsapp-notification-form"
import { WhatsAppHistory } from "@/components/whatsapp/whatsapp-history"
import { getWhatsAppHistory, getWhatsAppSummary } from "@/actions/whatsapp-stats"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getTeachers } from "@/actions/teacher"
import { getNotificationHistory } from "@/actions/notification"
import { NotificationComposer } from "@/components/notifications/notification-composer"
import { NotificationHistoryList } from "@/components/notifications/notification-history-list"
import { MessageSquare, Bell } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export const dynamic = 'force-dynamic'

export default async function WhatsAppPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const [classes, teachers, history, summary, appNotifications] = await Promise.all([
    getClasses(),
    getTeachers(),
    getWhatsAppHistory(),
    getWhatsAppSummary(),
    getNotificationHistory(),
  ]);

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Notification Center</h2>
        <Badge variant="outline" className="px-3 py-1 border-primary/20 text-primary bg-primary/5">
          Admin Portal
        </Badge>
      </div>

      <Tabs defaultValue="in-app" className="space-y-6">
        <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-8">
          <TabsTrigger 
            value="in-app" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-4 h-auto font-semibold"
          >
            <Bell className="h-4 w-4 mr-2" />
            In-App Notifications
          </TabsTrigger>
          <TabsTrigger 
            value="whatsapp" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-4 h-auto font-semibold"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            WhatsApp Integration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="in-app" className="space-y-6">
           <Tabs defaultValue="compose" className="space-y-6">
             <TabsList>
                <TabsTrigger value="compose">Compose Notification</TabsTrigger>
                <TabsTrigger value="history">History & Tracking</TabsTrigger>
             </TabsList>
             <TabsContent value="compose">
                <NotificationComposer 
                  classes={classes.map(c => ({ _id: c.id, name: c.name }))} 
                  teachers={teachers} 
                />
             </TabsContent>
             <TabsContent value="history">
                <NotificationHistoryList notifications={appNotifications} />
             </TabsContent>
           </Tabs>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-6">
          <Tabs defaultValue="compose" className="space-y-6">
            <TabsList>
              <TabsTrigger value="compose" className="gap-2">Compose</TabsTrigger>
              <TabsTrigger value="history" className="gap-2">History & Billing</TabsTrigger>
            </TabsList>

            <TabsContent value="compose">
              <WhatsAppNotificationForm classes={classes} />
            </TabsContent>
            <TabsContent value="history">
              <WhatsAppHistory history={history} summary={summary} />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  )
}

