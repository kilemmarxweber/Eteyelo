import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";

export default function PublicAttendanceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
