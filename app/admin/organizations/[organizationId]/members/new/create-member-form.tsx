"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createOrganizationMemberAction } from "../actions";
import { createOrgMemberSchema, type CreateOrgMemberInput } from "../schema";

type Props = { organizationId: string };

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

      toast.success("Membre créé avec succès");

      router.push(`/admin/organizations/${organizationId}/members`);
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* FORM GRID RESPONSIVE */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom complet</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoComplete="name"
                    disabled={pending}
                    className="h-11 sm:h-10"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="email"
                    disabled={pending}
                    className="h-11 sm:h-10"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="orgRole"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rôle</FormLabel>

                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={pending}
                >
                  <FormControl>
                    <SelectTrigger className="h-11 sm:h-10">
                      <SelectValue placeholder="Choisir un rôle" />
                    </SelectTrigger>
                  </FormControl>

                  <SelectContent>
                    {ALL_ORG_ROLE_SLUGS.map((slug) => (
                      <SelectItem key={slug} value={slug}>
                        {orgRoleLabel(slug)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ACTIONS RESPONSIVE */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="w-full sm:w-auto"
            asChild
          >
            <Link href={`/admin/organizations/${organizationId}/members`}>
              Annuler
            </Link>
          </Button>

          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Création..." : "Créer le membre"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
