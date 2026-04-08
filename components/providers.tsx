"use client";

import { SessionProvider } from "next-auth/react";
import * as React from "react";
import { ConfirmProvider } from "@/context/ConfirmDialogContext";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={true} refetchInterval={30 * 60}>
      <ThemeProvider defaultTheme="system">
        <ConfirmProvider>{children}</ConfirmProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
