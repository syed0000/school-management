import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTeacherClassAccess } from "@/actions/teacher-portal";
import { TeacherClassTabs } from "@/components/teacher/teacher-class-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { BookA } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/locale-path";

export default async function TeacherDashboard({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await params;
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect(withLocale(lang, "/teachers/login"));
  }

  if (session.user.role !== 'teacher' && session.user.role !== 'admin') {
    redirect(withLocale(lang, "/dashboard"));
  }

  // Fetch teacher's assigned classes
  const assignedClasses = await getTeacherClassAccess(session.user.id);

  if (assignedClasses.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <Card className="max-w-xl mx-auto mt-12">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-4">
            <BookA className="h-12 w-12 text-primary/30" />
            <div>
              <h2 className="text-xl font-semibold text-foreground">No Classes Assigned</h2>
              <p className="mt-2 text-sm">
                You currently do not have any assigned classes. Please contact the administrator to gain access to your class rosters, attendance, and fee data.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Manage attendance and view reports for your assigned classes.</p>
      </div>

      <TeacherClassTabs classes={assignedClasses} />
    </div>
  );
}
