"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ClassAttendanceTab } from "./class-attendance-tab";
import { ClassFeeTab } from "./class-fee-tab";
import type { TeacherClassAccess } from "@/types";

interface TeacherClassTabsProps {
  classes: TeacherClassAccess[];
}

export function TeacherClassTabs({ classes }: TeacherClassTabsProps) {
  const [activeTab, setActiveTab] = useState(classes[0]?.classId + "-" + classes[0]?.section);

  if (classes.length === 0) return null;

  const currentClass = classes.find((c) => `${c.classId}-${c.section}` === activeTab);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:px-0 md:mx-0">
          <TabsList className="h-auto p-1 bg-muted/50 w-full justify-start inline-flex min-w-max">
            {classes.map((c) => {
              const val = `${c.classId}-${c.section}`;
              return (
                <TabsTrigger
                  key={val}
                  value={val}
                  className="px-4 py-2 gap-2 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary"
                >
                  <span className="font-semibold whitespace-nowrap">
                    {c.className} – Section {c.section}
                  </span>
                  {c.attendanceAccess && (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                      Attendance ✓
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {classes.map((c) => {
          const val = `${c.classId}-${c.section}`;
          return (
            <TabsContent key={val} value={val} className="mt-4 outline-none">
              {currentClass && val === activeTab && (
                <div className="space-y-6">
                  <Tabs defaultValue="attendance" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                      <TabsTrigger value="attendance">Daily Attendance</TabsTrigger>
                      <TabsTrigger value="fees">Fee Reports</TabsTrigger>
                    </TabsList>

                    <div className="mt-6">
                      <TabsContent value="attendance" className="outline-none m-0">
                        <ClassAttendanceTab
                          classId={c.classId}
                          section={c.section}
                          attendanceAccess={c.attendanceAccess}
                        />
                      </TabsContent>

                      <TabsContent value="fees" className="outline-none m-0">
                        <ClassFeeTab
                          classId={c.classId}
                          section={c.section}
                        />
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
