"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col gap-3">
      {branches.map((branch) => (
        <Button
          key={branch.branchId}
          asChild
          variant="outline"
          className="h-auto min-h-14 justify-between rounded-2xl px-4 py-4 text-left"
        >
          <Link href={`${base}/enter/${branch.branchId}`}>
            <span>
              <span className="block font-semibold text-slate-950">
                {branch.branchName}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Ouvrir cet établissement
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-slate-400" />
          </Link>
        </Button>
      ))}
    </div>
  );
}
