import Link from "next/link";
import { CreatePartenaireForm } from "./create-partenaire-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function NewPartenairePage({ params }: PageProps) {
  const { organizationId } = await params;

  const branches = await prisma.branch.findMany({
    where: {
      organizationId,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });

  const base = `/admin/organizations/${organizationId}/partenaires`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold">Ajouter un partenaire</h1>
        <p className="text-sm text-muted-foreground">
          Créez un partenaire officiel, associez-le à une école si nécessaire,
          ajoutez son logo, ses contacts et ses références.
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Nouveau partenaire</CardTitle>
          <CardDescription>
            Les partenaires actifs peuvent apparaître sur la page publique.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <CreatePartenaireForm
            organizationId={organizationId}
            branches={branches}
          />

          <Link
            href={base}
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            ← Retour à la liste des partenaires
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
