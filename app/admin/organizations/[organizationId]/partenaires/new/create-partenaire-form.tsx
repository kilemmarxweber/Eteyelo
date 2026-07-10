"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Globe,
  ImageIcon,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createPartenaireSchema, type CreatePartenaireInput } from "../schema";
import { createPartenaireAction } from "../actions";

type BranchOption = {
  id: string;
  name: string;
};

type Props = {
  organizationId: string;
  branches: BranchOption[];
};

export function CreatePartenaireForm({ organizationId, branches }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<CreatePartenaireInput>({
    resolver: zodResolver(createPartenaireSchema),
    defaultValues: {
      name: "",
      slug: "",
      type: "",
      secteur: "",
      description: "",
      image: "",
      logo: "",
      tel: "",
      email: "",
      website: "",
      adresse: "",
      ville: "",
      pays: "RDC",
      contactName: "",
      contactRole: "",
      documentUrl: "",
      contractRef: "",
      notes: "",
      branchId: "",
      isActive: true,
      isFeatured: false,
    },
  });

  function onSubmit(values: CreatePartenaireInput) {
    startTransition(async () => {
      const formData = new FormData();

      Object.entries(values).forEach(([key, value]) => {
        formData.append(key, String(value ?? ""));
      });

      const imageFile = document.querySelector<HTMLInputElement>(
        'input[name="imageFile"]',
      )?.files?.[0];

      const logoFile = document.querySelector<HTMLInputElement>(
        'input[name="logoFile"]',
      )?.files?.[0];

      const documentFile = document.querySelector<HTMLInputElement>(
        'input[name="documentFile"]',
      )?.files?.[0];

      if (imageFile) formData.append("imageFile", imageFile);
      if (logoFile) formData.append("logoFile", logoFile);
      if (documentFile) formData.append("documentFile", documentFile);

      const res = await createPartenaireAction(formData);

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success("Partenaire créé avec succès.");
      router.push(`/admin/organizations/${organizationId}/partenaires`);
      router.refresh();
    });
  }

  function setFileName(
    field: "image" | "logo" | "documentUrl",
    files: FileList | null,
  ) {
    const file = files?.[0];
    if (!file) return;

    form.setValue(field, file.name, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Nom du partenaire
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <Building2 className="size-4 text-muted-foreground" />
            <input
              {...form.register("name")}
              disabled={pending}
              placeholder="Ex. UNICEF, Fondation..."
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <FormError message={form.formState.errors.name?.message} />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Téléphone
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <Phone className="size-4 text-muted-foreground" />
            <input
              {...form.register("tel")}
              disabled={pending}
              placeholder="+243..."
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <FormError message={form.formState.errors.tel?.message} />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Type
          <input
            {...form.register("type")}
            disabled={pending}
            placeholder="École partenaire, ONG, entreprise..."
            className="h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Secteur
          <input
            {...form.register("secteur")}
            disabled={pending}
            placeholder="Éducation, santé, technologie..."
            className="h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Email
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <Mail className="size-4 text-muted-foreground" />
            <input
              {...form.register("email")}
              disabled={pending}
              type="email"
              placeholder="contact@example.com"
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <FormError message={form.formState.errors.email?.message} />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Site web
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <Globe className="size-4 text-muted-foreground" />
            <input
              {...form.register("website")}
              disabled={pending}
              placeholder="https://..."
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
        </label>

        <label className="space-y-2 text-sm font-medium">
          Image principale
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <ImageIcon className="size-4 text-muted-foreground" />
            <input
              name="imageFile"
              type="file"
              disabled={pending}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) => setFileName("image", e.target.files)}
              className="h-12 w-full bg-transparent text-sm outline-none file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-blue-950"
            />
          </div>
          <input type="hidden" {...form.register("image")} />
          <FormError message={form.formState.errors.image?.message} />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Logo
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <ImageIcon className="size-4 text-muted-foreground" />
            <input
              name="logoFile"
              type="file"
              disabled={pending}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) => setFileName("logo", e.target.files)}
              className="h-12 w-full bg-transparent text-sm outline-none file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-blue-950"
            />
          </div>
          <input type="hidden" {...form.register("logo")} />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Branche liée
          <select
            {...form.register("branchId")}
            disabled={pending}
            className="h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none"
          >
            <option value="">Aucune branche spécifique</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-medium">
          Ville
          <input
            {...form.register("ville")}
            disabled={pending}
            placeholder="Kinshasa"
            className="h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Pays
          <input
            {...form.register("pays")}
            disabled={pending}
            placeholder="RDC"
            className="h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Personne contact
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-3">
            <UserRound className="size-4 text-muted-foreground" />
            <input
              {...form.register("contactName")}
              disabled={pending}
              placeholder="Nom du contact"
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
        </label>

        <label className="space-y-2 text-sm font-medium">
          Fonction du contact
          <input
            {...form.register("contactRole")}
            disabled={pending}
            placeholder="Directeur, responsable..."
            className="h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none"
          />
        </label>

        <label className="space-y-2 text-sm font-medium md:col-span-2">
          Adresse
          <input
            {...form.register("adresse")}
            disabled={pending}
            placeholder="Adresse complète"
            className="h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Référence contrat
          <input
            {...form.register("contractRef")}
            disabled={pending}
            placeholder="REF-2026..."
            className="h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Document
          <input
            name="documentFile"
            type="file"
            disabled={pending}
            onChange={(e) => setFileName("documentUrl", e.target.files)}
            className="h-12 w-full rounded-2xl border bg-white px-4 py-2 text-sm outline-none"
          />
          <input type="hidden" {...form.register("documentUrl")} />
        </label>
      </div>

      <label className="block space-y-2 text-sm font-medium">
        Description
        <textarea
          {...form.register("description")}
          disabled={pending}
          rows={4}
          placeholder="Décrivez le partenariat..."
          className="w-full resize-none rounded-2xl border bg-white px-4 py-3 text-sm outline-none"
        />
      </label>

      <label className="block space-y-2 text-sm font-medium">
        Notes internes
        <textarea
          {...form.register("notes")}
          disabled={pending}
          rows={3}
          placeholder="Notes visibles uniquement dans l’administration..."
          className="w-full resize-none rounded-2xl border bg-white px-4 py-3 text-sm outline-none"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between rounded-2xl border bg-white px-4 py-3 text-sm font-medium">
          Partenaire actif
          <input
            type="checkbox"
            {...form.register("isActive")}
            disabled={pending}
            className="size-4"
          />
        </label>

        <label className="flex items-center justify-between rounded-2xl border bg-white px-4 py-3 text-sm font-medium">
          Mettre en avant
          <input
            type="checkbox"
            {...form.register("isFeatured")}
            disabled={pending}
            className="size-4"
          />
        </label>
      </div>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Link
          href={`/admin/organizations/${organizationId}/partenaires`}
          className="inline-flex h-11 w-full items-center justify-center rounded-full border bg-white px-5 text-sm font-semibold transition hover:bg-slate-50 sm:w-auto"
        >
          Annuler
        </Link>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-blue-950 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-950/90 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {pending ? "Création..." : "Créer le partenaire"}
        </button>
      </div>
    </form>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-600">{message}</p>;
}
