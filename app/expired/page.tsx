"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function ExpiredPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRefresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/license/refresh", {
        method: "POST",
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success("License refreshed successfully!");
        router.push("/dashboard"); // Or back to previous page
      } else {
        toast.error(data.error || "License is still expired. Please contact support.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to refresh license.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-red-600">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold">License Expired</CardTitle>
          <CardDescription>
            your institute&apos;s license has expired. Please contact FeeEase support to renew your subscription.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 p-4 rounded-md border border-red-100 text-sm text-red-800">
            <p className="font-semibold mb-1">Why am I seeing this?</p>
            <p>Your subscription period has ended. Access to the application is restricted until the license is renewed.</p>
          </div>
          
          <Button onClick={handleRefresh} className="w-full" disabled={loading}>
            {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh License Status
          </Button>
          
          <div className="text-center text-xs text-slate-500 mt-4">
            If you have already renewed, click Refresh.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
