"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BranchTypeBadge } from "@/components/branch/branch-type-badge";
import {
  formatBranchCyclesLabel,
  isMultiCycleBranch,
} from "@/lib/cycle";
import type { UserBranchMembership } from "@/lib/auth/user-branch-access";

type BranchPickerClientProps = {
  organizationId: string;
  branches: UserBranchMembership[];
};

export function BranchPickerClient({
  organizationId,
  branches,
}: BranchPickerClientProps) {
  const base = `/admin/organizations/${organizationId}/branches`;

  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {branches.map((branch) => (
        <Button
          key={branch.branchId}
          asChild
          variant="outline"
          className="h-auto min-h-14 w-full justify-between gap-3 rounded-xl px-3.5 py-3.5 text-left"
        >
          <Link
            href={`${base}/${branch.branchId}`}
            className="flex w-full min-w-0 items-start justify-between gap-3"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold text-foreground">
                  {branch.branchName}
                </span>
                <BranchTypeBadge
                  typebranch={branch.typebranch}
                  cycles={branch.cycles}
                />
              </span>
              {isMultiCycleBranch({
                typebranch: branch.typebranch,
                cycles: branch.cycles,
              }) ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {formatBranchCyclesLabel(branch.cycles, {
                    typebranch: branch.typebranch,
                  })}
                </span>
              ) : null}
              <span className="mt-1 block text-xs text-muted-foreground">
                Ouvrir cet etablissement
              </span>
            </span>
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          </Link>
        </Button>
      ))}
    </div>
  );
}
