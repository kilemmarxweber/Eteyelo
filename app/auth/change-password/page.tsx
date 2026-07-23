import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/app/auth/change-password/change-password-form";
import { auth } from "@/lib/auth";
import { safeInternalCallbackUrl } from "@/lib/auth/safe-callback-url";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AuthChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const { callbackUrl } = await searchParams;
  const safeCallback = safeInternalCallbackUrl(callbackUrl);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });

  return (
    <ChangePasswordForm
      forced={Boolean(user?.mustChangePassword)}
      callbackUrl={safeCallback}
    />
  );
}
