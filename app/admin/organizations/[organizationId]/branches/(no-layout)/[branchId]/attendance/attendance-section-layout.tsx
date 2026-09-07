"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { IconUserCheck } from "@tabler/icons-react";
import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { NotFoundView } from "@/components/not-found-view";
import { useSession } from "@/lib/auth-client";
import { canAccessTeachingArea } from "@/lib/auth/session-roles";
import { AttendanceTabsNav } from "./components/attendance-tabs-nav";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export default function AttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("attendance");
  const { data: session, isPending } = useSession();
  const [hasMounted, setHasMounted] = useState(false);
  const sessionReady = hasMounted && !isPending;
  const params = useParams<{ organizationId: string; branchId: string }>();
  const pathname = usePathname();
  const basePath = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/attendance`;
  const onPointagePage =
    pathname === basePath ||
    pathname === `${basePath}/` ||
    pathname.startsWith(`${basePath}/pointage`);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (sessionReady && !canAccessTeachingArea(session)) {
    return <NotFoundView />;
  }

  return (
    <BranchPageShell
      fixedHeight
      fadedBelow
      title={t("title")}
      description={onPointagePage ? undefined : t("description")}
      badge={
        <Badge variant="outline-primary" icon={<IconUserCheck size={14} />}>
          {t("badge")}
        </Badge>
      }
      contentClassName="flex min-h-0 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="shrink-0">
          <AttendanceTabsNav basePath={basePath} />
        </div>

        <main
          className={cn(
            "min-h-0 min-w-0 flex-1",
            onPointagePage ? "overflow-hidden" : "overflow-auto",
          )}
        >
          <div
            className={cn(
              "animate-fade-in",
              onPointagePage && "flex h-full min-h-0 flex-col",
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </BranchPageShell>
  );
}
