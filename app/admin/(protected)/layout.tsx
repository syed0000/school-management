import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/dashboard/user-nav";
import { MainNav } from "@/components/dashboard/main-nav";
import Image from "next/image";
import { X } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="flex h-16 items-center px-4 justify-between">
          <div className="flex items-center gap-3">
             <div className="relative h-10 w-32 flex items-center justify-center rounded-md overflow-hidden">
                <Image 
                  src="/feeEasyLogo.png" 
                  alt="feeEase" 
                  fill
                  className="object-contain p-1"
                  priority
                />
             </div>
             <X className="h-5 w-5 text-purple-600 font-bold stroke-[3]" />
             <div className="font-bold text-xl tracking-tight">
                Modern Nursery School
             </div>
          </div>
          <div className="flex items-center space-x-4">
            <UserNav user={session.user} />
          </div>
        </div>
        <div className="border-t px-4 py-2 overflow-x-auto">
          <MainNav role="admin" />
        </div>
      </header>
      <main className="flex-1 space-y-4 p-8 pt-6">
        {children}
      </main>
    </div>
  );
}
