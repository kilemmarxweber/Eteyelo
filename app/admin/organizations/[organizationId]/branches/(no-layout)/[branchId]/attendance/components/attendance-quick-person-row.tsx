"use client";

import { useEffect, useState } from "react";
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

function formatArrival(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function periodHasEnded(periodEndAt?: string | null, now = Date.now()) {
  if (!periodEndAt) return false;
  const end = new Date(periodEndAt).getTime();
  return Number.isFinite(end) && now >= end;
}

export function AttendanceQuickPersonRow({
  person,
  pointerLabel,
  checkoutLabel,
  earlyExitLabel,
  endOfClassLabel,
  doneLabel,
  absentLabel,
  arrivalLabel,
  sessionLabel,
  blockedReason,
  busy,
  onPointer,
  onCheckout,
}: {
  person: AttendancePersonLookup;
  pointerLabel: string;
  checkoutLabel: string;
  earlyExitLabel: string;
  endOfClassLabel: string;
  doneLabel: string;
  absentLabel: string;
  arrivalLabel: string;
  sessionLabel?: string | null;
  blockedReason?: string | null;
  busy: boolean;
  onPointer: () => void;
  onCheckout: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const ended = periodHasEnded(person.periodEndAt, now);
  const done = person.alreadyCheckedIn && !person.canCheckOut;
  const canLeave = Boolean(person.canCheckOut);
  const requiresEarlyExit =
    person.requiresEarlyExit !== false && canLeave && !ended;
  const canPointer =
    person.canCheckIn !== false && !person.alreadyCheckedIn && !ended;
  const markedAbsent = !person.alreadyCheckedIn && ended;
  const arrival = formatArrival(person.checkInAt);
  const actionLabel = canLeave
    ? requiresEarlyExit
      ? earlyExitLabel
      : endOfClassLabel || checkoutLabel
    : pointerLabel;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-3 py-3 transition-colors sm:flex-row sm:items-center",
        done
          ? "border-emerald-500/25 bg-emerald-500/5"
          : markedAbsent
            ? "border-rose-500/20 bg-rose-500/5 opacity-80"
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
          {arrival ? ` · ${arrivalLabel} ${arrival}` : ""}
        </p>
        {sessionLabel && !markedAbsent ? (
          <p className="mt-0.5 truncate text-xs font-medium text-primary">
            {sessionLabel}
          </p>
        ) : markedAbsent ? (
          <p className="mt-0.5 text-xs font-medium text-rose-700 dark:text-rose-400">
            {absentLabel}
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
        ) : markedAbsent ? (
          <Badge variant="destructive" className="h-11 w-full justify-center px-3 text-sm sm:h-9 sm:w-auto">
            {absentLabel}
          </Badge>
        ) : (
          <Button
            type="button"
            size="lg"
            variant={canLeave ? (requiresEarlyExit ? "outline" : "default") : "default"}
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
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
