"use client";

import { useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import Link from "next/link";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Building2, Shield, UserRound } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { isCycleGlobalRole } from "@/lib/auth/cycle-global-roles";
import { formatPersonFullName } from "@/lib/person-full-name";
import { MAX_IMAGE_UPLOAD_BYTES, uploadFile } from "@/lib/upload-file";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrganizationMemberAction } from "../actions";
import {
  MemberBranchPicker,
  type MemberBranchOption,
} from "../branch-picker";
import { MemberPhotoField } from "../member-photo-field";
import {
  MemberFormLayout,
  MemberFormSection,
  MemberFormSummaryRow,
  memberFieldClass,
} from "../member-form-section";
import {
  createOrgMemberFormSchema,
  type CreateOrgMemberFormInput,
} from "../schema";
import { DateOfBirthPicker } from "@/components/date-of-birth-picker";

type Props = {
  organizationId: string;
  branches: MemberBranchOption[];
};

function initialBranchCycles(
  branchIds: string[],
  branches: MemberBranchOption[],
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const id of branchIds) {
    const branch = branches.find((b) => b.id === id);
    if (!branch) continue;
    if (!branch.isMultiCycle && branch.cycles[0]) {
      next[id] = [branch.cycles[0].value];
    } else {
      next[id] = [];
    }
  }
  return next;
}

export function CreateMemberForm({ organizationId, branches }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cyclesError, setCyclesError] = useState<string | undefined>();

  const defaultBranchIds =
    branches.length === 1 ? [branches[0]!.id] : [];

  const form = useForm<CreateOrgMemberFormInput>({
    resolver: zodResolver(createOrgMemberFormSchema),
    defaultValues: {
      organizationId,
      email: "",
      nom: "",
      postnom: "",
      prenom: "",
      dateOfBirth: undefined,
      orgRole: ALL_ORG_ROLE_SLUGS[2],
      branchIds: defaultBranchIds,
      branchCycles: initialBranchCycles(defaultBranchIds, branches),
    },
  });

  const branchIds = useWatch({ control: form.control, name: "branchIds" }) ?? [];
  const branchCycles =
    useWatch({ control: form.control, name: "branchCycles" }) ?? {};
  const nom = useWatch({ control: form.control, name: "nom" }) ?? "";
  const postnom = useWatch({ control: form.control, name: "postnom" }) ?? "";
  const prenom = useWatch({ control: form.control, name: "prenom" }) ?? "";
  const email = useWatch({ control: form.control, name: "email" }) ?? "";
  const orgRole = useWatch({ control: form.control, name: "orgRole" }) ?? "";
  const fullName = formatPersonFullName({ name: nom, postnom, prenom });
  const showCycles = !isCycleGlobalRole(orgRole);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const listHref = `/admin/organizations/${organizationId}/members`;

  function handlePickPhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image (JPEG, PNG, WebP…).");
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.error("Image trop volumineuse (max. 5 Mo).");
      return;
    }
    setPhotoPreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setPhotoFile(file);
  }

  function validateCycles(
    selected: string[],
    cycles: Record<string, string[]>,
    role: string,
  ): string | undefined {
    if (isCycleGlobalRole(role)) return undefined;
    for (const branchId of selected) {
      const branch = branches.find((b) => b.id === branchId);
      if (!branch?.isMultiCycle) continue;
      if (!cycles[branchId]?.length) {
        return `Sélectionnez au moins un cycle pour « ${branch.name} ».`;
      }
    }
    return undefined;
  }

  function onSubmit(values: CreateOrgMemberFormInput) {
    const selected = values.branchIds ?? [];
    if (selected.length === 0) {
      toast.error("Sélectionnez au moins une branche.");
      return;
    }

    const cycleErr = validateCycles(
      selected,
      values.branchCycles ?? {},
      values.orgRole,
    );
    if (cycleErr) {
      setCyclesError(cycleErr);
      toast.error(cycleErr);
      return;
    }
    setCyclesError(undefined);

    startTransition(async () => {
      let image = "";
      if (photoFile) {
        const uploaded = await uploadFile(photoFile);
        if (!uploaded.ok) {
          toast.error(uploaded.message);
          return;
        }
        image = uploaded.url;
      }

      const res = await createOrganizationMemberAction({
        ...values,
        name: values.nom,
        postnom: values.postnom,
        prenom: values.prenom,
        image,
        organizationId,
        branchIds: selected,
        branchCycles: values.branchCycles,
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success("Membre créé. Un mot de passe temporaire a été envoyé.");
      router.push(listHref);
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input type="hidden" {...form.register("organizationId")} />
      <MemberFormLayout
        aside={
          <>
            <Card className="gap-0 py-0 shadow-sm">
              <CardHeader className="border-b border-border/80 py-4">
                <CardTitle>Récapitulatif</CardTitle>
                <CardDescription>
                  Vérifiez les informations avant de créer le compte.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 py-4 text-sm">
                <MemberFormSummaryRow
                  label="Nom"
                  value={fullName || "—"}
                />
                <MemberFormSummaryRow
                  label="Email"
                  value={email.trim() || "—"}
                />
                <MemberFormSummaryRow
                  label="Rôle"
                  value={orgRoleLabel(orgRole)}
                />
                <MemberFormSummaryRow
                  label="Établissements"
                  value={
                    branchIds.length === 0
                      ? "Aucun"
                      : `${branchIds.length} sélectionné${branchIds.length > 1 ? "s" : ""}`
                  }
                />
              </CardContent>
            </Card>
            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                disabled={pending || branches.length === 0}
                className="h-11 w-full"
              >
                {pending ? "Création…" : "Créer le membre"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                disabled={pending}
                asChild
              >
                <Link href={listHref}>Annuler</Link>
              </Button>
            </div>
          </>
        }
      >
        <MemberFormSection
          icon={UserRound}
          title="Identité"
          description="Nom, postnom, prénom et photo, comme pour un élève. L’email sert à l’envoi du mot de passe temporaire."
        >
          <div className="grid gap-4">
            <MemberPhotoField
              previewUrl={photoPreview}
              onPickFile={handlePickPhoto}
              disabled={pending}
              fullName={fullName}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-nom">Nom</Label>
                <Input
                  id="create-nom"
                  {...form.register("nom")}
                  autoComplete="family-name"
                  placeholder="Ex. Kabila"
                  className={memberFieldClass}
                  disabled={pending}
                />
                <FormError message={form.formState.errors.nom?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-postnom">Postnom</Label>
                <Input
                  id="create-postnom"
                  {...form.register("postnom")}
                  placeholder="Ex. Kabange"
                  className={memberFieldClass}
                  disabled={pending}
                />
                <FormError message={form.formState.errors.postnom?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-prenom">Prénom</Label>
                <Input
                  id="create-prenom"
                  {...form.register("prenom")}
                  autoComplete="given-name"
                  placeholder="Ex. Marie"
                  className={memberFieldClass}
                  disabled={pending}
                />
                <FormError message={form.formState.errors.prenom?.message} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-dob">Date de naissance</Label>
              <DateOfBirthPicker
                id="create-dob"
                value={form.watch("dateOfBirth")}
                onChange={(date) =>
                  form.setValue("dateOfBirth", date as Date, {
                    shouldValidate: true,
                  })
                }
                disabled={pending}
                className={memberFieldClass}
              />
              <FormError message={form.formState.errors.dateOfBirth?.message} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                {...form.register("email")}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="membre@example.com"
                className={memberFieldClass}
                disabled={pending}
              />
              <FormError message={form.formState.errors.email?.message} />
            </div>
          </div>
        </MemberFormSection>

        <MemberFormSection
          icon={Shield}
          title="Accès"
          description="Le rôle détermine les droits dans l’organisation."
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-role">Rôle dans l’organisation</Label>
            <select
              id="create-role"
              {...form.register("orgRole")}
              disabled={pending}
              className={memberFieldClass + " border bg-background px-3"}
            >
              {ALL_ORG_ROLE_SLUGS.map((slug) => (
                <option key={slug} value={slug}>
                  {orgRoleLabel(slug)}
                </option>
              ))}
            </select>
            <FormError message={form.formState.errors.orgRole?.message} />
          </div>
        </MemberFormSection>

        <MemberFormSection
          icon={Building2}
          title="Affectation"
          description={
            showCycles
              ? "Choisissez la ou les branches, puis le(s) cycle(s) pour chaque établissement multi-cycle."
              : "Le membre ne pourra ouvrir que les établissements cochés."
          }
        >
          <MemberBranchPicker
            branches={branches}
            value={branchIds}
            onChange={(ids) =>
              form.setValue("branchIds", ids, { shouldDirty: true })
            }
            branchCycles={branchCycles}
            onBranchCyclesChange={(next) => {
              form.setValue("branchCycles", next, { shouldDirty: true });
              if (cyclesError) setCyclesError(undefined);
            }}
            showCycles={showCycles}
            disabled={pending}
            error={form.formState.errors.branchIds?.message}
            cyclesError={cyclesError}
          />
        </MemberFormSection>
      </MemberFormLayout>
    </form>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}
