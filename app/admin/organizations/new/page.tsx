import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateOrganizationForm } from "@/app/admin/organizations/new/components/create-organization-form";
import { auth } from "@/lib/auth";
import { canCreateOrganization } from "@/lib/auth/organization-access";

export default async function NewOrganizationPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user || !canCreateOrganization(session.user.role)) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 md:max-w-4xl md:px-6">
      <Card>
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-lg">Informations</CardTitle>
          <CardDescription>
            Le slug de votre organisation sera genere automatiquement.{" "}
            <Link
              href="/admin/organizations"
              className="text-primary underline-offset-4 hover:underline"
            >
              Retour a la liste
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <CreateOrganizationForm />
        </CardContent>
      </Card>
    </div>
  );
}
