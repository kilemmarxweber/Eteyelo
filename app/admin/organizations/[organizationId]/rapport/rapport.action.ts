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
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";
import { prisma } from "@/lib/prisma";

type LoadParams = {
  organizationId: string;
  scope?: string;
  branchId?: string;
  schoolYearKey?: string;
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
    getFinanceReport({ scope: scopeInput, schoolYearIds }),
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
  branchId: string;
}) {
  const guard = await guardOrganizationAccess(organizationId);
  if (!guard.ok) {
    throw new Error(guard.message);
  }

  if (!branchId?.trim() || branchId === "all") {
    throw new Error("Sélectionnez un établissement pour l'export PDF.");
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: schoolReportBranchSelect,
  });

  if (!branch) {
    throw new Error("Établissement introuvable");
  }

  return buildSchoolReportContext(branch);
}
