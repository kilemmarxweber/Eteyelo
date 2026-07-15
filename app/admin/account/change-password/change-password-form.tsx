"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { clearMustChangePasswordAction } from "@/app/admin/account/change-password/actions";
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from "@/app/admin/account/schema";
import { Button } from "@/components/ui/button";
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

const PASSWORD_RULES = [
  "Au moins 8 caractères",
  "Une lettre majuscule",
  "Une lettre minuscule",
  "Un chiffre ou un caractère spécial",
] as const;

export function ChangePasswordForm({ forced }: { forced: boolean }) {
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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-blue-950 p-6 text-white sm:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
              <KeyRound className="size-4" />
              Sécurité du compte
            </div>

            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
              {forced
                ? "Modifiez votre mot de passe"
                : "Changer le mot de passe"}
            </h1>

            <p className="mt-4 max-w-7xl text-sm leading-7 text-blue-50 sm:text-base">
              {forced
                ? "Pour sécuriser votre compte, vous devez remplacer le mot de passe temporaire avant d’accéder à la plateforme."
                : "Choisissez un mot de passe robuste pour protéger votre compte."}
            </p>

            <ul className="mt-8 space-y-2 text-sm text-blue-50">
              {PASSWORD_RULES.map((rule) => (
                <li key={rule} className="flex items-center gap-2">
                  <ShieldCheck className="size-4 shrink-0 text-white" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-5 sm:p-6 lg:p-8">
            <Form {...form}>
              <form
                className="flex flex-col gap-5"
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
                    <FormItem>
                      <FormLabel>
                        {forced
                          ? "Mot de passe temporaire"
                          : "Mot de passe actuel"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="current-password"
                          className="h-11"
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
                    <FormItem>
                      <FormLabel>Nouveau mot de passe</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="new-password"
                          className="h-11"
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
                    <FormItem>
                      <FormLabel>Confirmer le mot de passe</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="new-password"
                          className="h-11"
                          disabled={submitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="h-11 w-full sm:w-auto sm:self-start"
                  disabled={submitting}
                >
                  {submitting ? "Enregistrement…" : "Enregistrer le mot de passe"}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </section>
    </div>
  );
}
