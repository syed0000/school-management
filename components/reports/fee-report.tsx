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
import { formatNumber, getCurrentSessionRange } from '@/lib/utils';
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
  feeStatuses: Record<string, string>;
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
  const [date, setDate] = useState<DateRange | undefined>(getCurrentSessionRange());
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

    // Get all unique monthly/fee headers
    const allHeaders = Array.from(new Set(filteredStudents.flatMap(s => Object.keys(s.feeStatuses))));

    const ws = XLSX.utils.json_to_sheet(filteredStudents.map((s) => {
      const row: any = {
        'Name': s.name,
        'Roll No': s.rollNumber,
        'Class': s.className,
        'Section': s.section,
        'Expected': s.expectedPeriod,
        'Paid': s.collectedPeriod,
        'Pending': s.dueAmount,
        'Status': s.status,
      };
      allHeaders.forEach(h => {
        row[h] = s.feeStatuses[h] === 'paid' ? 'Paid' : 'Unpaid';
      });
      return row;
    }));

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

  // Extract all fee headers across all students to build a full register
  const feeHeaders = Array.from(new Set(filteredStudents.flatMap(s => Object.keys(s.feeStatuses)))).sort((a, b) => {
    // Sort logic to keep Admission/Registration first, then months, then Exams
    const order = (h: string) => {
      if (h.includes("Admission") || h.includes("Registration")) return 0;
      if (/\d{4}/.test(h)) return 1; // Month YYYY
      return 2; // Exams
    };
    return order(a) - order(b);
  });

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
          }
          .relative.overflow-auto.max-h-\[70vh\] {
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          thead {
            display: table-header-group !important;
            position: static !important;
          }
          th, td {
            position: static !important;
            background-color: transparent !important;
            color: black !important;
            border: 1px solid #ddd !important;
          }
          .print-hidden {
            display: none !important;
          }
        }
      `}</style>

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 print:hidden">
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
        <div className="grid gap-4 md:grid-cols-2 print:hidden">
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
      <div id="printable-report" className="space-y-4">
        <div className="flex justify-between items-center print:border-b-2 print:pb-2 print:mb-4">
          <div className="flex flex-col">
            <h3 className="text-lg font-bold">Fee Register Report</h3>
            <p className="text-sm text-muted-foreground print:text-black">
              Period: {date?.from ? format(date.from, 'PP') : ''} - {date?.to ? format(date.to, 'PP') : ''}
              {classId !== 'all' ? ` | Class: ${classes.find(c => c.id === classId)?.name}` : ''}
              {section !== 'all' ? ` | Section: ${section}` : ''}
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

        <div className="rounded-md border print:border-0 relative overflow-auto max-h-[70vh]">
          <table className="w-full text-xs border-separate border-spacing-0 print:border-collapse">
            <thead className="sticky top-0 z-20 bg-background shadow-sm">
              <tr className="border-b-2">
                <th className="p-2 font-bold border-x border-b bg-background text-left sticky left-0 z-10 w-[60px]">Roll</th>
                <th className="p-2 font-bold border-x border-b bg-background text-left sticky left-[60px] z-10 w-[150px]">Student Name</th>
                {feeHeaders.map((header) => (
                  <th key={header} className="p-2 text-center font-bold px-1 whitespace-nowrap min-w-[70px] border-x border-b bg-background">
                    {header}
                  </th>
                ))}
                <th className="p-2 text-right font-bold w-[80px] border-x border-b bg-background whitespace-nowrap">Pending</th>
                <th className="p-2 text-right font-bold w-[60px] print:hidden border-x border-b bg-background whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={feeHeaders.length + 4} className="p-4 text-center h-24 text-muted-foreground border-b">
                    No records found
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b hover:bg-muted/30 transition-colors group">
                    <td className="p-2 font-medium border-x border-b bg-background sticky left-0 z-5 group-hover:bg-muted/50">{student.rollNumber || '-'}</td>
                    <td className="p-2 font-semibold border-x border-b bg-background sticky left-[60px] z-5 group-hover:bg-muted/50">{student.name}</td>
                    {feeHeaders.map((header) => {
                      const status = student.feeStatuses[header];
                      return (
                        <td key={header} className="p-1 text-center border-x border-b">
                          <div className="flex items-center justify-center w-full h-full min-h-[40px]">
                            {status === 'paid' ? (
                              <div className="w-5 h-5 bg-green-500 rounded flex items-center justify-center text-white shadow-sm">
                                <span className="text-[10px] font-bold">✓</span>
                              </div>
                            ) : status === 'unpaid' ? (
                                <div className="w-5 h-5 border-2 border-slate-300 rounded bg-white/50"></div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className={`p-2 text-right font-bold border-x border-b ${student.dueAmount > 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {student.dueAmount > 0 ? `₹${formatNumber(student.dueAmount)}` : 'Nil'}
                    </td>
                    <td className="p-2 text-right print:hidden border-x border-b">
                      <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow-sm ${student.status === 'Paid' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                        }`}>
                        {student.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
