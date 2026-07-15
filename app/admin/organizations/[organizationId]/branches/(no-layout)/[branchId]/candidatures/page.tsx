import { Badge } from "@/components/ui/badge";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { IconBriefcase } from "@tabler/icons-react";
import { CandidaturesView } from "./candidatures-view";

export default function CandidaturesPage() {
  return (
    <Layout>
      <LayoutBody className="w-full space-y-6">
        <PageHeader
          title="Candidatures"
          description="Examinez les candidatures enseignants et personnel, acceptez-les ou créez le compte après validation."
          badge={
            <Badge variant="outline-primary" icon={<IconBriefcase size={14} />}>
              Recrutement
            </Badge>
          }
        />
        <CandidaturesView />
      </LayoutBody>
    </Layout>
  );
}
