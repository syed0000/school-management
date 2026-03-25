import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/dashboard/user-nav";
import { MainNav } from "@/components/dashboard/main-nav";
import { AppLogo } from "@/components/ui/app-logo";
import { BackButton } from "@/components/ui/back-button";
import { whatsappConfig } from "@/lib/whatsapp-config";

export const dynamic = 'force-dynamic'

export default async function WhatsAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (!whatsappConfig.enabled) {
    redirect(session.user.role === 'admin' ? "/admin/dashboard" : "/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-20">
        <div className="flex h-16 items-center px-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <MainNav role={session.user.role as "admin" | "staff"} mobileOnly />
            </div>
            <AppLogo href="/admin/dashboard" />
          </div>
          <div className="flex items-center space-x-4">
            <UserNav user={session.user} />
          </div>
        </div>
      </header>

      {/* Secondary Nav Bar for Desktop */}
      <div className="hidden lg:block border-y px-4 py-2 overflow-x-auto bg-muted sticky top-16 z-10">
        <MainNav role={session.user.role as "admin" | "staff"} desktopOnly />
      </div>

      <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <BackButton />
        {children}
      </main>
    </div>
  );
}
