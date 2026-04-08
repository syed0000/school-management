import dbConnect from "@/lib/db"
import User from "@/models/User"
import Student from "@/models/Student"
import { getDashboardStats, getAttendanceStats } from "@/actions/dashboard"
import { getClasses } from "@/actions/student"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { getCurrentSessionRange } from "@/lib/utils"

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  await dbConnect();

  // Basic stats (global)
  const totalStaff = await User.countDocuments({ role: 'staff' });
  const totalStudents = await Student.countDocuments({ isActive: true });
  
  // Initial Filtered stats (Defaults matching client state)
  const { from: startDate, to: endDate } = getCurrentSessionRange();
  const classId = "all";
  
  const stats = await getDashboardStats({ startDate, endDate, classId });
  const attendanceStats = await getAttendanceStats();
  const classes = await getClasses();

  return (
    <DashboardContent 
        initialStats={stats}
        attendanceStats={attendanceStats}
        classes={classes}
        totalStaff={totalStaff}
        totalStudents={totalStudents}
    />
  )
}
