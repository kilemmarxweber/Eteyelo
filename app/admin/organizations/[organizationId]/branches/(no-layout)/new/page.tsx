import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateBranchForm } from "./components/create-branch-form";

type NewBranchPageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function NewBranchPage({ params }: NewBranchPageProps) {
  const { organizationId } = await params;
  const branchesHref = `/admin/organizations/${organizationId}/branches`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 md:max-w-4xl md:px-6">
      <Card>
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-lg">Informations</CardTitle>
          <CardDescription>
            Créez un établissement pour cette organisation.{" "}
            <Link
              href={branchesHref}
              className="text-primary underline-offset-4 hover:underline"
            >
              Retour à la liste
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <CreateBranchForm organizationId={organizationId} />
        </CardContent>
      </Card>
    </div>
  );
}
