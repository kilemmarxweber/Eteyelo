import { notFound } from "next/navigation";

import {
  defaultLocaleForEducationSystem,
  resolveBranchUiLocale,
} from "@/lib/branch-locale";
import { educationSystemShortLabel } from "@/lib/education-system";
import { prisma } from "@/lib/prisma";

import { AppearanceForm } from "./appearance-form";

export default async function SettingsAppearance({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: { locale: true, educationSystem: true },
  });
  if (!branch) notFound();

  const initialLocale = resolveBranchUiLocale(branch);
  const systemDefaultLocale = defaultLocaleForEducationSystem(
    branch.educationSystem,
  );

  return (
    <AppearanceForm
      branchId={branchId}
      initialLocale={initialLocale}
      systemDefaultLocale={systemDefaultLocale}
      educationSystemLabel={educationSystemShortLabel(branch.educationSystem)}
    />
  );
}
