"use client";

import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReportBranchOption, ReportSchoolYearOption } from "@/lib/reports/org";
import type { ReportScope, ReportTab } from "@/lib/reports/org/definitions";

type Props = {
  organizationId: string;
  branches: ReportBranchOption[];
  schoolYears: ReportSchoolYearOption[];
  scope: ReportScope;
  selectedBranchId: string | null;
  schoolYearKey: string;
  tab: ReportTab;
};

function buildHref(
  organizationId: string,
  next: {
    scope: ReportScope;
    branchId: string | null;
    schoolYearKey: string;
    tab: ReportTab;
  },
) {
  const params = new URLSearchParams();
  params.set("tab", next.tab);
  params.set("scope", next.scope);
  if (next.scope === "branch" && next.branchId) {
    params.set("branchId", next.branchId);
  } else {
    params.set("branchId", "all");
  }
  params.set("schoolYearKey", next.schoolYearKey);
  return `/admin/organizations/${organizationId}/rapport?${params.toString()}`;
}

export function ReportFilters({
  organizationId,
  branches,
  schoolYears,
  scope,
  selectedBranchId,
  schoolYearKey,
  tab,
}: Props) {
  const router = useRouter();

  function navigate(patch: Partial<{
    scope: ReportScope;
    branchId: string | null;
    schoolYearKey: string;
    tab: ReportTab;
  }>) {
    router.push(
      buildHref(organizationId, {
        scope: patch.scope ?? scope,
        branchId:
          patch.branchId !== undefined ? patch.branchId : selectedBranchId,
        schoolYearKey: patch.schoolYearKey ?? schoolYearKey,
        tab: patch.tab ?? tab,
      }),
    );
  }

  const branchSelectValue =
    scope === "all" ? "all" : (selectedBranchId ?? "all");

  const triggerClassName =
    "h-9 w-full rounded-full border-border bg-background text-foreground shadow-sm ring-offset-background hover:bg-accent hover:text-accent-foreground focus:ring-ring data-[placeholder]:text-muted-foreground [&>svg]:text-muted-foreground";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Select
        value={branchSelectValue}
        onValueChange={(value) => {
          if (value === "all") {
            navigate({ scope: "all", branchId: null });
          } else {
            navigate({ scope: "branch", branchId: value });
          }
        }}
      >
        <SelectTrigger className={`${triggerClassName} sm:w-[220px]`}>
          <SelectValue placeholder="Établissement" />
        </SelectTrigger>
        <SelectContent className="border-border bg-popover text-popover-foreground">
          <SelectItem value="all">Toutes les branches</SelectItem>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={schoolYearKey}
        onValueChange={(value) => navigate({ schoolYearKey: value })}
      >
        <SelectTrigger className={`${triggerClassName} sm:w-[200px]`}>
          <SelectValue placeholder="Année scolaire" />
        </SelectTrigger>
        <SelectContent className="border-border bg-popover text-popover-foreground">
          <SelectItem value="all">Toutes les années</SelectItem>
          {schoolYears.map((year) => (
            <SelectItem key={year.key} value={year.key}>
              {year.label}
              {year.isCurrent ? " (courante)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
