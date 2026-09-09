"use client";

import { IconLoader2, IconLogout, IconUserCheck } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AttendancePersonLookup } from "../attendance-scan-types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function AttendanceQuickPersonRow({
  person,
  pointerLabel,
  checkoutLabel,
  doneLabel,
  sessionLabel,
  blockedReason,
  busy,
  onPointer,
  onCheckout,
}: {
  person: AttendancePersonLookup;
  pointerLabel: string;
  checkoutLabel: string;
  doneLabel: string;
  sessionLabel?: string | null;
  blockedReason?: string | null;
  busy: boolean;
  onPointer: () => void;
  onCheckout: () => void;
}) {
  const done = person.alreadyCheckedIn && !person.canCheckOut;
  const canLeave = Boolean(person.canCheckOut);
  const canPointer = person.canCheckIn !== false;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-3 py-3 transition-colors sm:flex-row sm:items-center",
        done
          ? "border-emerald-500/25 bg-emerald-500/5"
          : canLeave
            ? "border-amber-500/25 bg-amber-500/5"
            : !canPointer
              ? "bg-muted/30 opacity-80"
              : "bg-card hover:bg-muted/50",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar className="size-12 shrink-0 sm:size-11">
        {person.image ? <AvatarImage src={person.image} alt="" /> : null}
        <AvatarFallback className="text-sm font-medium">
          {initials(person.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-tight">
          {person.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {person.matricule}
          {person.roleLabel ? ` · ${person.roleLabel}` : ""}
        </p>
        {sessionLabel ? (
          <p className="mt-0.5 truncate text-xs font-medium text-primary">
            {sessionLabel}
          </p>
        ) : blockedReason ? (
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
            {blockedReason}
          </p>
        ) : null}
      </div>
      </div>
      <div className="shrink-0 sm:ml-0">
        {done ? (
          <Badge variant="success" className="h-11 w-full justify-center px-3 text-sm sm:h-9 sm:w-auto">
            {doneLabel}
          </Badge>
        ) : (
          <Button
            type="button"
            size="lg"
            variant={canLeave ? "outline" : "default"}
            disabled={busy || (!canLeave && !canPointer)}
            className="h-12 w-full touch-manipulation px-4 sm:h-11 sm:min-w-[7.5rem] sm:w-auto"
            onClick={canLeave ? onCheckout : onPointer}
          >
            {busy ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : canLeave ? (
              <IconLogout className="size-4" />
            ) : (
              <IconUserCheck className="size-4" />
            )}
            {canLeave ? checkoutLabel : pointerLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
