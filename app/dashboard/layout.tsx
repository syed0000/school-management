import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/dashboard/user-nav";
import { MainNav } from "@/components/dashboard/main-nav";
import { AppLogo } from "@/components/ui/app-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = 'force-dynamic'

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role === 'attendance_staff') {
    redirect("/attendance/dashboard");
  }

  if (session.user.role !== 'staff' && session.user.role !== 'admin') {
    if (session.user.role === 'parent') redirect("/parent/dashboard");
    if (session.user.role === 'teacher') redirect("/teacher/dashboard");
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-16 items-center px-4 justify-between">
          <div className="flex items-center gap-3">
             {/* Mobile Menu Trigger inside Header */}
             <div className="lg:hidden">
               <MainNav role="staff" mobileOnly />
             </div>

             <AppLogo href="/dashboard" />
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <UserNav user={session.user} />
          </div>
        </div>
      </header>

      {/* Secondary Nav Bar for Desktop */}
      <div className="hidden lg:block border-y bg-muted sticky top-16 z-10 w-full">
        <div className="overflow-x-auto no-scrollbar py-2 px-4">
          <MainNav role="staff" desktopOnly />
        </div>
      </div>

      <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        {children}
      </main>
    </div>
  );
}
