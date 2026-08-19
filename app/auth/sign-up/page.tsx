import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { safeInternalCallbackUrl } from "@/lib/auth/safe-callback-url";
import { SignUpForm } from "./components/sign-up-form";

export const metadata: Metadata = {
  title: "Créer un compte — Klambocore",
  description: "Inscription à Klambocore.",
};

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function SignUpPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const callbackUrl = safeInternalCallbackUrl(params.callbackUrl) ?? undefined;

  return (
    <AuthShell mode="sign-up">
      <SignUpForm callbackUrl={callbackUrl} />
    </AuthShell>
  );
}
