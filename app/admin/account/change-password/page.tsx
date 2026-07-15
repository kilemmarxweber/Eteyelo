import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/app/admin/account/change-password/change-password-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ChangePasswordPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });

  return <ChangePasswordForm forced={Boolean(user?.mustChangePassword)} />;
}
