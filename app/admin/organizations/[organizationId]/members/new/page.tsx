import { CreateMemberForm } from "./create-member-form";
import { BackLink } from "@/components/ui/back-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function NewOrganizationMemberPage({ params }: PageProps) {
  const { organizationId } = await params;

  const base = `/admin/organizations/${organizationId}/members`;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
      <BackLink href={base} label="Retour à la liste des membres" />

      <div>
        <h1 className="text-xl font-semibold">Ajouter un membre</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Création du compte (email + mot de passe généré côté serveur), ajout
          immédiat à l’organisation, et envoi d’un email de confirmation avec
          le mot de passe temporaire (configurez `EMAIL_USER` et `EMAIL_PASS`
          pour l’envoi réel via SMTP).
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Ajouter un membre</CardTitle>
          <CardDescription>
            Création d’un compte avec email et mot de passe temporaire envoyé
            par email.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <CreateMemberForm organizationId={organizationId} />
        </CardContent>
      </Card>
    </div>
  );
}
