"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconUserCheck } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { canOpenAttendanceKiosk } from "@/lib/auth/session-roles";
import { grantMatchesPermission } from "@/lib/auth/temporary-grant-actions";
import { getMyActiveTemporaryGrantsAction } from "@/lib/auth/temporary-grants.action";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function AttendanceKioskLink({
  className,
}: {
  className?: string;
}) {
  const { data: session, isPending } = authClient.useSession();
  const params = useParams();
  const [mounted, setMounted] = useState(false);
  const [grantAllowsKiosk, setGrantAllowsKiosk] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const branchId =
    typeof params.branchId === "string" ? params.branchId : undefined;
  const organizationId =
    session?.organization?.id ??
    (session as { session?: { activeOrganizationId?: string } } | null)?.session
      ?.activeOrganizationId ??
    null;

  useEffect(() => {
    let cancelled = false;
    if (!organizationId) {
      setGrantAllowsKiosk(false);
      return;
    }
    void getMyActiveTemporaryGrantsAction(organizationId, branchId ?? null).then(
      (res) => {
        if (cancelled) return;
        setGrantAllowsKiosk(
          res.grants.some((grant) =>
            grantMatchesPermission(grant, "attendance", "kiosk"),
          ),
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [organizationId, branchId]);

  if (!mounted || isPending || !branchId) return null;
  if (!canOpenAttendanceKiosk(session) && !grantAllowsKiosk) return null;

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className={cn(
        "relative size-9 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <Link
        href={`/attendance/${branchId}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ouvrir le pointage kiosque"
        title="Pointage kiosque"
      >
        <IconUserCheck className="size-4" />
      </Link>
    </Button>
  );
}
