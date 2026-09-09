"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconUserCheck } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { canOpenAttendanceKiosk } from "@/lib/auth/session-roles";
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const branchId =
    typeof params.branchId === "string" ? params.branchId : undefined;

  if (!mounted || isPending || !branchId) return null;
  if (!canOpenAttendanceKiosk(session)) return null;

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
