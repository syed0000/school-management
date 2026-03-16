import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/dashboard/user-nav";
import Image from "next/image";
import { X, Home, BookOpen, CreditCard, Bell } from "lucide-react";
import { schoolConfig } from "@/lib/config";
import Link from "next/link";
import { cn } from "@/lib/utils";

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

  const navItems = [
    { name: "Home", href: "/parent/dashboard", icon: Home },
    { name: "Academics", href: "/parent/academics", icon: BookOpen },
    { name: "Fees", href: "/parent/fees", icon: CreditCard },
    { name: "Notifications", href: "/parent/notifications", icon: Bell },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-20 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-16 items-center px-4 justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
             <div className="relative h-8 w-24 md:h-10 md:w-32 flex items-center justify-center rounded-md overflow-hidden">
                <Image 
                  src="/feeEasyLogo.png" 
                  alt="feeEase" 
                  fill
                  className="object-contain p-1"
                  priority
                />
             </div>
             <X className="h-4 w-4 text-purple-600 font-bold stroke-3" />
             <div className="font-bold text-lg tracking-tight">
                Parent Portal
             </div>
          </div>
          <div className="flex items-center space-x-4">
            <UserNav user={session.user} />
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center">
        <div className="max-w-7xl w-full px-4 md:px-8 py-6">
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
      
      {/* Spacer for bottom nav */}
      <div className="h-16 lg:hidden" />
    </div>
  );
}
