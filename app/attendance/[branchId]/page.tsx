import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { loadPublicAttendanceBranch } from "@/lib/auth/attendance-kiosk-context";
import { AttendanceKioskShell } from "./attendance-kiosk-shell";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ branchId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { branchId } = await params;
  try {
    const branch = await loadPublicAttendanceBranch(branchId);
    return {
      title: { absolute: `Pointage | ${branch.name}` },
      robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false, noimageindex: true },
      },
    };
  } catch {
    return { title: { absolute: "Pointage" } };
  }
}

export default async function PublicAttendancePage({ params }: PageProps) {
  const { branchId } = await params;

  let branch: Awaited<ReturnType<typeof loadPublicAttendanceBranch>>;
  try {
    branch = await loadPublicAttendanceBranch(branchId);
  } catch {
    notFound();
  }

  return (
    <AttendanceKioskShell branchId={branch.id} branchName={branch.name} />
  );
}
