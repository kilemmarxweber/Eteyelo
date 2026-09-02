"use client";

import { IconLogout, IconUserCheck } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
      <Avatar className="size-9">
        {person.image ? <AvatarImage src={person.image} alt="" /> : null}
        <AvatarFallback className="text-xs">{initials(person.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-tight">{person.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {person.matricule}
          {person.roleLabel ? ` · ${person.roleLabel}` : ""}
        </p>
        {sessionLabel ? (
          <p className="mt-0.5 truncate text-xs text-primary">{sessionLabel}</p>
        ) : null}
      </div>
      <div className="shrink-0">
        {person.alreadyCheckedIn && !person.canCheckOut ? (
          <Badge variant="success">{doneLabel}</Badge>
        ) : person.canCheckOut ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onCheckout}
          >
            <IconLogout className="size-4" />
            {checkoutLabel}
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={busy} onClick={onPointer}>
            <IconUserCheck className="size-4" />
            {pointerLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
