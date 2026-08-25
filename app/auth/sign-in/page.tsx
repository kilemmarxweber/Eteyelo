import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { safeInternalCallbackUrl } from "@/lib/auth/safe-callback-url";
import { SignInForm } from "./components/sign-in-form";

export const metadata: Metadata = {
  title: "Connexion — Klambocore",
  description: "Connectez-vous à Klambocore.",
};

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

function SignInPageContent({
  callbackUrl,
}: {
  callbackUrl?: string;
}) {
  return (
    <AuthShell mode="sign-in">
      <SignInForm callbackUrl={callbackUrl} />
    </AuthShell>
  );
}

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const callbackUrl = safeInternalCallbackUrl(params.callbackUrl) ?? undefined;

  return (
    <Suspense fallback={null}>
      <SignInPageContent callbackUrl={callbackUrl} />
    </Suspense>
  );
}
