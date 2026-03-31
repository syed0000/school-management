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
import { getCurrentSessionRange } from '@/lib/utils';

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
  const [date, setDate] = useState<DateRange | undefined>(getCurrentSessionRange());
  const [classId, setClassId] = useState('all');
  const [section, setSection] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  interface AttendanceSummary {
    totalDays: number;
    totalWorkingDays: number;
    totalHolidays: number;
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
    totalDays: number;
    workingDays: number;
    holidays: number;
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
      'Work Days': s.workingDays,
      'Holidays': s.holidays,
      'Total Days': s.totalDays,
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

  // Group students by class and section for consolidated view
  const groupedStudents = filteredStudents.reduce((acc, student) => {
    const key = `${student.className} - ${student.section}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(student);
    return acc;
  }, {} as Record<string, StudentReport[]>);

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-report, #printable-report * {
            visibility: visible;
          }
          #printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto !important;
            overflow: visible !important;
          }
          .relative.overflow-auto.max-h-\[65vh\] {
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
          }
          thead {
            display: table-header-group !important;
            position: static !important;
          }
          th, td {
            background-color: transparent !important;
            color: black !important;
          }
          .print-hidden {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
          }
        }
      `}</style>

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
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 print:hidden">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Range Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.summary.totalDays}</div>
                <p className="text-xs text-muted-foreground">Calendar Days</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Working Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{reportData.summary.totalWorkingDays}</div>
                <p className="text-xs text-muted-foreground">Actual School Days</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Holidays</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{reportData.summary.totalHolidays}</div>
                <p className="text-xs text-muted-foreground">Incl. Sundays</p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-3 print:hidden mt-4">
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
        </div>
      )}

      {/* Charts */}
      {reportData && (
        <div className="grid gap-4 md:grid-cols-2 print:hidden">
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
      <div id="printable-report" className="space-y-8">
        <div className="flex justify-between items-center print:border-b-2 print:pb-2">
          <div className="flex flex-col">
            <h3 className="text-lg font-bold">Attendance Consolidated Report</h3>
            <p className="text-sm text-muted-foreground print:text-black">
              Period: {date?.from ? format(date.from, 'PP') : ''} - {date?.to ? format(date.to, 'PP') : ''}
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
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

        {Object.keys(groupedStudents).length === 0 ? (
          <div className="text-center py-10 border rounded-lg text-muted-foreground">
            No attendance data found for the selected criteria
          </div>
        ) : (
          Object.entries(groupedStudents).map(([groupKey, students], index) => (
            <div key={groupKey} className={index > 0 ? "page-break mt-8" : ""}>
              <div className="bg-muted/50 p-3 border-x border-t rounded-t-lg flex flex-wrap items-center justify-between gap-4">
                <div className="font-bold text-base flex items-center gap-2">
                  <span className="text-muted-foreground font-normal text-xs uppercase tracking-wider">Class:</span> {groupKey}
                </div>
                <div className="flex gap-4 text-xs font-medium">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-muted-foreground uppercase">Range Days</span>
                    <span className="font-bold">{students[0].totalDays || reportData?.summary.totalDays}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-muted-foreground uppercase">Work Days</span>
                    <span className="font-bold text-green-600">{students[0].workingDays || reportData?.summary.totalWorkingDays}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-muted-foreground uppercase">Holidays</span>
                    <span className="font-bold text-orange-600">{students[0].holidays || reportData?.summary.totalHolidays}</span>
                  </div>
                </div>
              </div>
              <div className="border rounded-b-md relative overflow-auto max-h-[65vh]">
                <table className="w-full text-sm border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20 bg-background shadow-sm">
                    <tr className="border-b">
                      <th className="p-2 border-x border-b bg-background text-left w-[80px]">Roll No</th>
                      <th className="p-2 border-x border-b bg-background text-left z-20">Student Name</th>
                      <th className="p-2 border-x border-b bg-background text-right">Present</th>
                      <th className="p-2 border-x border-b bg-background text-right">Absent</th>
                      <th className="p-2 border-x border-b bg-background text-right">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card">
                    {students.map((student) => (
                      <tr key={student.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-2 border-x border-b">{student.rollNumber || '-'}</td>
                        <td className="p-2 font-medium border-x border-b z-20">{student.name}</td>
                        <td className="p-2 text-right text-green-600 font-medium border-x border-b">{student.present}</td>
                        <td className="p-2 text-right text-red-600 font-medium border-x border-b">{student.absent}</td>
                        <td className="p-2 text-right font-bold border-x border-b">
                          <span className={parseFloat(student.percentage) < 75 ? 'text-red-600' : 'text-green-700'}>
                            {student.percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
