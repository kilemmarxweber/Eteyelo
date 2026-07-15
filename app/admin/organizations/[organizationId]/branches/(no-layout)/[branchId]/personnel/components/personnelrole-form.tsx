"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/custom/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  ORGANIZATION_ROLE_SLUGS,
  organizationRoleStatements,
} from "@/lib/permissions";

import { updatePersonnelFullAction } from "../personnel.action";

interface Props {
  mode: "create" | "update";
  initialData?: {
    personnelId?: string;
    memberId?: string;
    userId?: string;
    name?: string;
    postnom?: string;
    prenom?: string;
    email?: string | null;
    telephone?: string | null;
    address?: string | null;
    sexe?: string | null;
    dateOfBirth?: Date | string | null;
    orgRole?: string | null;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

const roleSchema = z.object({
  personnelId: z.string().min(1),
  memberId: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1),
  postnom: z.string().min(1),
  prenom: z.string().min(1),
  email: z.string().optional(),
  telephone: z.string().optional(),
  address: z.string().optional(),
  sexe: z.enum(["masculin", "feminin"]),
  dateOfBirth: z.date().optional(),
  orgRole: z.string().min(1, "Veuillez sélectionner un rôle"),
});

type PersonnelFullFormValues = z.infer<typeof roleSchema>;

function getRolePermissions(role: string): string[] {
  const roleConfig =
    organizationRoleStatements[role as keyof typeof organizationRoleStatements];

  if (!roleConfig) return [];

  return (
    Object.entries(roleConfig) as Array<[string, readonly string[]]>
  ).flatMap(([resource, actions]) =>
    actions.map((action) => `${resource}:${action}`),
  );
}

export function PersonnelRoleUpForm({
  mode,
  initialData,
  onSuccess,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionSearch, setPermissionSearch] = useState("");

  const form = useForm<PersonnelFullFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      personnelId: "",
      memberId: "",
      userId: "",
      name: "",
      postnom: "",
      prenom: "",
      email: "",
      telephone: "",
      address: "",
      sexe: "masculin",
      orgRole: "",
      dateOfBirth: undefined,
    },
  });

  const selectedRole = form.watch("orgRole");

  useEffect(() => {
    if (!initialData) return;

    form.reset({
      personnelId: initialData.personnelId ?? "",
      memberId: initialData.memberId ?? "",
      userId: initialData.userId ?? "",
      name: initialData.name ?? "",
      postnom: initialData.postnom ?? "",
      prenom: initialData.prenom ?? "",
      email: initialData.email ?? "",
      telephone: initialData.telephone ?? "",
      address: initialData.address ?? "",
      sexe:
        initialData.sexe === "M" || initialData.sexe === "masculin"
          ? "masculin"
          : "feminin",
      orgRole: initialData.orgRole ?? "",
      dateOfBirth: initialData.dateOfBirth
        ? new Date(initialData.dateOfBirth)
        : undefined,
    });

    if (initialData.orgRole) {
      setPermissions(getRolePermissions(initialData.orgRole));
    }
  }, [initialData, form]);

  useEffect(() => {
    if (!selectedRole) return;
    setPermissions(getRolePermissions(selectedRole));
  }, [selectedRole]);

  const filteredPermissions = useMemo(() => {
    const q = permissionSearch.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter((perm) => perm.toLowerCase().includes(q));
  }, [permissionSearch, permissions]);

  async function onSubmit(data: PersonnelFullFormValues) {
    setLoading(true);

    try {
      const [, err] = await updatePersonnelFullAction({
        ...data,
        email: data.email ?? "",
        telephone: data.telephone ?? "",
        address: data.address ?? "",
        sexe: data.sexe === "masculin" ? "M" : "F",
      });

      if (err) throw new Error(err.message);

      toast.success("Rôle mis à jour avec succès");
      onSuccess?.();
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de la mise à jour",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card className="space-y-4 border-blue-100 p-4">
          <div>
            <p className="text-sm font-semibold text-blue-950">
              {[form.watch("name"), form.watch("postnom"), form.watch("prenom")]
                .filter(Boolean)
                .join(" ") || "Personnel"}
            </p>
            <p className="text-xs text-muted-foreground">
              {form.watch("email") || "Email non défini"}
            </p>
          </div>

          <FormField
            control={form.control}
            name="orgRole"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel>Rôle</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un rôle" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ORGANIZATION_ROLE_SLUGS.map((role) => (
                      <SelectItem key={role} value={String(role)}>
                        {orgRoleLabel(String(role))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </Card>

        <Card className="space-y-3 border-blue-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-blue-950">
              Permissions du rôle
            </h3>
            <Badge variant="secondary">{permissions.length} permissions</Badge>
          </div>

          <Input
            value={permissionSearch}
            onChange={(e) => setPermissionSearch(e.target.value)}
            placeholder="Rechercher une permission..."
            className="rounded-xl border-blue-100"
          />

          <div className="max-h-[280px] space-y-2 overflow-auto pr-1">
            {filteredPermissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune permission à afficher.
              </p>
            ) : (
              filteredPermissions.map((perm) => (
                <div
                  key={perm}
                  className="flex items-center gap-2 rounded-lg border border-blue-50 px-3 py-2"
                >
                  <Checkbox checked disabled />
                  <span className="text-sm text-blue-950/80">{perm}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onCancel?.()}>
            Annuler
          </Button>
          <Button loading={loading} type="submit">
            {mode === "create" ? "Attribuer le rôle" : "Mettre à jour"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
