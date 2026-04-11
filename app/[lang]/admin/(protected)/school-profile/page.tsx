import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { WhatsAppToggle } from "@/components/admin/school-profile/whatsapp-toggle"
import { CounterEditor } from "@/components/admin/school-profile/counter-editor"
import { ClassGroupManager } from "@/components/admin/school-profile/class-group-manager"
import { TimezoneEditor } from "@/components/admin/school-profile/timezone-picker"
import { getWhatsAppReceiptSetting, getCounters, getFeePolicySettings, getClassGroups, getTimezoneSetting } from "@/actions/school-settings"
import { getClasses } from "@/actions/class"
import { FeePolicyEditor } from "@/components/admin/school-profile/fee-policy-editor"
import { getStorageMigrationStatus } from "@/actions/storage-migration"
import { StorageMigration } from "@/components/admin/school-profile/storage-migration"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, Settings, MessageSquare, AlertCircle, Hash, Layers } from "lucide-react"
import { whatsappConfig } from "@/lib/whatsapp-config"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { Locale } from "@/lib/i18n"
import { withLocale } from "@/lib/locale-path"

export default async function SchoolProfilePage({
  params,
}: {
  params: Promise<{ lang: Locale }>
}) {
  const { lang } = await params
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "admin") {
    redirect(withLocale(lang, "/admin/dashboard"))
  }

  const [initialWhatsAppSetting, counters, feePolicy, classGroups, allClasses, initialTimezone, storageMigration] = await Promise.all([
    getWhatsAppReceiptSetting(),
    getCounters(),
    getFeePolicySettings(),
    getClassGroups(),
    getClasses(),
    getTimezoneSetting(),
    getStorageMigrationStatus(),
  ])

  const externalSchoolProfileUrl = `${process.env.NEXT_PUBLIC_FEEEASE_URL || 'https://feeease.com'}/school/profile`
  const isWhatsAppGloballyDisabled = !whatsappConfig.enabled

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Institute Profile Settings</h2>
      </div>

      {isWhatsAppGloballyDisabled && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>WhatsApp Integration Disabled</AlertTitle>
          <AlertDescription>
            WhatsApp integration is currently disabled in your project. You won&apos;t be able to use WhatsApp features until it is enabled by FeeEase support.
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

        {storageMigration.hasCloudinaryFiles && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <CardTitle>Object Storage Migration</CardTitle>
              </div>
              <CardDescription>
                Migrate existing Cloudinary files to Contabo Object Storage. This option is shown only while Cloudinary files exist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StorageMigration
                contaboConfigured={storageMigration.contaboConfigured}
                hasCloudinaryFiles={storageMigration.hasCloudinaryFiles}
                status={storageMigration.status}
              />
            </CardContent>
          </Card>
        )}

        {/* Current School Profile Link */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <CardTitle>Global Institute Settings</CardTitle>
            </div>
            <CardDescription>
              Manage your institute&apos;s global identity, timezone, and core settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <TimezoneEditor initialTimezone={initialTimezone} />
              
              <div className="space-y-4 pt-4 border-t">
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

        {/* Class Group Registration Management — full width */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <CardTitle>Class Group Registration Numbers</CardTitle>
            </div>
            <CardDescription>
              Create groups of classes that share a <strong>separate</strong> registration number sequence.
              Useful when you want Primary classes to start from e.g. <em>1001</em> and Secondary from <em>2001</em>.
              Classes not in any group continue to use the global counter above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClassGroupManager groups={classGroups} allClasses={allClasses} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
