"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { IconKey, IconShield } from "@tabler/icons-react";
import { toast } from "sonner";

import { clearMustChangePasswordAction } from "@/app/admin/account/change-password/actions";
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from "@/app/admin/account/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export function ChangePasswordForm({
  forced,
  callbackUrl,
}: {
  forced: boolean;
  callbackUrl?: string | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
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
    <div className="flex h-svh max-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-background via-muted/20 to-accent/10 p-3">
      <div className="w-full max-w-[380px] animate-fade-in">
        <div className="mb-3 flex items-center justify-center gap-2.5">
          <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2">
            <IconKey size={22} className="text-primary" />
            <div className="text-left leading-tight">
              <p className="text-sm font-bold text-foreground">Kalasa</p>
              <p className="text-[11px] text-muted-foreground">
                Gestion scolaire
              </p>
            </div>
          </div>
        </div>

        <Card variant="elevated" className="bg-primary/10">
          <CardHeader className="space-y-1.5 px-4 pb-2 pt-4 text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-base">
              <IconShield size={18} className="text-primary" />
              {forced
                ? "Nouveau mot de passe"
                : "Changer le mot de passe"}
            </CardTitle>
            <CardDescription className="text-xs leading-snug">
              {forcedInviteCopy
                ? "Remplacez le mot de passe temporaire avant d’accepter l’invitation."
                : forced
                  ? "Remplacez le mot de passe temporaire pour continuer."
                  : "Choisissez un mot de passe robuste."}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-4 pb-4 pt-1">
            <Form {...form}>
              <form
                className="flex flex-col gap-3"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void form.handleSubmit(onSubmit)(event);
                }}
              >
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem className="gap-1.5">
                      <FormLabel className="text-xs">
                        {forced
                          ? "Mot de passe temporaire"
                          : "Mot de passe actuel"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="current-password"
                          className="h-10"
                          disabled={submitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem className="gap-1.5">
                      <FormLabel className="text-xs">Nouveau</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="new-password"
                          placeholder="8+ car., maj., min., chiffre/symbole"
                          className="h-10"
                          disabled={submitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem className="gap-1.5">
                      <FormLabel className="text-xs">Confirmer</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="new-password"
                          className="h-10"
                          disabled={submitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="mt-1 h-10 w-full"
                  disabled={submitting}
                >
                  {submitting ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
