import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { schoolConfig } from "@/lib/config";
import dbConnect from "@/lib/db";
import License from "@/models/License";
import User from "@/models/User";
import type { Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/locale-path";
import { dictString, getDictionary } from "@/lib/dictionaries";

export const dynamic = 'force-dynamic';

async function checkInitialization() {
    try {
        await dbConnect();
        const license = await License.findOne({});
        const admin = await User.findOne({ role: 'admin' });
        
        return !!(license && admin);
    } catch (e) {
        console.error("Failed to check initialization:", e);
        return false;
    }
}

export default async function Home({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  const initialized = await checkInitialization();
  
  if (!initialized) {
      redirect(withLocale(lang, "/activate"));
  }

  const session = await getServerSession(authOptions);

  if (session) {
    if (session.user.isDemo) {
      redirect(withLocale(lang, "/demo/access-as"));
    }
    if (session.user.role === "admin") {
      redirect(withLocale(lang, "/admin/dashboard"));
    } else if (session.user.role === "attendance_staff") {
      redirect(withLocale(lang, "/attendance/dashboard"));
    } else {
      redirect(withLocale(lang, "/dashboard"));
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 gap-4">
      <h1 className="text-4xl font-bold tracking-tight">{schoolConfig.name}</h1>
      <p className="text-muted-foreground">{dictString(dict, "landing.managementSystem", "Management System")}</p>
      <div className="flex gap-4 mt-8">
        <Button asChild variant="default">
          <Link href={withLocale(lang, "/login")}>{dictString(dict, "auth.staffLogin", "Staff Login")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={withLocale(lang, "/admin/login")}>{dictString(dict, "auth.adminLogin", "Admin Login")}</Link>
        </Button>
      </div>
    </div>
  );
}
