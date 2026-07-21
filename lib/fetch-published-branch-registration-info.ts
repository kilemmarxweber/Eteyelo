import { Prisma } from "@/prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseRentreeProgram,
  type PublicBranchRegistrationInfo,
} from "@/lib/registration-public-info";

function toPublicInfo(
  row: {
    id: string;
    branchId: string;
    termsTitle: string;
    termsContent: string;
    registrationFeeRequired: boolean;
    registrationFeeAmount: Prisma.Decimal | null;
    registrationFeeCurrency: string;
    registrationFeeLabel: string | null;
    registrationFeeDueNote: string | null;
    rentreeProgram: unknown;
    branch: { name: string };
    schoolYear: { nameYear: string } | null;
  },
): PublicBranchRegistrationInfo {
  return {
    id: row.id,
    branchId: row.branchId,
    branchName: row.branch.name,
    schoolYearName: row.schoolYear?.nameYear ?? null,
    termsTitle: row.termsTitle,
    termsContent: row.termsContent,
    registrationFeeRequired: row.registrationFeeRequired,
    registrationFeeAmount:
      row.registrationFeeAmount != null
        ? Number(row.registrationFeeAmount)
        : null,
    registrationFeeCurrency: row.registrationFeeCurrency,
    registrationFeeLabel: row.registrationFeeLabel,
    registrationFeeDueNote: row.registrationFeeDueNote,
    rentreeProgram: parseRentreeProgram(row.rentreeProgram),
  };
}

/** Shared query — call from server actions only. */
export async function fetchPublishedBranchRegistrationInfo(
  branchId: string,
): Promise<PublicBranchRegistrationInfo | null> {
  if (!branchId.trim()) return null;

  const currentYear = await prisma.schoolYear.findFirst({
    where: { branchId, isCurrentYear: true, isArchived: false },
    select: { id: true },
  });

  const include = {
    branch: { select: { name: true } },
    schoolYear: { select: { nameYear: true } },
  } as const;

  const byYear = currentYear
    ? await prisma.branchRegistrationInfo.findFirst({
        where: {
          branchId,
          isPublished: true,
          schoolYearId: currentYear.id,
        },
        include,
      })
    : null;

  if (byYear) return toPublicInfo(byYear);

  const fallback = await prisma.branchRegistrationInfo.findFirst({
    where: {
      branchId,
      isPublished: true,
    },
    orderBy: { updatedAt: "desc" },
    include,
  });

  return fallback ? toPublicInfo(fallback) : null;
}
