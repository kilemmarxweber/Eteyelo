"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/custom/button";
import { toast } from "sonner";

import {
  ORGANIZATION_ROLE_SLUGS,
  organizationRoleStatements,
} from "@/lib/permissions";

import { updatePersonnelFullAction } from "../personnel.action";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface Props {
  mode: "create" | "update";
  initialData?: any;
  onSuccess?: () => void;
}

type PersonnelFullFormValues = {
  personnelId: string;
  memberId: string;
  userId: string;
  name: string;
  postnom: string;
  prenom: string;
  email: string;
  telephone: string;
  address: string;
  sexe: "masculin" | "feminin";
  dateOfBirth?: Date;
  orgRole: string;
};

const EMPTY_VALUES: PersonnelFullFormValues = {
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
};

/**
 * 🔥 SAFE + TYPED ROLE → PERMISSIONS
 */
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

export function PersonnelRoleUpForm({ mode, initialData, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  const form = useForm<PersonnelFullFormValues>({
    defaultValues: EMPTY_VALUES,
  });

  const selectedRole = form.watch("orgRole");

  /**
   * INIT FORM + SYNC ROLE PERMISSIONS
   */
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
        initialData.sexe === "M"
          ? "masculin"
          : initialData.sexe === "F"
            ? "feminin"
            : "masculin",

      orgRole: initialData.orgRole ?? "",
      dateOfBirth: initialData.dateOfBirth ?? undefined,
    });

    if (initialData.orgRole) {
      setPermissions(getRolePermissions(initialData.orgRole));
    }
  }, [initialData, form]);

  /**
   * AUTO UPDATE PERMISSIONS WHEN ROLE CHANGES
   */
  useEffect(() => {
    if (!selectedRole) return;

    setPermissions(getRolePermissions(selectedRole));
  }, [selectedRole]);

  function togglePermission(p: string) {
    setPermissions((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  async function onSubmit(data: PersonnelFullFormValues) {
    setLoading(true);

    try {
      const [, err] = await updatePersonnelFullAction({
        ...data,
        sexe: data.sexe === "masculin" ? "M" : "F",
      });

      if (err) throw new Error(err.message);

      toast.success("Personnel mis à jour avec succès");
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="h-[500px] flex">
      {/* LEFT PANEL - ROLES */}
      <div className="w-1/2 border-r p-4 space-y-2 overflow-auto">
        <h2 className="font-semibold text-sm">Sélectionner un rôle</h2>

        {ORGANIZATION_ROLE_SLUGS.map((role) => (
          <div
            key={role}
            onClick={() => form.setValue("orgRole", role as string)}
            className={`p-2 rounded-md cursor-pointer border flex items-center justify-between
              ${selectedRole === role ? "bg-primary text-white" : ""}`}
          >
            {role}
            {selectedRole === role && "✓"}
          </div>
        ))}
      </div>

      {/* RIGHT PANEL - ROLE PERMISSIONS */}
      <div className="w-1/2 p-4 space-y-3">
        <h2 className="font-semibold text-sm">Permissions du rôle</h2>

        <Input placeholder="Rechercher (optionnel)" />

        <div className="text-xs text-muted-foreground">
          Total: {permissions.length} permissions
        </div>

        <div className="space-y-2 max-h-[320px] overflow-auto">
          {permissions.map((perm) => (
            <div key={perm} className="flex items-center gap-2">
              <Checkbox
                checked
                onCheckedChange={() => togglePermission(perm)}
              />
              <div className="text-sm">{perm}</div>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset(EMPTY_VALUES)}
          >
            Annuler
          </Button>

          <Button loading={loading} type="submit">
            {mode === "create" ? "Attribuer rôle" : "Mettre à jour"}
          </Button>
        </div>
      </div>
    </form>
  );
}
