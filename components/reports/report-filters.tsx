"use client";

import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { MultiSelect } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/paiement/components/MultiSelect";
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
import { serializeBranchIdsParam } from "@/lib/reports/org/scope";

type Props = {
  organizationId: string;
  branches: ReportBranchOption[];
  schoolYears: ReportSchoolYearOption[];
  classes: ReportClassOption[];
  scope: ReportScope;
  selectedBranchId: string | null;
  selectedBranchIds: string[];
  schoolYearKey: string;
  classeKey: string;
  tab: ReportTab;
};

function buildHref(
  organizationId: string,
  next: {
    scope: ReportScope;
    branchIds: string[];
    schoolYearKey: string;
    classeKey: string;
    tab: ReportTab;
  },
) {
  const params = new URLSearchParams();
  params.set("tab", next.tab);
  params.set("scope", next.scope);
  params.set("branchId", serializeBranchIdsParam(next.branchIds));
  params.set("schoolYearKey", next.schoolYearKey);
  params.set("classeKey", next.classeKey || "all");
  return `/admin/organizations/${organizationId}/rapport?${params.toString()}`;
}

export function ReportFilters({
  organizationId,
  branches,
  schoolYears,
  classes,
  selectedBranchIds,
  schoolYearKey,
  classeKey,
  tab,
}: Props) {
  const router = useRouter();

  function navigate(
    patch: Partial<{
      scope: ReportScope;
      branchIds: string[];
      schoolYearKey: string;
      classeKey: string;
      tab: ReportTab;
    }>,
  ) {
    const nextIds =
      patch.branchIds !== undefined ? patch.branchIds : selectedBranchIds;
    router.push(
      buildHref(organizationId, {
        scope: patch.scope ?? (nextIds.length > 0 ? "branch" : "all"),
        branchIds: nextIds,
        schoolYearKey: patch.schoolYearKey ?? schoolYearKey,
        classeKey: patch.classeKey ?? classeKey,
        tab: patch.tab ?? tab,
      }),
      { scroll: false },
    );
  }

  const triggerClassName =
    "h-9 w-full rounded-full border-border bg-background text-foreground shadow-sm ring-offset-background hover:bg-accent hover:text-accent-foreground focus:ring-ring data-[placeholder]:text-muted-foreground [&>svg]:text-muted-foreground";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <div className="sm:w-[260px]">
        <MultiSelect
          options={branches.map((branch) => ({
            label: branch.name,
            value: branch.id,
          }))}
          value={selectedBranchIds}
          onValueChange={(ids) => {
            const unique = [...new Set(ids)];
            const isAll =
              unique.length === 0 || unique.length === branches.length;
            navigate({
              scope: isAll ? "all" : "branch",
              branchIds: isAll ? [] : unique,
              classeKey: "all",
            });
          }}
          placeholder="Toutes les branches"
          searchable
          maxCount={1}
          selectedCountLabel={(count) =>
            `${count} établissement${count > 1 ? "s" : ""}`
          }
          className="h-9 min-h-9 rounded-full border-border bg-background px-3 text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
        />
      </div>

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
