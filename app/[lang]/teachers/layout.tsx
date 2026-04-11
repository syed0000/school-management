import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/dashboard/user-nav";
import { MainNav } from "@/components/dashboard/main-nav";
import { AppLogo } from "@/components/ui/app-logo";
import { FeeEaseWordmark } from "@/components/ui/fee-ease-wordmark";
import { BackButton } from "@/components/ui/back-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { dictString, getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/locale-path";

export const dynamic = 'force-dynamic'

export default async function TeachersLayout({
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

  const navRole = session.user.role === "admin" ? "admin" : "staff"
  const homeHref = navRole === "admin" ? "/admin/dashboard" : "/dashboard"

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="grid h-16 grid-cols-3 items-center px-4">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <MainNav role={navRole} mobileOnly />
            </div>
            <FeeEaseWordmark href={withLocale(lang, homeHref)} />
          </div>
          <div className="justify-self-center">
            <AppLogo href={withLocale(lang, homeHref)} />
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
      
      <div className="hidden lg:block border-y bg-muted sticky top-16 z-10 w-full">
        <div className="overflow-x-auto no-scrollbar py-2 px-4">
          <MainNav role={navRole} desktopOnly />
        </div>
      </div>
      <main className="flex-1 space-y-4 p-8 pt-6">
        <BackButton />
        {children}
      </main>
    </div>
  );
}
