"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import type { StudentFeeOverview } from "@/types";

interface FeeOverviewProps {
  feeData: StudentFeeOverview;
}

export function FeeOverview({ feeData }: FeeOverviewProps) {
  const { totalExpected, totalPaid, totalDue, monthlyBreakdown, otherFees } = feeData;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{formatCurrency(totalExpected)}</div>
            <div className="text-xs text-blue-600 font-medium mt-1">Total Expected</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{formatCurrency(totalPaid)}</div>
            <div className="text-xs text-green-600 font-medium mt-1">Total Paid</div>
          </CardContent>
        </Card>
        <Card className={totalDue > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
          <CardContent className="p-4 text-center">
            <div className={`text-2xl font-bold ${totalDue > 0 ? "text-red-700" : "text-green-700"}`}>
              {formatCurrency(totalDue)}
            </div>
            <div className={`text-xs font-medium mt-1 ${totalDue > 0 ? "text-red-600" : "text-green-600"}`}>
              {totalDue > 0 ? "Total Due" : "All Clear ✓"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Fee Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Monthly Fee Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {monthlyBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No monthly fee data</p>
          ) : (
            <div className="space-y-2">
              {monthlyBreakdown.map((entry) => (
                <div
                  key={`${entry.month}-${entry.year}`}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {entry.status === "Paid" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : entry.status === "Partial" ? (
                      <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium">
                      {entry.monthName} {entry.year}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-muted-foreground">
                        Paid: <span className="text-green-600 font-medium">{formatCurrency(entry.paid)}</span>
                      </div>
                      {entry.due > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Due: <span className="text-red-600 font-medium">{formatCurrency(entry.due)}</span>
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={entry.status === "Paid" ? "default" : entry.status === "Partial" ? "secondary" : "destructive"}
                      className="text-[10px] px-2"
                    >
                      {entry.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Fees */}
      {otherFees.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Other Fees</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {otherFees.map((fee, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {fee.due <= 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium">{fee.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-muted-foreground">
                        Paid: <span className="text-green-600 font-medium">{formatCurrency(fee.paid)}</span>
                      </div>
                      {fee.due > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Due: <span className="text-red-600 font-medium">{formatCurrency(fee.due)}</span>
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={fee.due <= 0 ? "default" : "destructive"}
                      className="text-[10px] px-2"
                    >
                      {fee.due <= 0 ? "Paid" : "Due"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
