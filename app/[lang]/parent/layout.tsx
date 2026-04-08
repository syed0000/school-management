import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/dashboard/user-nav";
import { AppLogo } from "@/components/ui/app-logo";
import { getCurrentParentStudents } from "@/actions/parent";
import { StudentSwitcher } from "@/components/parent/student-switcher";
import { BottomNav } from "@/components/parent/bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/locale-path";

export const dynamic = 'force-dynamic';

export default async function ParentLayout({
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
    redirect(withLocale(lang, "/login/otp"));
  }

  if (session.user.role !== 'parent' && session.user.role !== 'admin') {
    redirect(withLocale(lang, "/dashboard"));
  }

  // Fetch all students linked to this parent's phone
  const students = await getCurrentParentStudents();
  
  const cookieStore = await cookies();
  const activeStudentCookie = cookieStore.get('activeParentStudentId')?.value;
  let activeStudentId = activeStudentCookie || session.user.id;

  if (activeStudentCookie && students.length > 0 && !students.some(s => s._id === activeStudentCookie)) {
    activeStudentId = session.user.id;
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-20 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-16 items-center px-4 justify-between max-w-7xl mx-auto w-full gap-4">
          <AppLogo href={withLocale(lang, "/parent/dashboard")} />

          <div className="flex items-center gap-3">
            {students.length > 0 && (
              <StudentSwitcher students={students} activeStudentId={activeStudentId} />
            )}
            <LanguageSwitcher
              currentLocale={lang}
              languageNames={{
                en: dict?.language?.en ?? "English",
                hi: dict?.language?.hi ?? "Hindi",
                ur: dict?.language?.ur ?? "Urdu",
              }}
            />
            <ThemeToggle />
            <UserNav user={session.user} />
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center">
        <main className="max-w-7xl w-full px-4 md:px-8 py-6 pb-32">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
