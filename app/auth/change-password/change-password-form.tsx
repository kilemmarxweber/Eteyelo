"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, GraduationCap, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { clearMustChangePasswordAction } from "@/app/admin/account/change-password/actions";
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from "@/app/admin/account/schema";
import { AuthShell } from "@/components/layout/auth-shell";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { authClient } from "@/lib/auth-client";
import { safeInternalCallbackUrl } from "@/lib/auth/safe-callback-url";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-11 rounded-xl border-primary bg-input pl-10 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/30";

export function ChangePasswordForm({
  forced,
  callbackUrl,
}: {
  forced: boolean;
  callbackUrl?: string | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  async function onSubmit(values: ChangePasswordValues) {
    setSubmitting(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        toast.error(error.message ?? "Mot de passe non modifié.");
        return;
      }

      const cleared = await clearMustChangePasswordAction();
      if (!cleared.ok) {
        toast.error(cleared.message ?? "Impossible de finaliser le changement.");
        return;
      }

      toast.success("Mot de passe mis à jour.");

      const safeCallback = safeInternalCallbackUrl(callbackUrl);
      if (safeCallback) {
        router.push(safeCallback);
        router.refresh();
        return;
      }

      const redirectRes = await fetch("/api/auth/post-login-redirect");
      const redirectData = (await redirectRes.json().catch(() => null)) as {
        path?: string;
      } | null;
      router.push(redirectData?.path || "/admin");
      router.refresh();
    } catch {
      toast.error("Impossible de joindre le serveur.");
    } finally {
      setSubmitting(false);
    }
  }

  const forcedInviteCopy = Boolean(
    forced && callbackUrl?.includes("/accept-invitation"),
  );

  return (
    <AuthShell mode="sign-in">
      <div className="flex h-full flex-col">
        <Link
          href="/accueil"
          className="mb-5 inline-flex items-center gap-2 self-start"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-4" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-[0.12em] text-foreground uppercase">
              Klambocore
            </span>
            <span className="block text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              Gestion scolaire
            </span>
          </span>
        </Link>

        <div className="mb-4 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {forced ? "Première connexion" : "Changer le mot de passe"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {forcedInviteCopy
              ? "Remplacez le mot de passe temporaire avant d'accepter l'invitation."
              : forced
                ? "Saisissez l'ancien mot de passe, le nouveau, puis confirmez-le. Tous les caractères sont acceptés."
                : "Choisissez un nouveau mot de passe."}
          </p>
        </div>

        <Form {...form}>
          <form
            className="flex flex-col gap-3.5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit(onSubmit)(event);
            }}
          >
            {(
              [
                {
                  name: "currentPassword" as const,
                  label: forced
                    ? "Mot de passe temporaire"
                    : "Mot de passe actuel",
                  autoComplete: "current-password",
                },
                {
                  name: "newPassword" as const,
                  label: "Nouveau mot de passe",
                  autoComplete: "new-password",
                },
                {
                  name: "confirmPassword" as const,
                  label: "Confirmation",
                  autoComplete: "new-password",
                },
              ] as const
            ).map((fieldConfig) => (
              <FormField
                key={fieldConfig.name}
                control={form.control}
                name={fieldConfig.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      {fieldConfig.label}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          autoComplete={fieldConfig.autoComplete}
                          className={cn(fieldClass, "pr-10")}
                          disabled={submitting}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                          aria-label={
                            showPassword
                              ? "Masquer le mot de passe"
                              : "Afficher le mot de passe"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? "Enregistrement…" : "Enregistrer et continuer"}
            </button>
          </form>
        </Form>
      </div>
    </AuthShell>
  );
}
