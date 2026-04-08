import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/dashboard/user-nav";
import { MainNav } from "@/components/dashboard/main-nav";
import Image from "next/image";
import { X } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { schoolConfig } from "@/lib/config";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getDictionary } from "@/lib/dictionaries";
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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="flex h-16 items-center px-4">
          <div className="flex items-center gap-3 mr-4">
             <div className="relative h-10 w-32 flex items-center justify-center rounded-md overflow-hidden">
                <Image 
                  src="/feeEasyLogo.png" 
                  alt="feeEase" 
                  fill
                  className="object-contain p-1"
                  priority
                />
             </div>
             <X className="h-5 w-5 text-purple-600 font-bold stroke-3" />
             <div className="font-bold text-lg tracking-tight hidden md:block">
                {schoolConfig.name}
             </div>
          </div>
          <MainNav className="mx-6" role="staff" />
          <div className="ml-auto flex items-center space-x-4">
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
      <main className="flex-1 space-y-4 p-8 pt-6">
        <BackButton />
        {children}
      </main>
    </div>
  );
}
