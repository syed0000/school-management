"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        {/* Native app styled horizontal scroll for 10-12 classes */}
        <div className="flex overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 space-x-2">
          {classes.map((c) => {
            const val = `${c.classId}-${c.section}`;
            const isActive = activeTab === val;
            return (
              <button
                key={val}
                onClick={() => setActiveTab(val)}
                className={`flex-none snap-start relative flex flex-col items-start p-3 pr-8 rounded-xl border transition-all duration-200 min-w-[140px] text-left
                  ${isActive 
                    ? 'bg-primary text-primary-foreground border-primary shadow-md scale-100 ring-2 ring-primary ring-offset-2 ring-offset-background' 
                    : 'bg-card text-card-foreground border-border hover:border-primary/50 hover:bg-muted scale-95 opacity-80'}`}
              >
                <span className="text-sm font-bold tracking-tight mb-1">
                  {c.className}
                </span>
                <span className={`text-xs font-medium ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  Section {c.section}
                </span>

                <div className="flex gap-1 mt-2 flex-wrap">
                  {c.attendanceAccess && (
                    <div className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-green-300' : 'bg-green-500'}`} title="Attendance Access" />
                  )}
                  {c.feeAccess && (
                    <div className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-blue-300' : 'bg-blue-500'}`} title="Fee Access" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {classes.map((c) => {
          const val = `${c.classId}-${c.section}`;
          return (
            <TabsContent key={val} value={val} className="mt-4 outline-none">
              {currentClass && val === activeTab && (
                <div className="space-y-6">
                  <Tabs defaultValue="attendance" className="w-full">
                    <TabsList className={`grid w-full max-w-[400px] ${c.feeAccess ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      <TabsTrigger value="attendance" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">Daily Attendance</TabsTrigger>
                      {c.feeAccess && <TabsTrigger value="fees" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">Fee Reports</TabsTrigger>}
                    </TabsList>

                    <div className="mt-6">
                      <TabsContent value="attendance" className="outline-none m-0">
                        <ClassAttendanceTab
                          classId={c.classId}
                          section={c.section}
                          attendanceAccess={c.attendanceAccess}
                        />
                      </TabsContent>

                      {c.feeAccess && (
                        <TabsContent value="fees" className="outline-none m-0">
                          <ClassFeeTab
                            classId={c.classId}
                            section={c.section}
                          />
                        </TabsContent>
                      )}
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
