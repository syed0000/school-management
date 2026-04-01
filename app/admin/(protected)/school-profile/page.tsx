import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { WhatsAppToggle } from "@/components/admin/school-profile/whatsapp-toggle"
import { CounterEditor } from "@/components/admin/school-profile/counter-editor"
import { getWhatsAppReceiptSetting, getCounters, getFeePolicySettings } from "@/actions/school-settings"
import { FeePolicyEditor } from "@/components/admin/school-profile/fee-policy-editor"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, Settings, MessageSquare, AlertCircle, Hash } from "lucide-react"
import { whatsappConfig } from "@/lib/whatsapp-config"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default async function SchoolProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "admin") {
    redirect("/admin/dashboard")
  }

  const [initialWhatsAppSetting, counters, feePolicy] = await Promise.all([
    getWhatsAppReceiptSetting(),
    getCounters(),
    getFeePolicySettings()
  ])

  const externalSchoolProfileUrl = `${process.env.NEXT_PUBLIC_FEEEASE_URL || 'https://feeease.com'}/school/profile`
  const isWhatsAppGloballyDisabled = !whatsappConfig.enabled

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">School Profile Settings</h2>
      </div>

      {isWhatsAppGloballyDisabled && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>WhatsApp Integration Disabled</AlertTitle>
          <AlertDescription>
            WhatsApp integration is currently disabled in your project. You won't be able to use WhatsApp features until it is enabled by FeeEase support.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* WhatsApp Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle>WhatsApp Configuration</CardTitle>
            </div>
            <CardDescription>
              Configure WhatsApp alerts and communication settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg border p-4 bg-muted/50">
                <WhatsAppToggle initialValue={initialWhatsAppSetting} />
                <p className="mt-2 text-xs text-muted-foreground italic">
                  When enabled, students will receive an automated WhatsApp receipt upon fee collection.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fee Policy Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <CardTitle>Fee Generation Policy</CardTitle>
            </div>
            <CardDescription>
              Configure how special fees affect monthly dues tracking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FeePolicyEditor 
              initialAdmission={feePolicy.admissionFeeIncludesApril} 
              initialRegistration={feePolicy.registrationFeeIncludesApril} 
            />
          </CardContent>
        </Card>

        {/* Current School Profile Link */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <CardTitle>Global School Settings</CardTitle>
            </div>
            <CardDescription>
              Manage your school's global identity and core billing settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Click the button below to manage your global school profile on FeeEase, including branding, payment methods, and account details.
              </p>
              <Button asChild variant="outline" className="w-full">
                <a
                  href={externalSchoolProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  Manage Global Profile <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Counter Management — full width */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              <CardTitle>Sequence Counter Management</CardTitle>
            </div>
            <CardDescription>
              Adjust the auto-increment counters for student registration numbers and fee receipt numbers.
              The <strong>next</strong> issued number will be <em>current&nbsp;sequence&nbsp;+&nbsp;1</em>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CounterEditor counters={counters} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

