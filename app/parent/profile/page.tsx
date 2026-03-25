import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStudentProfileForParent } from "@/actions/parent";
import { StudentProfileCard } from "@/components/parent/student-profile-card";
import dbConnect from "@/lib/db";
import Student from "@/models/Student";

type SearchParams = Promise<{ studentId?: string }>;

export default async function ParentProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login/otp");
  if (session.user.role !== 'parent' && session.user.role !== 'admin') redirect("/dashboard");

  const { studentId: queryStudentId } = await searchParams;
  const sessionStudentId = session.user.id;
  const targetStudentId = queryStudentId || sessionStudentId;

  await dbConnect();
  const student = await Student.findById(sessionStudentId).select('contacts').lean() as { contacts?: { mobile?: string[] } } | null;
  const phone = student?.contacts?.mobile?.[0] ?? "";

  const profile = await getStudentProfileForParent(targetStudentId, phone);

  if (!profile) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold">Profile not found</h2>
        <p className="text-muted-foreground mt-2">Unable to load student profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Student Profile</h1>
      <StudentProfileCard profile={profile} />
    </div>
  );
}
