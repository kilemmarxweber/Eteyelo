import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EditMemberForm } from "./edit-member-form";
import { Button } from "@/components/ui/button";
import { listOrganizationActiveBranchesAction } from "../../actions";

type PageProps = {
  params: Promise<{ organizationId: string; memberId: string }>;
};

export default async function EditOrganizationMemberPage({ params }: PageProps) {
  const { organizationId, memberId } = await params;
  const listHref = `/admin/organizations/${organizationId}/members`;
  const branchesRes = await listOrganizationActiveBranchesAction(organizationId);
  const branches = branchesRes.ok ? branchesRes.branches : [];

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-1 gap-1.5 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href={listHref}>
            <ArrowLeft className="size-4" />
            Liste des membres
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Modifier le membre
        </h1>
        <p className="mt-1.5 max-w-7xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Email, identité (nom, postnom, prénom, photo), rôle, accès, réinitialisation
          du mot de passe ou retrait du membre. Le propriétaire n’a pas d’affectation
          de branche : il accède à tous les établissements.
        </p>
      </div>

      <EditMemberForm
        organizationId={organizationId}
        memberId={memberId}
        branches={branches}
      />
    </div>
  );
}
