"use client";

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
import { getFeeReport } from '@/actions/reports';
import { formatNumber } from '@/lib/utils';
import {
  BarChart,
  Bar,
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

interface FeeSummary {
  totalCollected: number;
  totalExpected: number;
  totalPending: number;
  collectionRate: string;
}

interface FeeTrend {
  date: string;
  amount: number;
}

interface StudentFeeReport {
  id: string;
  name: string;
  rollNumber: string;
  className: string;
  section: string;
  collectedPeriod: number;
  expectedPeriod: number;
  dueAmount: number;
  period: string;
  status: string;
}

interface FeeReportData {
  summary: FeeSummary;
  trend: FeeTrend[];
  studentReport: StudentFeeReport[];
}

interface FeeReportProps {
  classes: { id: string; name: string }[];
}

export default function FeeReport({ classes }: FeeReportProps) {
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [classId, setClassId] = useState('all');
  const [section, setSection] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [reportData, setReportData] = useState<FeeReportData | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchData = () => {
    if (!date?.from || !date?.to) return;

    startTransition(async () => {
      try {
        const data = await getFeeReport({
          startDate: date.from!,
          endDate: date.to!,
          classId: classId === 'all' ? undefined : classId,
          section: section === 'all' ? undefined : section,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setReportData(data as any);
      } catch (error) {
        console.error('Failed to fetch fee report:', error);
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
      'Due Period': s.period,
      'Expected': s.expectedPeriod,
      'Paid': s.collectedPeriod,
      'Pending': s.dueAmount,
      'Status': s.status,
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fee Report");
    XLSX.writeFile(wb, `fee_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const COLORS = ['#00C49F', '#FF8042'];

  const pieData = reportData ? [
    { name: 'Paid', value: reportData.studentReport.filter((s) => s.status === 'Paid').length },
    { name: 'Due', value: reportData.studentReport.filter((s) => s.status === 'Due').length },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-end bg-muted/30 p-4 rounded-lg border print:hidden">
        <div className="w-full md:w-auto">
          <label className="text-sm font-medium mb-1 block">Period</label>
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
              <CardTitle className="text-sm font-medium">Collected (Period)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{formatNumber(reportData.summary?.totalCollected || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expected (Period)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">₹{formatNumber(reportData.summary?.totalExpected || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Dues (Period)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">₹{formatNumber(reportData.summary?.totalPending || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collection Rate (Period)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{(reportData.summary?.collectionRate || 0)}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      {reportData && (
        <div className="grid gap-4 md:grid-cols-2 print:break-inside-avoid">
          <Card>
            <CardHeader>
              <CardTitle>Collection Trend (Daily)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(str) => format(new Date(str), 'MMM dd')} />
                  <YAxis />
                  <Tooltip labelFormatter={(str) => format(new Date(str), 'PPP')} formatter={(value) => `₹${value}`} />
                  <Bar dataKey="amount" fill="#0088FE" name="Collected" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Status Distribution</CardTitle>
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
          <h3 className="text-lg font-semibold">Fee Details</h3>
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
                <TableHead className="text-left">Due Period</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Status</TableHead>
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
                    <TableCell className="text-left text-sm max-w-[80px] truncate" title={student.period}>
                      {student.period}
                    </TableCell>
                    <TableCell className="text-right">₹{formatNumber(student.expectedPeriod || 0)}</TableCell>
                    <TableCell className="text-right">₹{formatNumber(student.collectedPeriod || 0)}</TableCell>
                    <TableCell className={`text-right ${student.dueAmount ? 'text-red-600' : ''}`}>₹{formatNumber(student.dueAmount || 0)}</TableCell>
                    <TableCell className="text-right font-bold">
                      <span className={
                        student.status === 'Due' ? 'text-red-500 bg-red-50 px-2 py-1 rounded' : 'text-green-600 bg-green-50 px-2 py-1 rounded'
                      }>
                        {student.status}
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
