"use client";

import { useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileText,
  Globe,
  ImageIcon,
  Loader2,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Textarea } from "@/components/ui/textarea";

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

  const imageInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

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
        if (typeof value === "boolean") {
          /*
           * Ton action serveur vérifie actuellement :
           * formData.get("isActive") === "on"
           */
          if (value) {
            formData.append(key, "on");
          }

          return;
        }

        formData.append(key, String(value ?? ""));
      });

      const imageFile = imageInputRef.current?.files?.[0];
      const logoFile = logoInputRef.current?.files?.[0];
      const documentFile = documentInputRef.current?.files?.[0];

      if (imageFile) {
        formData.append("imageFile", imageFile);
      }

      if (logoFile) {
        formData.append("logoFile", logoFile);
      }

      if (documentFile) {
        formData.append("documentFile", documentFile);
      }

      const res = await createPartenaireAction(formData);

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success("Partenaire créé avec succès.");

      router.replace(`/admin/organizations/${organizationId}/partenaires`);
    });
  }

  function setFileName(
    field: "image" | "logo" | "documentUrl",
    files: FileList | null,
  ) {
    const file = files?.[0];

    if (!file) {
      form.setValue(field, "", {
        shouldDirty: true,
        shouldValidate: true,
      });

      return;
    }

    form.setValue(field, file.name, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom du partenaire</FormLabel>

                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <FormControl>
                    <Input
                      {...field}
                      disabled={pending}
                      placeholder="Ex. UNICEF, Fondation..."
                      className="h-12 rounded-2xl pl-10"
                    />
                  </FormControl>
                </div>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Téléphone</FormLabel>

                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <FormControl>
                    <Input
                      {...field}
                      disabled={pending}
                      placeholder="+243..."
                      maxLength={15}
                      className="h-12 rounded-2xl pl-10"
                    />
                  </FormControl>
                </div>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>

                <FormControl>
                  <Input
                    {...field}
                    disabled={pending}
                    placeholder="École partenaire, ONG, entreprise..."
                    className="h-12 rounded-2xl"
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="secteur"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Secteur</FormLabel>

                <FormControl>
                  <Input
                    {...field}
                    disabled={pending}
                    placeholder="Éducation, santé, technologie..."
                    className="h-12 rounded-2xl"
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

                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      disabled={pending}
                      placeholder="contact@example.com"
                      className="h-12 rounded-2xl pl-10"
                    />
                  </FormControl>
                </div>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Site web</FormLabel>

                <div className="relative">
                  <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <FormControl>
                    <Input
                      {...field}
                      disabled={pending}
                      placeholder="https://..."
                      className="h-12 rounded-2xl pl-10"
                    />
                  </FormControl>
                </div>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="image"
            render={() => (
              <FormItem>
                <FormLabel>Image principale</FormLabel>

                <div className="relative">
                  <ImageIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />

                  <FormControl>
                    <Input
                      ref={imageInputRef}
                      name="imageFile"
                      type="file"
                      disabled={pending}
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={(event) =>
                        setFileName("image", event.target.files)
                      }
                      className="h-12 cursor-pointer rounded-2xl pl-10 file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-blue-950"
                    />
                  </FormControl>
                </div>

                <FormDescription>
                  Formats acceptés : PNG, JPG, JPEG et WebP.
                </FormDescription>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="logo"
            render={() => (
              <FormItem>
                <FormLabel>Logo</FormLabel>

                <div className="relative">
                  <ImageIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />

                  <FormControl>
                    <Input
                      ref={logoInputRef}
                      name="logoFile"
                      type="file"
                      disabled={pending}
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={(event) =>
                        setFileName("logo", event.target.files)
                      }
                      className="h-12 cursor-pointer rounded-2xl pl-10 file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-blue-950"
                    />
                  </FormControl>
                </div>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="branchId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branche liée</FormLabel>

                <Select
                  disabled={pending}
                  value={field.value || "none"}
                  onValueChange={(value) => {
                    field.onChange(value === "none" ? "" : value);
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 rounded-2xl">
                      <SelectValue placeholder="Choisir une branche" />
                    </SelectTrigger>
                  </FormControl>

                  <SelectContent>
                    <SelectItem value="none">
                      Aucune branche spécifique
                    </SelectItem>

                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ville"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ville</FormLabel>

                <FormControl>
                  <Input
                    {...field}
                    disabled={pending}
                    placeholder="Kinshasa"
                    className="h-12 rounded-2xl"
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pays</FormLabel>

                <FormControl>
                  <Input
                    {...field}
                    disabled={pending}
                    placeholder="RDC"
                    className="h-12 rounded-2xl"
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Personne de contact</FormLabel>

                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <FormControl>
                    <Input
                      {...field}
                      disabled={pending}
                      placeholder="Nom du contact"
                      className="h-12 rounded-2xl pl-10"
                    />
                  </FormControl>
                </div>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactRole"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fonction du contact</FormLabel>

                <FormControl>
                  <Input
                    {...field}
                    disabled={pending}
                    placeholder="Directeur, responsable..."
                    className="h-12 rounded-2xl"
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="adresse"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Adresse</FormLabel>

                <FormControl>
                  <Input
                    {...field}
                    disabled={pending}
                    placeholder="Adresse complète"
                    className="h-12 rounded-2xl"
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contractRef"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Référence du contrat</FormLabel>

                <FormControl>
                  <Input
                    {...field}
                    disabled={pending}
                    placeholder="REF-2026..."
                    className="h-12 rounded-2xl"
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="documentUrl"
            render={() => (
              <FormItem>
                <FormLabel>Document</FormLabel>

                <div className="relative">
                  <FileText className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />

                  <FormControl>
                    <Input
                      ref={documentInputRef}
                      name="documentFile"
                      type="file"
                      disabled={pending}
                      onChange={(event) =>
                        setFileName("documentUrl", event.target.files)
                      }
                      className="h-12 cursor-pointer rounded-2xl pl-10 file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-blue-950"
                    />
                  </FormControl>
                </div>

                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>

              <FormControl>
                <Textarea
                  {...field}
                  disabled={pending}
                  rows={4}
                  placeholder="Décrivez le partenariat..."
                  className="resize-none rounded-2xl"
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes internes</FormLabel>

              <FormControl>
                <Textarea
                  {...field}
                  disabled={pending}
                  rows={3}
                  placeholder="Notes visibles uniquement dans l’administration..."
                  className="resize-none rounded-2xl"
                />
              </FormControl>

              <FormDescription>
                Ces notes ne seront pas affichées sur la page publique.
              </FormDescription>

              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-2xl border bg-white p-4">
                <div className="space-y-1">
                  <FormLabel className="cursor-pointer">
                    Partenaire actif
                  </FormLabel>

                  <FormDescription>
                    Autoriser son affichage sur le site public.
                  </FormDescription>
                </div>

                <FormControl>
                  <Checkbox
                    checked={field.value}
                    disabled={pending}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isFeatured"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-2xl border bg-white p-4">
                <div className="space-y-1">
                  <FormLabel className="cursor-pointer">
                    Mettre en avant
                  </FormLabel>

                  <FormDescription>
                    Afficher ce partenaire en priorité.
                  </FormDescription>
                </div>

                <FormControl>
                  <Checkbox
                    checked={field.value}
                    disabled={pending}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-full px-5 sm:w-auto"
            asChild
          >
            <Link href={`/admin/organizations/${organizationId}/partenaires`}>
              Annuler
            </Link>
          </Button>

          <Button
            type="submit"
            disabled={pending}
            className="h-11 w-full rounded-full bg-blue-950 px-5 text-white shadow-lg shadow-blue-950/20 hover:bg-blue-950/90 sm:w-auto"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Création...
              </>
            ) : (
              "Créer le partenaire"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
