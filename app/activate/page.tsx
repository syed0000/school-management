"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Key } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function ActivatePage() {
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Check if already activated
  useEffect(() => {
    async function checkStatus() {
      try {
        const { checkActivationStatus } = await import("@/actions/license");
        const status = await checkActivationStatus();
        if (status.isActivated || status.hasLicense) {
            // If license exists, redirect to validation to set cookie
            // Using window.location to ensure full reload if needed
            window.location.href = "/api/license/validate?next=/dashboard";
        }
      } catch (e) {
        console.error("Failed to check status", e);
      }
    }
    checkStatus();
  }, []);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Activation failed");
      }

      toast.success("Activation successful! Redirecting to login...");
      router.push("/login"); // Redirect to login after successful activation
    } catch (error: unknown) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Activation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Key className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Activate Your Institute</CardTitle>
          <CardDescription>
            Enter the license key provided in your Fee Ease dashboard or by the FeeEase team to activate your product.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleActivate} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="licenseKey" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                License Key
              </label>
              <Input
                id="licenseKey"
                placeholder="Paste your license key here..."
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                required
                className="font-mono text-sm"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                "Activate Product"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
