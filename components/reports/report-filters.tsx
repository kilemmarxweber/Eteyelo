"use client";

import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ReportBranchOption,
  ReportClassOption,
  ReportSchoolYearOption,
} from "@/lib/reports/org";
import type { ReportScope, ReportTab } from "@/lib/reports/org/definitions";

type Props = {
  organizationId: string;
  branches: ReportBranchOption[];
  schoolYears: ReportSchoolYearOption[];
  classes: ReportClassOption[];
  scope: ReportScope;
  selectedBranchId: string | null;
  schoolYearKey: string;
  classeKey: string;
  tab: ReportTab;
};

function buildHref(
  organizationId: string,
  next: {
    scope: ReportScope;
    branchId: string | null;
    schoolYearKey: string;
    classeKey: string;
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
  params.set("classeKey", next.classeKey || "all");
  return `/admin/organizations/${organizationId}/rapport?${params.toString()}`;
}

export function ReportFilters({
  organizationId,
  branches,
  schoolYears,
  classes,
  scope,
  selectedBranchId,
  schoolYearKey,
  classeKey,
  tab,
}: Props) {
  const router = useRouter();

  function navigate(
    patch: Partial<{
      scope: ReportScope;
      branchId: string | null;
      schoolYearKey: string;
      classeKey: string;
      tab: ReportTab;
    }>,
  ) {
    router.push(
      buildHref(organizationId, {
        scope: patch.scope ?? scope,
        branchId:
          patch.branchId !== undefined ? patch.branchId : selectedBranchId,
        schoolYearKey: patch.schoolYearKey ?? schoolYearKey,
        classeKey: patch.classeKey ?? classeKey,
        tab: patch.tab ?? tab,
      }),
      { scroll: false },
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
            navigate({ scope: "all", branchId: null, classeKey: "all" });
          } else {
            navigate({ scope: "branch", branchId: value, classeKey: "all" });
          }
        }}
      >
        <SelectTrigger className={`${triggerClassName} sm:w-[220px]`}>
          <SelectValue placeholder="Établissement" />
        </SelectTrigger>
        <SelectContent
          className="border-border bg-popover text-popover-foreground"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
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
        <SelectContent
          className="border-border bg-popover text-popover-foreground"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <SelectItem value="all">Toutes les années</SelectItem>
          {schoolYears.map((year) => (
            <SelectItem key={year.key} value={year.key}>
              {year.label}
              {year.isCurrent ? " (courante)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={classeKey || "all"}
        onValueChange={(value) => navigate({ classeKey: value })}
      >
        <SelectTrigger className={`${triggerClassName} sm:w-[240px]`}>
          <SelectValue placeholder="Classe" />
        </SelectTrigger>
        <SelectContent
          className="border-border bg-popover text-popover-foreground"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <SelectItem value="all">Toutes les classes</SelectItem>
          {classes.map((classe) => (
            <SelectItem key={classe.key} value={classe.key}>
              {classe.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
