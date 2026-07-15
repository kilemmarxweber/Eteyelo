import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/ui/back-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreatePartenaireForm } from "../../new/create-partenaire-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ organizationId: string; partenaireId: string }>;
};

export default async function EditPartenairePage({ params }: PageProps) {
  const { organizationId, partenaireId } = await params;
  const [partenaire, branches] = await Promise.all([
    prisma.partnaire.findFirst({
      where: {
        id: partenaireId,
        OR: [{ branch: { organizationId } }, { branchId: null }],
      },
    }),
    prisma.branch.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!partenaire) notFound();
  const base = `/admin/organizations/${organizationId}/partenaires`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <BackLink href={base} label="Retour à la liste des partenaires" />

      <Card>
        <CardHeader>
          <CardTitle>Modifier {partenaire.name}</CardTitle>
          <CardDescription>
            Mettez à jour les informations ou le statut du partenaire.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreatePartenaireForm
            organizationId={organizationId}
            branches={branches}
            partenaireId={partenaire.id}
            initialValues={{
              name: partenaire.name,
              slug: partenaire.slug ?? "",
              type: partenaire.type ?? "",
              secteur: partenaire.secteur ?? "",
              description: partenaire.description ?? "",
              image: partenaire.image,
              logo: partenaire.logo ?? "",
              tel: partenaire.tel,
              email: partenaire.email ?? "",
              website: partenaire.website ?? "",
              adresse: partenaire.adresse ?? "",
              ville: partenaire.ville ?? "",
              pays: partenaire.pays ?? "",
              contactName: partenaire.contactName ?? "",
              contactRole: partenaire.contactRole ?? "",
              documentUrl: partenaire.documentUrl ?? "",
              contractRef: partenaire.contractRef ?? "",
              notes: partenaire.notes ?? "",
              branchId: partenaire.branchId ?? "",
              isActive: partenaire.isActive,
              isFeatured: partenaire.isFeatured,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
