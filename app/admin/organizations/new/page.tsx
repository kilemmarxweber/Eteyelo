import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BackLink } from "@/components/ui/back-link";
import { CreateOrganizationForm } from "@/app/admin/organizations/new/components/create-organization-form";
import { auth } from "@/lib/auth";
import { canCreateOrganization } from "@/lib/auth/organization-access";

export default async function NewOrganizationPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user || !canCreateOrganization(session.user.role)) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-5 md:max-w-4xl md:px-6">
      <BackLink href="/admin/organizations" label="Retour à la liste" />

      <Card>
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-lg">Informations</CardTitle>
          <CardDescription>
            Le slug de votre organisation sera genere automatiquement.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <CreateOrganizationForm />
        </CardContent>
      </Card>
    </div>
  );
}
