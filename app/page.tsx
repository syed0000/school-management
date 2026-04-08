import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { schoolConfig } from "@/lib/config";
import dbConnect from "@/lib/db";
import License from "@/models/License";
import User from "@/models/User";

export const dynamic = 'force-dynamic';

async function checkInitialization() {
    try {
        await dbConnect();
        const license = await License.findOne({});
        const admin = await User.findOne({ role: 'admin' });
        
        return !!(license && admin);
    } catch (e) {
        console.error("Failed to check initialization:", e);
        return false;
    }
}

export default async function Home() {
  const initialized = await checkInitialization();
  
  if (!initialized) {
      redirect("/activate");
  }

  const session = await getServerSession(authOptions);

  if (session) {
    if (session.user.isDemo) {
      redirect("/demo/access-as");
    }
    if (session.user.role === "admin") {
      redirect("/admin/dashboard");
    } else if (session.user.role === "attendance_staff") {
      redirect("/attendance/dashboard");
    } else {
      redirect("/dashboard");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 gap-4">
      <h1 className="text-4xl font-bold tracking-tight">{schoolConfig.name}</h1>
      <p className="text-muted-foreground">Management System</p>
      <div className="flex gap-4 mt-8">
        <Button asChild variant="default">
          <Link href="/login">Staff Login</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/login">Admin Login</Link>
        </Button>
      </div>
    </div>
  );
}
