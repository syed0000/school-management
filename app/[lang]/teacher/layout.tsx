import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/dashboard/user-nav";
import Link from "next/link";
import { AppLogo } from "@/components/ui/app-logo";
import { FeeEaseWordmark } from "@/components/ui/fee-ease-wordmark";
import { LayoutDashboard, UserCheck, Share2, Bell } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { dictString, getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/locale-path";

// ... [rest of imports unchanged]
export const dynamic = 'force-dynamic';

export default async function TeacherLayout({
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
    redirect(withLocale(lang, "/teachers/login"));
  }

  if (session.user.role !== 'teacher' && session.user.role !== 'admin') {
    redirect(withLocale(lang, "/dashboard"));
  }

  const navItems = [
    { name: dictString(dict, "common.dashboard", "Dashboard"), href: withLocale(lang, "/teacher/dashboard"), icon: LayoutDashboard },
    { name: dictString(dict, "common.profile", "Profile"), href: withLocale(lang, "/teacher/profile"), icon: UserCheck },
    { name: dictString(dict, "common.notifications", "Notifications"), href: withLocale(lang, "/teacher/notifications"), icon: Bell },
    { name: dictString(dict, "nav.shareApp", "Share App"), href: withLocale(lang, "/share"), icon: Share2 },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-20 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="grid h-16 grid-cols-3 items-center px-4 max-w-7xl mx-auto w-full">
          <div className="justify-self-start">
            <FeeEaseWordmark href={withLocale(lang, "/teacher/dashboard")} />
          </div>
          <div className="justify-self-center">
            <AppLogo href={withLocale(lang, "/teacher/dashboard")} />
          </div>
          <div className="flex items-center space-x-4 justify-self-end">
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

      <div className="flex-1 max-w-2xl mx-auto w-full mb-16">
        <main className="p-4 md:p-6 pt-6">
          {children}
        </main>
      </div>

      {/* Floating Bottom Nav for all screen sizes (Native App approach) */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-md border-t flex items-center justify-center z-30 supports-backdrop-filter:bg-background/60">
        <div className="flex justify-around items-center w-full max-w-2xl px-2 h-full">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all flex-1 h-full rounded-xl hover:bg-muted/50 active:scale-95"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium whitespace-nowrap">{item.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
