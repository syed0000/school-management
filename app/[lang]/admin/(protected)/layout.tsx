import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/dashboard/user-nav";
import { MainNav } from "@/components/dashboard/main-nav";
import { AppLogo } from "@/components/ui/app-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/locale-path";

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect(withLocale(lang, "/admin/login"));
  }

  const role = session.user.role;
  if (role !== "admin" && role !== "staff") {
    redirect(withLocale(lang, "/admin/login"));
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-16 items-center px-4 justify-between">
          <div className="flex items-center gap-3">
             {/* Mobile Menu Trigger inside Header */}
             <div className="lg:hidden">
               <MainNav role={session.user.role as "admin" | "staff"} mobileOnly />
             </div>

             <AppLogo href={withLocale(lang, "/admin/dashboard")} />
          </div>
          <div className="flex items-center space-x-4">
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
      
      {/* Secondary Nav Bar for Desktop - Restored */}
      <div className="hidden lg:block border-y bg-muted sticky top-16 z-10 w-full">
        <div className="overflow-x-auto no-scrollbar py-2 px-4">
            <MainNav role={session.user.role as "admin" | "staff"} desktopOnly />
        </div>
      </div>
      
      <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        {children}
      </main>
    </div>
  );
}
