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
  busy,
  onPointer,
  onCheckout,
}: {
  person: AttendancePersonLookup;
  pointerLabel: string;
  checkoutLabel: string;
  doneLabel: string;
  sessionLabel?: string | null;
  busy: boolean;
  onPointer: () => void;
  onCheckout: () => void;
}) {
  const done = person.alreadyCheckedIn && !person.canCheckOut;
  const canLeave = Boolean(person.canCheckOut);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors",
        done
          ? "border-emerald-500/25 bg-emerald-500/5"
          : canLeave
            ? "border-amber-500/25 bg-amber-500/5"
            : "bg-card hover:bg-muted/50",
      )}
    >
      <Avatar className="size-11 shrink-0">
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
        ) : null}
      </div>
      <div className="shrink-0">
        {done ? (
          <Badge variant="success" className="h-9 px-3 text-sm">
            {doneLabel}
          </Badge>
        ) : (
          <Button
            type="button"
            size="lg"
            variant={canLeave ? "outline" : "default"}
            disabled={busy}
            className="h-11 min-w-[7.5rem] touch-manipulation px-4"
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
