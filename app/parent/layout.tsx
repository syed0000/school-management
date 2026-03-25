import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/dashboard/user-nav";
import { AppLogo } from "@/components/ui/app-logo";
import { Home, UserCircle, CalendarDays, CreditCard } from "lucide-react";
import Link from "next/link";
import { getCurrentParentStudents } from "@/actions/parent";
import { StudentSwitcher } from "@/components/parent/student-switcher";

export const dynamic = 'force-dynamic';

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login/otp");
  }

  if (session.user.role !== 'parent' && session.user.role !== 'admin') {
    redirect("/dashboard");
  }

  // Fetch all students linked to this parent's phone
  const students = await getCurrentParentStudents();
  let activeStudentId = session.user.id;

  const navItems = [
    { name: "Home", href: "/parent/dashboard", icon: Home },
    { name: "Profile", href: "/parent/profile", icon: UserCircle },
    { name: "Attendance", href: "/parent/attendance", icon: CalendarDays },
    { name: "Fees", href: "/parent/fees", icon: CreditCard },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-20 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-16 items-center px-4 justify-between max-w-7xl mx-auto w-full gap-4">
          <AppLogo href="/parent/dashboard" />

          <div className="flex items-center gap-3">
            {students.length > 0 && (
              <StudentSwitcher students={students} activeStudentId={activeStudentId} />
            )}
            <UserNav user={session.user} />
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center">
        <div className="max-w-7xl w-full px-4 md:px-8 py-6 pb-24 lg:pb-6">
          {children}
        </div>
      </div>

      {/* Bottom Nav for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t flex items-center justify-around px-6 z-30">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.name}</span>
          </Link>
        ))}
      </div>

      {/* Desktop sidebar nav */}
      <div className="hidden lg:flex fixed top-16 left-0 h-[calc(100vh-4rem)] w-56 border-r bg-background flex-col gap-1 p-4 z-10">
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
      </div>

      {/* Content offset for desktop sidebar */}
      <style>{`@media (min-width: 1024px) { .max-w-7xl { margin-left: 14rem !important; } }`}</style>
    </div>
  );
}
