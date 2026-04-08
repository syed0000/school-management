"use client";

import { Construction, Home, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { useParams } from "next/navigation";
import { defaultLocale, hasLocale } from "@/lib/i18n";
import { withLocale } from "@/lib/locale-path";
import { useI18n } from "@/components/i18n-provider";

interface UnderDevelopmentProps {
  title?: string;
  description?: string;
  showHomeButton?: boolean;
}

export function UnderDevelopment({
  title,
  description,
  showHomeButton = true
}: UnderDevelopmentProps) {
  const { t } = useI18n();
  const params = useParams<{ lang?: string }>();
  const lang = hasLocale(params.lang ?? "") ? (params.lang as string) : defaultLocale;
  const finalTitle = title ?? t("underDev.title", "Under Development");
  const finalDescription =
    description ??
    t(
      "underDev.description",
      "We're currently working hard to bring this feature to life. Please check back soon!"
    );

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

          <h2 className="text-2xl font-bold tracking-tight mb-2">{finalTitle}</h2>
          <p className="text-muted-foreground mb-8">
            {finalDescription}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            {showHomeButton && (
              <Button asChild variant="outline" className="flex-1 gap-2">
                <Link href={withLocale(lang, "/")}>
                  <Home className="h-4 w-4" />
                  {t("underDev.goHome", "Go Home")}
                </Link>
              </Button>
            )}
            <Button asChild className="flex-1 gap-2 bg-yellow-600 hover:bg-yellow-700 text-white border-none">
              <Link href={`${process.env.NEXT_PUBLIC_FEEEASE_URL}/contactus/school`} target="_blank">
                <MessageSquare className="h-4 w-4" />
                {t("underDev.contactSupport", "Contact Support")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="mt-8 text-xs text-muted-foreground uppercase tracking-widest font-medium opacity-50">
        {t("underDev.footer", "FeeEase Deployment Engine v3.0")}
      </p>
    </div>
  );
}
