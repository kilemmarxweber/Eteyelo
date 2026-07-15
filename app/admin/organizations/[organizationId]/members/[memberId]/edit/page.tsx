import { EditMemberForm } from "./edit-member-form";
import { BackLink } from "@/components/ui/back-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PageProps = {
  params: Promise<{ organizationId: string; memberId: string }>;
};

export default async function EditOrganizationMemberPage({
  params,
}: PageProps) {
  const { organizationId, memberId } = await params;
  const base = `/admin/organizations/${organizationId}/members`;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6">
      <BackLink href={base} label="Retour à la liste des membres" />

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Modifier un membre</h1>
        <p className="text-sm text-muted-foreground">
          Modifier le rôle ou retirer le membre de l’organisation.
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Informations du membre</CardTitle>
          <CardDescription>
            Mise à jour des droits et paramètres du compte.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <EditMemberForm organizationId={organizationId} memberId={memberId} />
        </CardContent>
      </Card>
    </div>
  );
}
