import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/dashboard/user-nav";
import { MainNav } from "@/components/dashboard/main-nav";
import Image from "next/image";
import { X } from "lucide-react";

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
                Modern Nursery School
             </div>
          </div>
          <MainNav className="mx-6" role="staff" />
          <div className="ml-auto flex items-center space-x-4">
            <UserNav user={session.user} />
          </div>
        </div>
      </header>
      <main className="flex-1 space-y-4 p-8 pt-6">
        {children}
      </main>
    </div>
  );
}
