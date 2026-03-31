"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, UserCircle, CalendarDays, CreditCard, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Home", href: "/parent/dashboard", icon: Home },
  { name: "Attendance", href: "/parent/attendance", icon: CalendarDays },
  { name: "Fees", href: "/parent/fees", icon: CreditCard },
  { name: "Profile", href: "/parent/profile", icon: UserCircle },
  { name: "Share", href: "/share", icon: Share2 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex h-20 items-center justify-around border-t bg-background/95 pb-safe backdrop-blur-md transition-all duration-300 md:h-24 lg:justify-center">
      <div className="flex w-full items-center justify-around max-w-md mx-auto lg:max-w-lg lg:gap-12">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group relative flex flex-col items-center gap-1.5 px-3 py-1 transition-all duration-300 active:scale-95 shrink-0"
            >
              <div
                className={cn(
                  "flex items-center justify-center p-2 rounded-2xl transition-all duration-300",
                  isActive ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110" : "text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-6 w-6", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
              </div>
              {isActive && (<span
                className={cn(
                  "text-[10px] sm:text-[11px] font-semibold transition-all duration-300",
                  isActive ? "text-primary opacity-100 translate-y-0" : "text-muted-foreground opacity-70 group-hover:opacity-100"
                )}
              >
                {item.name}
              </span>)}
              {/* {isActive && (
                <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-primary" />
              )} */}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
