import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { getServerTranslator } from "@/lib/i18n-server";
import { IconBriefcase } from "@tabler/icons-react";
import { CandidaturesView } from "./candidatures-view";

export default async function CandidaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ applicationId?: string }>;
}) {
  const query = await searchParams;
  const t = await getServerTranslator("candidatures");

  return (
    <BranchPageShell
      title={t("title")}
      description={t("description")}
      badge={
        <Badge variant="outline-primary" icon={<IconBriefcase size={14} />}>
          {t("badge")}
        </Badge>
      }
    >
      <CandidaturesView initialApplicationId={query.applicationId ?? ""} />
    </BranchPageShell>
  );
}
