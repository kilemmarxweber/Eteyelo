import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { loadPublicAttendanceBranch } from "@/lib/auth/attendance-kiosk-context";
import { AttendanceCheckInClient } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/attendance/components/attendance-checkin-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pointage",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default async function PublicAttendancePage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;

  let branch: Awaited<ReturnType<typeof loadPublicAttendanceBranch>>;
  try {
    branch = await loadPublicAttendanceBranch(branchId);
  } catch {
    notFound();
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b px-4 py-3 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Pointage
        </p>
        <h1 className="truncate text-lg font-semibold">{branch.name}</h1>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
        <AttendanceCheckInClient kioskBranchId={branch.id} />
      </div>
    </div>
  );
}
