"use client";

import { useEffect, useState } from "react";

import { AttendanceCheckInClient } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/attendance/components/attendance-checkin-client";

function KioskClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time className="font-mono text-base font-semibold tabular-nums tracking-tight sm:text-lg">
      {now
        ? now.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        : "--:--:--"}
    </time>
  );
}

export function AttendanceKioskShell({
  branchId,
  branchName,
}: {
  branchId: string;
  branchName: string;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-muted/40 via-background to-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 px-3 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 md:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Kiosque
            </p>
            <h1 className="truncate text-lg font-semibold leading-tight sm:text-xl md:text-2xl">
              Pointage{" "}
              <span className="font-normal text-muted-foreground">|</span>{" "}
              {branchName}
            </h1>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              En direct
            </div>
            <div className="rounded-xl border bg-card px-3 py-1.5 shadow-sm">
              <KioskClock />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4 md:px-8 md:py-5">
        <AttendanceCheckInClient kioskBranchId={branchId} />
      </main>
    </div>
  );
}
