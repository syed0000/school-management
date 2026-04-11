import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStudentFeeOverview } from "@/actions/parent";
import { FeeOverview } from "@/components/parent/fee-overview";

import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/locale-path";

export default async function ParentFeesPage({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect(withLocale(lang, "/parents/login"));
  if (session.user.role !== 'parent' && session.user.role !== 'admin') redirect(withLocale(lang, "/dashboard"));

  const cookieStore = await cookies();
  const activeStudentCookie = cookieStore.get('activeParentStudentId')?.value;
  const sessionStudentId = session.user.id;
  const targetStudentId = activeStudentCookie || sessionStudentId;

  // The server action now fetches the phone from the session internally.
  const feeData = await getStudentFeeOverview(targetStudentId);

  if (!feeData) {
    return (
      <div className="text-center py-16 max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold">Data not found</h2>
        <p className="text-muted-foreground mt-2">Unable to load fee overview for this student.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fee Overview</h1>
        <p className="text-muted-foreground">Detailed breakdown of paid fees and pending dues for the current academic session.</p>
      </div>
      
      <FeeOverview feeData={feeData} />
    </div>
  );
}
