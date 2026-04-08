"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTeacherClassFeeReport } from "@/actions/teacher-portal";
import { CalendarDateRangePicker } from "@/components/dashboard/date-range-picker";
import { formatCurrency, getCurrentSessionRange } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Search, FileDown, Clock, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

interface ClassFeeTabProps {
  classId: string;
  section: string;
}

// Ensure accurate match with FeeReportData structure
interface StudentFeeRecord {
  id: string;
  name: string;
  rollNumber?: string;
  className: string;
  section: string;
  period: string;
  expectedPeriod: number;
  collectedPeriod: number;
  dueAmount: number;
  photo?: string;
  feeStatuses: Record<string, { status: string; date?: string }>;
}

interface FeeReportData {
  summary: {
    totalExpected: number;
    totalCollected: number;
    totalPending: number;
    collectionRate: string | number;
  };
  trend: Record<string, unknown>[];
  studentReport: StudentFeeRecord[];
}

export function ClassFeeTab({ classId, section }: ClassFeeTabProps) {
  const [date, setDate] = useState<DateRange | undefined>(getCurrentSessionRange());
  const [searchQuery, setSearchQuery] = useState("");
  const [reportData, setReportData] = useState<FeeReportData | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!date?.from || !date?.to) return;

    startTransition(async () => {
      try {
        const res = await getTeacherClassFeeReport(classId, section, date.from!, date.to!);
        if (res?.success && res.data) {
          setReportData(res.data as unknown as FeeReportData);
        } else {
          toast.error(res?.error || "Failed to load fee report");
        }
      } catch {
        toast.error("An error occurred");
      }
    });
  }, [classId, section, date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredStudents = reportData?.studentReport.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const handleExportExcel = () => {
    if (!reportData) return;

    const ws = XLSX.utils.json_to_sheet(
      filteredStudents.map((s) => ({
        "Name": s.name,
        "Roll No": s.rollNumber || "-",
        "Expected": s.expectedPeriod,
        "Paid": s.collectedPeriod,
        "Due": s.dueAmount,
        "Status": s.dueAmount <= 0 ? "Paid" : "Due",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Class Fees");
    XLSX.writeFile(wb, `fee_report_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0 flex-wrap gap-4">
        <CardTitle className="text-xl">Class Fee Report</CardTitle>
        <div className="flex items-center gap-3">
          <CalendarDateRangePicker date={date} setDate={setDate} />
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isPending || filteredStudents.length === 0}>
            <FileDown className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
           <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 flex flex-col items-center justify-center">
             <div className="text-xs font-medium text-blue-600 mb-1">Expected Focus</div>
             <div className="text-xl font-bold text-blue-700">{formatCurrency(reportData?.summary?.totalExpected || 0)}</div>
           </div>
           <div className="p-4 rounded-lg bg-green-50 border border-green-100 flex flex-col items-center justify-center">
             <div className="text-xs font-medium text-green-600 mb-1">Total Collected</div>
             <div className="text-xl font-bold text-green-700">{formatCurrency(reportData?.summary?.totalCollected || 0)}</div>
           </div>
           <div className="p-4 rounded-lg bg-red-50 border border-red-100 flex flex-col items-center justify-center">
             <div className="text-xs font-medium text-red-600 mb-1">Total Due</div>
             <div className="text-xl font-bold text-red-700">{formatCurrency(reportData?.summary?.totalPending || 0)}</div>
           </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or roll no..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isPending ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground border rounded-lg">
            No fee records found for this period.
          </div>
        ) : (
          <div className="border rounded-md w-full">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-4 py-3 min-w-[150px]">Student Name</th>
                  <th className="px-4 py-3 text-right">Expected</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3 w-[100px] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{student.name}</div>
                      {student.rollNumber && <div className="text-xs text-muted-foreground">Roll: {student.rollNumber}</div>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(student.expectedPeriod)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                          <span className="font-medium tabular-nums">{formatCurrency(student.collectedPeriod)}</span>
                        </div>
                        {Object.values(student.feeStatuses).some(s => s.status === 'paid') && (
                          <div className="text-[10px] text-muted-foreground italic mt-0.5">
                            {(() => {
                              const paidDates = Object.values(student.feeStatuses)
                                .filter(s => s.status === 'paid' && s.date)
                                .map(s => s.date);
                              if (paidDates.length === 1) return `Paid on: ${paidDates[0]}`;
                              if (paidDates.length > 1) return `${paidDates.length} payments, last: ${paidDates[paidDates.length-1]}`;
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        <span className="font-medium text-red-600 tabular-nums">{formatCurrency(student.dueAmount)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-medium leading-none ${
                        student.dueAmount <= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {student.dueAmount <= 0 ? "Paid" : "Due"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
