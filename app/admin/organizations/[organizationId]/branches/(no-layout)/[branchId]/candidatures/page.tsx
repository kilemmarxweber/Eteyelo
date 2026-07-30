import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { IconBriefcase } from "@tabler/icons-react";
import { CandidaturesView } from "./candidatures-view";

export default async function CandidaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ applicationId?: string }>;
}) {
  const query = await searchParams;

  return (
    <BranchPageShell
      title="Candidatures"
          description="Examinez les candidatures enseignants et personnel, acceptez-les ou créez le compte après validation."
          badge={
            <Badge variant="outline-primary" icon={<IconBriefcase size={14} />}>
              Recrutement
            </Badge>
          }
    >
      <CandidaturesView initialApplicationId={query.applicationId ?? ""} />
    </BranchPageShell>
  );
}
