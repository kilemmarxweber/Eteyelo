import { CreateMemberForm } from "./create-member-form";
import { BackLink } from "@/components/ui/back-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listOrganizationActiveBranchesAction } from "../actions";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function NewOrganizationMemberPage({ params }: PageProps) {
  const { organizationId } = await params;
  const branchesRes = await listOrganizationActiveBranchesAction(organizationId);
  const branches = branchesRes.ok ? branchesRes.branches : [];

  const base = `/admin/organizations/${organizationId}/members`;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
      <BackLink href={base} label="Retour à la liste des membres" />

      <div>
        <h1 className="text-xl font-semibold">Ajouter un membre</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Création du compte, affectation aux établissements autorisés, et envoi
          d’un email avec le mot de passe temporaire.
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Ajouter un membre</CardTitle>
          <CardDescription>
            Choisissez le rôle et les branches auxquelles ce compte aura accès.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <CreateMemberForm
            organizationId={organizationId}
            branches={branches}
          />
        </CardContent>
      </Card>
    </div>
  );
}
