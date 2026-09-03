"use server";

import { guardOrganizationAccess } from "@/lib/auth/require-organization-permission";
import {
  buildOverviewReport,
  getAttendanceReport,
  getCreditsReport,
  getEffectifsReport,
  getFinanceReport,
  getHiringReport,
  getPayrollReport,
  getRegistrationReport,
  getReportMeta,
  getResultsReport,
  getSatisfactionReport,
  isReportTab,
  type ReportTab,
} from "@/lib/reports/org";
import {
  buildSchoolReportContext,
  resolveReportLogoUrl,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";
import { parseBranchIdsParam } from "@/lib/reports/org/scope";
import { prisma } from "@/lib/prisma";

type LoadParams = {
  organizationId: string;
  scope?: string;
  branchId?: string;
  schoolYearKey?: string;
  classeKey?: string;
  tab?: string;
};

export async function loadOrganizationReports(params: LoadParams) {
  const guard = await guardOrganizationAccess(params.organizationId);
  if (!guard.ok) {
    throw new Error(guard.message);
  }

  const meta = await getReportMeta({
    organizationId: params.organizationId,
    scope: params.scope,
    branchId: params.branchId,
    schoolYearKey: params.schoolYearKey,
    classeKey: params.classeKey,
  });

  const tab: ReportTab = isReportTab(params.tab) ? params.tab : "overview";
  const scopeInput = {
    organizationId: params.organizationId,
    scope: meta.scope,
    branchId: meta.selectedBranchId ?? undefined,
    branchIds:
      meta.selectedBranchIds.length > 0 ? meta.selectedBranchIds : undefined,
  };
  const schoolYearIds =
    meta.schoolYearKey === "all"
      ? meta.schoolYears.flatMap((y) => y.ids)
      : meta.schoolYearIds;

  const [
    effectifs,
    attendance,
    finance,
    payroll,
    credits,
    satisfaction,
    results,
    hiring,
    registrations,
  ] = await Promise.all([
    getEffectifsReport({ scope: scopeInput, schoolYearIds }),
    getAttendanceReport({ scope: scopeInput, schoolYearIds }),
    getFinanceReport({
      scope: scopeInput,
      schoolYearIds,
      classeKey: meta.classeKey,
    }),
    getPayrollReport({ scope: scopeInput, schoolYearIds }),
    getCreditsReport({ scope: scopeInput, schoolYearIds }),
    getSatisfactionReport({ scope: scopeInput, schoolYearIds }),
    getResultsReport({ scope: scopeInput, schoolYearIds }),
    getHiringReport({ scope: scopeInput }),
    getRegistrationReport({ scope: scopeInput, schoolYearIds }),
  ]);

  const overview = buildOverviewReport({
    effectifs,
    attendance,
    finance,
    payroll,
    credits,
    satisfaction,
    results,
    hiring,
    registrations,
  });

  return {
    meta,
    tab,
    overview,
    effectifs,
    attendance,
    finance,
    payroll,
    credits,
    satisfaction,
    results,
    hiring,
    registrations,
  };
}

/** @deprecated Prefer loadOrganizationReports — kept for PDF branding context. */
export async function getOrganizationReportData(params: {
  organizationId: string;
  branchId?: string;
}) {
  return loadOrganizationReports({
    organizationId: params.organizationId,
    branchId: params.branchId,
    tab: "overview",
  });
}

export async function getRapportReportContextAction({
  organizationId,
  branchId,
}: {
  organizationId: string;
  branchId?: string | null;
}) {
  const guard = await guardOrganizationAccess(organizationId);
  if (!guard.ok) {
    throw new Error(guard.message);
  }

  const selectedIds = parseBranchIdsParam(branchId);

  if (selectedIds.length === 1) {
    const branch = await prisma.branch.findFirst({
      where: { id: selectedIds[0], organizationId },
      select: schoolReportBranchSelect,
    });

    if (!branch) {
      throw new Error("Établissement introuvable");
    }

    return buildSchoolReportContext(branch);
  }

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      logo: true,
      branches: {
        where:
          selectedIds.length > 0
            ? { id: { in: selectedIds } }
            : { isActive: true },
        orderBy: { name: "asc" },
        select: schoolReportBranchSelect,
      },
    },
  });

  if (!organization) {
    throw new Error("Organisation introuvable");
  }

  const fallbackBranch = organization.branches[0];
  const branchLabel =
    selectedIds.length > 1
      ? `${selectedIds.length} établissements`
      : "Toutes les branches";

  if (fallbackBranch) {
    return {
      ...buildSchoolReportContext(fallbackBranch),
      branchName: branchLabel,
      branchId: "",
    };
  }

  return {
    organizationId: organization.id,
    branchId: "",
    schoolName: organization.name,
    branchName: branchLabel,
    logoUrl: resolveReportLogoUrl(null, organization.logo),
    generatedAt: new Date().toISOString(),
  };
}
