"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import Link from "next/link";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Mail, Shield, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { createOrganizationMemberAction } from "../actions";
import { createOrgMemberSchema, type CreateOrgMemberInput } from "../schema";

type Props = {
  organizationId: string;
};

export function CreateMemberForm({ organizationId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<CreateOrgMemberInput>({
    resolver: zodResolver(createOrgMemberSchema),
    defaultValues: {
      organizationId,
      email: "",
      name: "",
      orgRole: ALL_ORG_ROLE_SLUGS[2],
    },
  });

  function onSubmit(values: CreateOrgMemberInput) {
    startTransition(async () => {
      const res = await createOrganizationMemberAction({
        ...values,
        organizationId,
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success("Membre créé avec succès.");
      router.push(`/admin/organizations/${organizationId}/members`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <input type="hidden" {...form.register("organizationId")} />

      <label className="block space-y-2 text-sm font-medium">
        Nom complet
        <div className="flex items-center gap-2 rounded-2xl border bg-card px-3">
          <UserRound className="size-4 text-muted-foreground" />
          <input
            {...form.register("name")}
            disabled={pending}
            autoComplete="name"
            placeholder="Ex. Kilem Marxweber"
            className="h-12 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <FormError message={form.formState.errors.name?.message} />
      </label>

      <label className="block space-y-2 text-sm font-medium">
        Email
        <div className="flex items-center gap-2 rounded-2xl border bg-card px-3">
          <Mail className="size-4 text-muted-foreground" />
          <input
            {...form.register("email")}
            disabled={pending}
            type="email"
            autoComplete="email"
            placeholder="membre@example.com"
            className="h-12 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <FormError message={form.formState.errors.email?.message} />
      </label>

      <label className="block space-y-2 text-sm font-medium">
        Rôle
        <div className="flex items-center gap-2 rounded-2xl border bg-card px-3">
          <Shield className="size-4 text-muted-foreground" />
          <select
            {...form.register("orgRole")}
            disabled={pending}
            className="h-12 w-full bg-transparent text-sm outline-none"
          >
            {ALL_ORG_ROLE_SLUGS.map((slug) => (
              <option key={slug} value={slug}>
                {orgRoleLabel(slug)}
              </option>
            ))}
          </select>
        </div>
        <FormError message={form.formState.errors.orgRole?.message} />
      </label>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Link
          href={`/admin/organizations/${organizationId}/members`}
          className="inline-flex h-11 w-full items-center justify-center rounded-full border bg-card px-5 text-sm font-semibold transition hover:bg-muted sm:w-auto"
        >
          Annuler
        </Link>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-blue-950 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-950/90 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {pending ? "Création..." : "Créer le membre"}
        </button>
      </div>
    </form>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-xs text-red-600">{message}</p>;
}
