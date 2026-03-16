"use client";

import { Construction, Home, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

interface UnderDevelopmentProps {
  title?: string;
  description?: string;
  showHomeButton?: boolean;
}

export function UnderDevelopment({
  title = "Under Development",
  description = "We're currently working hard to bring this feature to life. Please check back soon!",
  showHomeButton = true
}: UnderDevelopmentProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <Card className="max-w-md w-full border-dashed bg-muted/30">
        <CardContent className="pt-10 pb-10 flex flex-col items-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full" />
            <div className="relative bg-background p-6 rounded-2xl border-2 border-yellow-500/50 shadow-xl">
              <Construction className="h-12 w-12 text-yellow-500 animate-bounce" />
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight mb-2">{title}</h2>
          <p className="text-muted-foreground mb-8">
            {description}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            {showHomeButton && (
              <Button asChild variant="outline" className="flex-1 gap-2">
                <Link href="/">
                  <Home className="h-4 w-4" />
                  Go Home
                </Link>
              </Button>
            )}
            <Button asChild className="flex-1 gap-2 bg-yellow-600 hover:bg-yellow-700 text-white border-none">
              <Link href={`${process.env.NEXT_PUBLIC_FEEEASE_URL}/contactus/school`} target="_blank">
                <MessageSquare className="h-4 w-4" />
                Contact Support
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="mt-8 text-xs text-muted-foreground uppercase tracking-widest font-medium opacity-50">
        FeeEase Deployment Engine v3.0
      </p>
    </div>
  );
}
