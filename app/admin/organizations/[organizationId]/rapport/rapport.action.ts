"use server";

import { guardOrganizationAccess } from "@/lib/auth/require-organization-permission";
import {
  buildOverviewReport,
  getAttendanceReport,
  getEffectifsReport,
  getFinanceReport,
  getHiringReport,
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
  };
  const schoolYearIds =
    meta.schoolYearKey === "all"
      ? meta.schoolYears.flatMap((y) => y.ids)
      : meta.schoolYearIds;

  const [
    effectifs,
    attendance,
    finance,
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
    getSatisfactionReport({ scope: scopeInput, schoolYearIds }),
    getResultsReport({ scope: scopeInput, schoolYearIds }),
    getHiringReport({ scope: scopeInput }),
    getRegistrationReport({ scope: scopeInput, schoolYearIds }),
  ]);

  const overview = buildOverviewReport({
    effectifs,
    attendance,
    finance,
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

  const selectedBranchId =
    branchId && branchId.trim() && branchId !== "all" ? branchId.trim() : null;

  if (selectedBranchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: selectedBranchId, organizationId },
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
        take: 1,
        orderBy: { name: "asc" },
        select: schoolReportBranchSelect,
      },
    },
  });

  if (!organization) {
    throw new Error("Organisation introuvable");
  }

  const fallbackBranch = organization.branches[0];
  if (fallbackBranch) {
    return {
      ...buildSchoolReportContext(fallbackBranch),
      branchName: "Toutes les branches",
      branchId: "",
    };
  }

  return {
    organizationId: organization.id,
    branchId: "",
    schoolName: organization.name,
    branchName: "Toutes les branches",
    logoUrl: resolveReportLogoUrl(null, organization.logo),
    generatedAt: new Date().toISOString(),
  };
}
