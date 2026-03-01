import dbConnect from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getStaffDashboardStats } from "@/actions/dashboard"
import { StaffDashboardContent } from "@/components/dashboard/staff-dashboard-content"

export default async function StaffDashboardPage() {
  await dbConnect();
  const session = await getServerSession(authOptions);
  
  if (!session) return null;

  const stats = await getStaffDashboardStats(session.user.id);

  return (
    <StaffDashboardContent stats={stats} />
  )
}
