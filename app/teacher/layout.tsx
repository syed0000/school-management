import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/dashboard/user-nav";
import Link from "next/link";
import { AppLogo } from "@/components/ui/app-logo";
import { LayoutDashboard, UserCheck, Share2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

// ... [rest of imports unchanged]
export const dynamic = 'force-dynamic';

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login/otp");
  }

  if (session.user.role !== 'teacher' && session.user.role !== 'admin') {
    redirect("/dashboard");
  }

  const navItems = [
    { name: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
    { name: "Profile", href: "/teacher/profile", icon: UserCheck },
    { name: "Share App", href: "/share", icon: Share2 },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-20 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-16 items-center px-4 justify-between max-w-7xl mx-auto w-full">
          <AppLogo href="/teacher/dashboard" />
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <UserNav user={session.user} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] flex-1 max-w-7xl mx-auto w-full">
        {/* Sidebar for Desktop */}
        <aside className="hidden lg:block border-r bg-background p-6 space-y-6">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 mb-2">Main Menu</p>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-primary/10 hover:text-primary group"
                >
                  <item.icon className="h-4 w-4 group-hover:scale-110 transition-transform" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8 pt-6">
          {children}
        </main>
      </div>

      {/* Bottom Nav for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t flex items-center justify-around px-2 z-30">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors flex-1"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[9px] font-medium whitespace-nowrap">{item.name}</span>
          </Link>
        ))}
      </div>

      {/* Spacer for bottom nav */}
      <div className="h-16 lg:hidden" />
    </div>
  );
}
