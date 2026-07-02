import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AccountForm } from "./account-form";

export default async function SettingsAccount({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    // This should ideally be handled by middleware, but as a fallback:
    notFound();
  }

  const branchMember = await prisma.branchMember.findFirst({
    where: {
      branchId: branchId,
      member: {
        userId: session.user.id,
      },
    },
    include: { member: { include: { user: true } } },
  });

  if (!branchMember?.member?.user) {
    notFound();
  }

  const user = branchMember.member.user;

  // Convert null values from DB to undefined/empty strings for the form
  const initialData = {
    ...user,
    name: user.name ?? "",
    postnom: user.postnom ?? "",
    prenom: user.prenom ?? "",
    email: user.email ?? "",
    telephone: user.telephone ?? "",
    address: user.address ?? "",
    sexe: user.sexe ?? "",
    dateOfBirth: user.dateOfBirth ?? undefined,
  };
  return <AccountForm currentUser={initialData} />;
}
