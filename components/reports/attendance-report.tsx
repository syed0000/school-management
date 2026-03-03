'use client';

import { useState, useTransition, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { CalendarDateRangePicker } from '@/components/dashboard/date-range-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Search, FileSpreadsheet, FileText } from 'lucide-react';
import { getAttendanceReport } from '@/actions/reports';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import * as XLSX from 'xlsx';

interface AttendanceReportProps {
  classes: { id: string; name: string }[];
}

export default function AttendanceReport({ classes }: AttendanceReportProps) {
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [classId, setClassId] = useState('all');
  const [section, setSection] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  interface AttendanceSummary {
    totalWorkingDays: number;
    averageAttendance: number | string;
    totalPresent: number;
    totalAbsent: number;
  }

  interface DailyStat {
    date: string;
    percentage: string;
    present: number;
    total: number;
  }

  interface StudentReport {
    id: string;
    name: string;
    rollNumber: string;
    className: string;
    section: string;
    total: number;
    present: number;
    absent: number;
    percentage: string;
  }

  interface ReportData {
    summary: AttendanceSummary;
    dailyStats: DailyStat[];
    studentReport: StudentReport[];
  }

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchData = () => {
    if (!date?.from || !date?.to) return;

    startTransition(async () => {
      try {
        const data = await getAttendanceReport({
          startDate: date.from!,
          endDate: date.to!,
          classId: classId === 'all' ? undefined : classId,
          section: section === 'all' ? undefined : section,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setReportData(data as any);
      } catch (error) {
        console.error('Failed to fetch report:', error);
      }
    });
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    fetchData();
  };

  const filteredStudents = reportData?.studentReport?.filter((student) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (student.rollNumber && student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const handleExportExcel = () => {
    if (!reportData) return;

    const ws = XLSX.utils.json_to_sheet(filteredStudents.map((s) => ({
      'Name': s.name,
      'Roll No': s.rollNumber,
      'Class': s.className,
      'Section': s.section,
      'Total Days': s.total,
      'Present': s.present,
      'Absent': s.absent,
      'Percentage': s.percentage + '%',
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
    XLSX.writeFile(wb, `attendance_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const COLORS = ['#0088FE', '#FF8042', '#FFBB28', '#00C49F'];

  const pieData = reportData ? [
    { name: 'Present', value: reportData.summary.totalPresent },
    { name: 'Absent', value: reportData.summary.totalAbsent },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-end bg-muted/30 p-4 rounded-lg border print:hidden">
        <div className="w-full md:w-auto">
          <label className="text-sm font-medium mb-1 block">Date Range</label>
          <CalendarDateRangePicker date={date} setDate={setDate} className="w-full" />
        </div>

        <div className="w-full md:w-[180px]">
          <label className="text-sm font-medium mb-1 block">Class</label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger>
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-[120px]">
          <label className="text-sm font-medium mb-1 block">Section</label>
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {['A', 'B', 'C', 'D'].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-[200px]">
          <label className="text-sm font-medium mb-1 block">Search Student</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Name or Roll No..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Button onClick={handleSearch} disabled={isPending}>
          {isPending ? 'Loading...' : 'Generate Report'}
        </Button>
      </div>

      {/* Stats Cards */}
      {reportData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Working Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.summary.totalWorkingDays}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.summary.averageAttendance}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Present</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{reportData.summary.totalPresent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Absent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{reportData.summary.totalAbsent}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      {reportData && (
        <div className="grid gap-4 md:grid-cols-2 print:break-inside-avoid">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reportData.dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(str) => format(new Date(str), 'MMM dd')} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip labelFormatter={(str) => format(new Date(str), 'PPP')} />
                  <Line type="monotone" dataKey="percentage" stroke="#8884d8" name="Attendance %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overall Distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table & Actions */}
      <div className="space-y-4">
        <div className="flex justify-between items-center print:hidden">
          <h3 className="text-lg font-semibold">Student Details</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <FileText className="mr-2 h-4 w-4" />
              Print / PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roll No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="text-right">Total Days</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">Absent</TableHead>
                <TableHead className="text-right">Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                    No data found
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>{student.rollNumber || '-'}</TableCell>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.className}</TableCell>
                    <TableCell>{student.section}</TableCell>
                    <TableCell className="text-right">{student.total}</TableCell>
                    <TableCell className="text-right text-green-600">{student.present}</TableCell>
                    <TableCell className="text-right text-red-600">{student.absent}</TableCell>
                    <TableCell className="text-right font-bold">
                      <span className={
                        parseFloat(student.percentage) < 75 ? 'text-red-500' : 'text-green-600'
                      }>
                        {student.percentage}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
