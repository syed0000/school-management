import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStudentProfileForParent, getParentStudents } from "@/actions/parent";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, CreditCard, BookOpen, User2 } from "lucide-react";
import Link from "next/link";
import dbConnect from "@/lib/db";
import Student from "@/models/Student";

import { DashboardPhotoUpload } from "@/components/parent/dashboard-photo-upload";

import { cookies } from "next/headers";

export default async function ParentDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login/otp");
  if (session.user.role !== 'parent' && session.user.role !== 'admin') redirect("/dashboard");

  const cookieStore = await cookies();
  const activeStudentCookie = cookieStore.get('activeParentStudentId')?.value;
  const sessionStudentId = session.user.id;

  // Resolve which student to show
  let targetStudentId = activeStudentCookie || sessionStudentId;
  let phone = "";

  if (session.user.role === 'parent') {
    await dbConnect();
    const student = await Student.findById(sessionStudentId).select('contacts').lean() as { contacts?: { mobile?: string[] } } | null;
    phone = student?.contacts?.mobile?.[0] ?? "";
  }

  // Validate access if switching student
  if (activeStudentCookie && activeStudentCookie !== sessionStudentId && phone) {
    const students = await getParentStudents(phone);
    const hasAccess = students.some((s) => s._id === activeStudentCookie);
    if (!hasAccess) targetStudentId = sessionStudentId;
  }

  const profile = await getStudentProfileForParent(targetStudentId, phone);

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Profile not found</h2>
          <p className="text-muted-foreground mt-2">We could not load the student profile.</p>
        </div>
      </div>
    );
  }

  const quickLinks = [
    {
      label: "View Profile",
      description: "Personal details & photo",
      href: `/parent/profile`,
      icon: User2,
      color: "bg-purple-50 text-purple-700 border-purple-200",
    },
    {
      label: "Attendance",
      description: "Monthly attendance calendar",
      href: `/parent/attendance`,
      icon: CalendarDays,
      color: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      label: "Fee Status",
      description: "Paid & pending dues",
      href: `/parent/fees`,
      icon: CreditCard,
      color: "bg-green-50 text-green-700 border-green-200",
    },
    // {
    //   label: "Academics",
    //   description: "Class & section info",
    //   href: `/parent/profile`,
    //   icon: BookOpen,
    //   color: "bg-orange-50 text-orange-700 border-orange-200",
    // },
  ];

  return (
    <div className="space-y-6">
      {/* Student profile card */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-linear-to-r from-primary/20 to-primary/5" />
        <CardContent className="pt-0 relative">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <DashboardPhotoUpload
              profileId={profile._id}
              name={profile.name}
              photo={profile.photo || undefined}
            />
            <div className="pb-1">
              <h2 className="text-xl font-bold">{profile.name}</h2>
              <p className="text-muted-foreground text-sm">
                {profile.className} – Section {profile.section}
                {profile.rollNumber ? ` · Roll ${profile.rollNumber}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {profile.registrationNumber && (
              <Badge variant="outline" className="text-xs">
                Reg: {profile.registrationNumber}
              </Badge>
            )}
            {profile.dateOfAdmission && (
              <Badge variant="outline" className="text-xs">
                Admitted: {profile.dateOfAdmission}
              </Badge>
            )}
            <Badge variant={profile.isActive ? "default" : "destructive"} className="text-xs">
              {profile.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickLinks.map((link) => (
          <Link key={link.label} href={link.href}>
            <Card className={`border cursor-pointer hover:shadow-md transition-shadow h-full ${link.color}`}>
              <CardContent className="p-4 flex flex-col gap-2">
                <link.icon className="h-6 w-6" />
                <div>
                  <div className="font-semibold text-sm">{link.label}</div>
                  <div className="text-xs opacity-75">{link.description}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
