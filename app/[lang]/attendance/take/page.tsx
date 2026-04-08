import { AttendanceForm } from "@/components/attendance/attendance-form";
import { getClassesForAttendance } from "@/actions/attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TakeAttendancePage() {
  const classes = await getClassesForAttendance();

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Take Attendance</h2>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Mark Student Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceForm initialClasses={classes} />
        </CardContent>
      </Card>
    </div>
  );
}
