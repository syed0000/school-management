import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/dashboard/user-nav";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { dictString, getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/locale-path";

export default async function AttendanceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  const session = await getServerSession(authOptions);

  if (!session) {
    redirect(withLocale(lang, "/login"));
  }

  // Only allow attendance_staff and admin
  if (session.user.role !== 'attendance_staff' && session.user.role !== 'admin') {
    redirect(withLocale(lang, "/dashboard"));
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="flex h-16 items-center px-4">
          <Link href={withLocale(lang, "/attendance/dashboard")} className="mr-4 font-bold text-lg">
            {dictString(dict, "attendance.managementTitle", "Attendance Management")}
          </Link>
          <div className="ml-auto flex items-center space-x-4">
            <LanguageSwitcher
              currentLocale={lang}
              languageNames={{
                en: dictString(dict, "language.en", "English"),
                hi: dictString(dict, "language.hi", "Hindi"),
                ur: dictString(dict, "language.ur", "Urdu"),
              }}
            />
            <ThemeToggle />
            <UserNav user={session.user} />
          </div>
        </div>
      </header>
      <main className="flex-1 space-y-4 p-8 pt-6">
        {children}
      </main>
    </div>
  );
}
