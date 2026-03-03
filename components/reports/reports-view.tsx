'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AttendanceReport from './attendance-report';
import FeeReport from './fee-report';
import { BackButton } from "@/components/ui/back-button";

interface ReportsViewProps {
  classes: { id: string; name: string }[];
}

export default function ReportsView({ classes }: ReportsViewProps) {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <BackButton />
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Reports & Analytics</h2>
      </div>
      
      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="attendance">Attendance Reports</TabsTrigger>
          <TabsTrigger value="fees">Fee Reports</TabsTrigger>
        </TabsList>
        
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Reporting</CardTitle>
              <CardDescription>
                Analyze student attendance trends, daily stats, and individual records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AttendanceReport classes={classes} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="fees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fee Reporting</CardTitle>
              <CardDescription>
                Track fee collections, pending dues, and financial summaries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FeeReport classes={classes} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
