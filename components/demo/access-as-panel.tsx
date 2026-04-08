"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { toast } from "sonner"

type Role = "admin" | "staff" | "attendance_staff" | "teacher" | "parent"

export type AccessAsTarget = {
  id: string
  name: string
  role: Role
  subtitle?: string
}

type AccessAsPanelProps = {
  targets: {
    admins: AccessAsTarget[]
    staff: AccessAsTarget[]
    attendanceStaff: AccessAsTarget[]
    teachers: AccessAsTarget[]
    parents: AccessAsTarget[]
  }
}

const roleLanding: Record<Role, string> = {
  admin: "/admin/dashboard",
  staff: "/dashboard",
  attendance_staff: "/attendance/dashboard",
  teacher: "/teacher/dashboard",
  parent: "/parent/dashboard",
}

export function AccessAsPanel({ targets }: AccessAsPanelProps) {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!q) return targets
    const filter = (list: AccessAsTarget[]) =>
      list.filter((t) => (t.name + " " + (t.subtitle || "")).toLowerCase().includes(q))

    return {
      admins: filter(targets.admins),
      staff: filter(targets.staff),
      attendanceStaff: filter(targets.attendanceStaff),
      teachers: filter(targets.teachers),
      parents: filter(targets.parents),
    }
  }, [q, targets])

  async function setImpersonation(target: AccessAsTarget) {
    if (!session?.user?.isDemo) {
      toast.error("Demo session not found")
      return
    }

    await update({
      user: {
        impersonation: {
          id: target.id,
          role: target.role,
          name: target.name,
        },
      },
    })

    router.push(roleLanding[target.role])
    router.refresh()
  }

  async function clearImpersonation() {
    if (!session?.user?.isDemo) return
    await update({ user: { impersonation: null } })
    router.refresh()
  }

  const actingAs = session?.user?.impersonation

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Access As</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users..." />
            {actingAs && (
              <Button variant="outline" onClick={clearImpersonation}>
                Stop Access As
              </Button>
            )}
          </div>
          {actingAs && (
            <div className="text-sm text-muted-foreground">
              Currently viewing as {actingAs.role}: {actingAs.name || actingAs.id}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="admins">
              <AccordionTrigger>Admins</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {filtered.admins.map((t) => (
                    <Button key={t.id} variant="ghost" className="w-full justify-between" onClick={() => setImpersonation(t)}>
                      <span className="text-left">
                        <span className="block font-medium">{t.name}</span>
                        {t.subtitle && <span className="block text-xs text-muted-foreground">{t.subtitle}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">admin</span>
                    </Button>
                  ))}
                  {filtered.admins.length === 0 && <div className="text-sm text-muted-foreground">No admins found.</div>}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="staff">
              <AccordionTrigger>Staff</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {filtered.staff.map((t) => (
                    <Button key={t.id} variant="ghost" className="w-full justify-between" onClick={() => setImpersonation(t)}>
                      <span className="text-left">
                        <span className="block font-medium">{t.name}</span>
                        {t.subtitle && <span className="block text-xs text-muted-foreground">{t.subtitle}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">staff</span>
                    </Button>
                  ))}
                  {filtered.staff.length === 0 && <div className="text-sm text-muted-foreground">No staff found.</div>}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="attendance">
              <AccordionTrigger>Attendance Staff</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {filtered.attendanceStaff.map((t) => (
                    <Button key={t.id} variant="ghost" className="w-full justify-between" onClick={() => setImpersonation(t)}>
                      <span className="text-left">
                        <span className="block font-medium">{t.name}</span>
                        {t.subtitle && <span className="block text-xs text-muted-foreground">{t.subtitle}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">attendance</span>
                    </Button>
                  ))}
                  {filtered.attendanceStaff.length === 0 && (
                    <div className="text-sm text-muted-foreground">No attendance staff found.</div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="teachers">
              <AccordionTrigger>Teachers</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {filtered.teachers.map((t) => (
                    <Button key={t.id} variant="ghost" className="w-full justify-between" onClick={() => setImpersonation(t)}>
                      <span className="text-left">
                        <span className="block font-medium">{t.name}</span>
                        {t.subtitle && <span className="block text-xs text-muted-foreground">{t.subtitle}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">teacher</span>
                    </Button>
                  ))}
                  {filtered.teachers.length === 0 && <div className="text-sm text-muted-foreground">No teachers found.</div>}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="parents">
              <AccordionTrigger>Parents (Students)</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {filtered.parents.map((t) => (
                    <Button key={t.id} variant="ghost" className="w-full justify-between" onClick={() => setImpersonation(t)}>
                      <span className="text-left">
                        <span className="block font-medium">{t.name}</span>
                        {t.subtitle && <span className="block text-xs text-muted-foreground">{t.subtitle}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">parent</span>
                    </Button>
                  ))}
                  {filtered.parents.length === 0 && <div className="text-sm text-muted-foreground">No students found.</div>}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
