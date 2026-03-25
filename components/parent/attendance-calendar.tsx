"use client";

import { useState, useMemo } from "react";
import { format, getDaysInMonth, startOfMonth, getDay, addMonths, subMonths, isToday } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AttendanceCalendarEntry, AttendanceStatus } from "@/types";

interface AttendanceCalendarProps {
  entries: AttendanceCalendarEntry[];
  summary: { present: number; absent: number; holiday: number; total: number };
  onMonthChange?: (month: number, year: number) => void;
  loading?: boolean;
}

const STATUS_STYLES: Record<NonNullable<AttendanceStatus>, string> = {
  Present: "bg-green-500 text-white font-bold",
  Absent: "bg-red-500 text-white font-bold",
  Holiday: "bg-yellow-400 text-yellow-900 font-bold",
};

const STATUS_LABEL: Record<NonNullable<AttendanceStatus>, string> = {
  Present: "Present",
  Absent: "Absent",
  Holiday: "Holiday",
};

export function AttendanceCalendar({ entries, summary, onMonthChange, loading = false }: AttendanceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const month = currentDate.getMonth() + 1; // 1–12
  const year = currentDate.getFullYear();

  // Build map: "yyyy-MM-dd" → status
  const statusMap = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    entries.forEach((e) => map.set(e.date, e.status));
    return map;
  }, [entries]);

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfWeek = getDay(startOfMonth(currentDate)); // 0 = Sunday

  const navigate = (dir: "prev" | "next") => {
    const next = dir === "next" ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
    setCurrentDate(next);
    onMonthChange?.(next.getMonth() + 1, next.getFullYear());
  };

  const days: (number | null)[] = [
    ...Array<null>(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const attendancePct = summary.total > 0
    ? Math.round((summary.present / summary.total) * 100)
    : null;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Present", value: summary.present, color: "text-green-600 bg-green-50 border-green-200" },
          { label: "Absent", value: summary.absent, color: "text-red-600 bg-red-50 border-red-200" },
          { label: "Holiday", value: summary.holiday, color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
          { label: "Attendance", value: attendancePct !== null ? `${attendancePct}%` : "—", color: attendancePct !== null && attendancePct < 75 ? "text-red-600 bg-red-50 border-red-200" : "text-primary bg-primary/5 border-primary/20" },
        ].map((s) => (
          <Card key={s.label} className={cn("border", s.color)}>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-xs mt-0.5 font-medium">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {format(currentDate, "MMMM yyyy")}
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Day labels */}
          <div className="grid grid-cols-7 mb-2">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} />;
                }
                const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const status = statusMap.get(dateStr) ?? null;
                const todayHighlight = isToday(new Date(year, month - 1, day));

                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "aspect-square flex flex-col items-center justify-center rounded-md text-xs transition-all relative",
                      status ? STATUS_STYLES[status] : "bg-muted/40 text-muted-foreground",
                      todayHighlight && !status && "ring-2 ring-primary ring-offset-1 bg-primary/10 text-primary font-bold",
                      todayHighlight && status && "ring-2 ring-white ring-offset-1",
                    )}
                    title={status ? STATUS_LABEL[status] : "Not marked"}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex gap-4 mt-4 flex-wrap text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-green-500 inline-block" /> Present
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-red-500 inline-block" /> Absent
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-yellow-400 inline-block" /> Holiday
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-muted-foreground/30 inline-block" /> Not marked
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
