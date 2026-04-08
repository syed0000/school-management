import { getAttendanceReport } from "@/actions/attendance-report";
import { getClassesForAttendance } from "@/actions/attendance";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AttendanceContent } from "@/components/attendance/attendance-content";

export default async function AttendanceDashboard() {
  const session = await getServerSession(authOptions);
  
  const history = await getAttendanceReport({});
  
  const classes = await getClassesForAttendance();
  
  const isAttendanceStaff = session?.user.role === 'attendance_staff';
  const isAdmin = session?.user.role === 'admin';

  return (
    <AttendanceContent
      initialHistory={history}
      classes={classes}
      isAdmin={isAdmin}
      isAttendanceStaff={isAttendanceStaff}
    />
  );
}
