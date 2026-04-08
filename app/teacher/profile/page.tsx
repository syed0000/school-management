import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTeacherById } from "@/actions/teacher";
import { TeacherProfileClient } from "@/components/teacher/teacher-profile-client";

export const dynamic = "force-dynamic";

export default async function TeacherProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login/otp");
  }

  // Ensure only 'teacher' users can view this (admins can view their own but they use the admin dashboard)
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    redirect("/dashboard");
  }

  // Fetch the current teacher's full profile
  const teacher = await getTeacherById(session.user.id);

  if (!teacher) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center space-y-2 text-muted-foreground p-8 rounded-xl border bg-muted/20">
          <p className="font-semibold text-foreground">Profile not found</p>
          <p className="text-sm">We couldn&apos;t locate your profile details.</p>
        </div>
      </div>
    );
  }

  return <TeacherProfileClient teacher={teacher} />;
}
