import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateMemberForm } from "./create-member-form";
import { Button } from "@/components/ui/button";
import { listOrganizationActiveBranchesAction } from "../actions";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function NewOrganizationMemberPage({ params }: PageProps) {
  const { organizationId } = await params;
  const branchesRes = await listOrganizationActiveBranchesAction(organizationId);
  const branches = branchesRes.ok ? branchesRes.branches : [];
  const listHref = `/admin/organizations/${organizationId}/members`;

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
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau membre</h1>
        <p className="mt-1.5 max-w-7xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Compte (nom, postnom, prénom, photo), rôle et établissements autorisés.
          Un mot de passe temporaire est envoyé par email.
        </p>
      </div>

      <CreateMemberForm
        organizationId={organizationId}
        branches={branches}
      />
    </div>
  );
}
