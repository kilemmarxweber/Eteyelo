"use client";

import { useState } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  className?: string;
  variant?: "outline" | "secondary" | "ghost";
  label?: string;
};

export function SignOutButton({
  className,
  variant = "outline",
  label = "Se connecter en tant que super admin",
}: SignOutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      await authClient.signOut();
      router.push("/auth/sign-in");
      router.refresh();
    } catch {
      toast.error("Déconnexion impossible. Réessayez.");
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={cn("h-11 rounded-full px-5", className)}
      onClick={() => void handleSignOut()}
      disabled={pending}
    >
      {pending ? "Déconnexion…" : label}
    </Button>
  );
}
