import { getHolidays } from "@/actions/holiday";
import { getClasses } from "@/actions/class";
import { HolidayManager } from "@/components/attendance/holiday-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import type { Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/locale-path";

export default async function HolidaysPage({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await params;
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect(withLocale(lang, "/login"));
  }

  const holidays = await getHolidays();
  const classes = await getClasses();

  return (
    <div className="flex-1 space-y-4">
      <BackButton />
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Holiday Management</h2>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Manage Institute Holidays</CardTitle>
        </CardHeader>
        <CardContent>
          <HolidayManager holidays={holidays} classes={classes} />
        </CardContent>
      </Card>
    </div>
  );
}
