import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTeacherById } from "@/actions/teacher";
import { TeacherProfileClient } from "@/components/teacher/teacher-profile-client";
import type { Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/locale-path";

export const dynamic = "force-dynamic";

export default async function TeacherProfilePage({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await params;
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect(withLocale(lang, "/login/otp"));
  }

  // Ensure only 'teacher' users can view this (admins can view their own but they use the admin dashboard)
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    redirect(withLocale(lang, "/dashboard"));
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
