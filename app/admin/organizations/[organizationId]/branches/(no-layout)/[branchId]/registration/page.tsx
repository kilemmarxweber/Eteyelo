import { Badge } from "@/components/ui/badge";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { IconUserCheck } from "@tabler/icons-react";
import { RegistrationForm } from "./registration-form";

export default function RegistrationPage() {
  return (
    <Layout>
      <LayoutBody className="w-full space-y-6">
        <PageHeader
          title="Nouvelle inscription"
          description="Constituez le dossier familial complet et affectez l'eleve dans une classe disponible."
          badge={<Badge variant="outline-primary" icon={<IconUserCheck size={14} />}>Inscription unifiee</Badge>}
        />
        <RegistrationForm />
      </LayoutBody>
    </Layout>
  );
}
