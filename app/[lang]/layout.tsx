import type { Metadata } from "next";
import "../globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { InstallPrompt } from "@/components/install-prompt";
import { notFound } from "next/navigation";
import { hasLocale, isRtlLocale, locales } from "@/lib/i18n";
import { dictString, getDictionary } from "@/lib/dictionaries";
import { I18nProvider } from "@/components/i18n-provider";
import { redirect } from "next/navigation";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) {
    redirect("https://mns.feeease.com");
  }
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const title = dictString(dict, "meta.title", "Institute Management");
  const description = dictString(dict, "meta.description", "Efficient nursery school management system");
  const metadataBase = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL) : undefined;

  return {
    metadataBase,
    title,
    description,
    alternates: {
      canonical: `/${lang}`,
      languages: {
        en: "/en",
        hi: "/hi",
        ur: "/ur",
      },
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title,
    },
    icons: {
      icon: "/favicon.ico",
      shortcut: "/favicon-16x16.png",
      apple: "/apple-touch-icon.png",
    },
    formatDetection: {
      telephone: false,
    },
    manifest: "/manifest.webmanifest",
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const dir = isRtlLocale(lang) ? "rtl" : "ltr";
  const dict = await getDictionary(lang);

  return (
    <html lang={lang} dir={dir} suppressHydrationWarning>
      <body
        className="font-sans antialiased"
        suppressHydrationWarning
      >
        <ServiceWorkerRegister />
        <InstallPrompt />
        <Providers>
          <I18nProvider locale={lang} dict={dict}>
            {children}
            <Toaster richColors closeButton />
          </I18nProvider>
        </Providers>
      </body>
    </html>
  );
}
