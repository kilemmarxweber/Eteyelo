"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  BadgeCheck,
  Building2,
  MapPin,
  Navigation,
  Phone,
  School,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createBranchFormSchema,
  type CreateBranchFormValues,
} from "../../schema";
import { createBranchAction, updateBranchAction } from "../../branche.action";
import { useState } from "react";
import { z } from "zod";

const BranchMapPicker = dynamic(() => import("./branch-map-picker"), {
  ssr: false,
});

type CreateBranchFormProps = {
  organizationId: string;
  mode?: "create" | "update";
  branchId?: string;
  defaultValues?: Partial<CreateBranchFormValues>;
};

export function CreateBranchForm({
  organizationId,
  mode = "create",
  branchId,
  defaultValues,
}: CreateBranchFormProps) {
  const router = useRouter();
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const form = useForm<CreateBranchFormValues>({
    resolver: zodResolver(createBranchFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      code: defaultValues?.code ?? "",
      image: defaultValues?.image ?? {
        logo: "",
        event: [],
        gallery: [],
        ecole: [],
      },
      adresse: defaultValues?.adresse ?? "",
      ville: defaultValues?.ville ?? "",
      pays: defaultValues?.pays ?? "RDC",
      idnat: defaultValues?.idnat ?? "",
      tel: defaultValues?.tel ?? "",
      latitude: defaultValues?.latitude ?? -4.4419,
      longitude: defaultValues?.longitude ?? 15.2663,
      attendanceRadius: defaultValues?.attendanceRadius ?? 100,
      typebranch: defaultValues?.typebranch ?? "SECONDAIRE",
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const { isSubmitting } = form.formState;

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      );

      const data = await res.json();
      const address = data.address;

      form.setValue(
        "ville",
        address.city ||
          address.town ||
          address.village ||
          address.municipality ||
          address.county ||
          "",
        { shouldValidate: true },
      );

      form.setValue("pays", address.country || "", {
        shouldValidate: true,
      });
    } catch {
      toast.error("Impossible de récupérer la ville et le pays.");
    }
  }

  function useCurrentLocation() {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        form.setValue("latitude", lat, { shouldValidate: true });
        form.setValue("longitude", lng, { shouldValidate: true });

        await reverseGeocode(lat, lng);

        toast.success("Position récupérée avec succès.");
      },
      () => {
        toast.error("Impossible de récupérer votre position.");
      },
    );
  }

  async function onSubmit(values: CreateBranchFormValues) {
    form.clearErrors("root");

    try {
      const formData = new FormData();

      formData.append("name", values.name ?? "");
      formData.append("code", values.code ?? "");
      formData.append("adresse", values.adresse ?? "");
      formData.append("ville", values.ville ?? "");
      formData.append("pays", values.pays ?? "");
      formData.append("idnat", values.idnat ?? "");
      formData.append("tel", values.tel ?? "");
      formData.append("latitude", String(values.latitude ?? ""));
      formData.append("longitude", String(values.longitude ?? ""));
      formData.append("attendanceRadius", String(values.attendanceRadius ?? ""));
      formData.append("typebranch", values.typebranch ?? "SECONDAIRE");
      formData.append("image", JSON.stringify(values.image ?? {
        logo: "",
        event: [],
        gallery: [],
        ecole: [],
      }));

      const logoFile = document.querySelector<HTMLInputElement>(
        'input[name="logoFile"]',
      )?.files?.[0];
      const eventFiles = document.querySelector<HTMLInputElement>(
        'input[name="eventFiles"]',
      )?.files;
      const galleryFiles = document.querySelector<HTMLInputElement>(
        'input[name="galleryFiles"]',
      )?.files;
      const ecoleFiles = document.querySelector<HTMLInputElement>(
        'input[name="ecoleFiles"]',
      )?.files;

      if (logoFile) formData.append("logoFile", logoFile);
      Array.from(eventFiles ?? []).forEach((file) =>
        formData.append("eventFiles", file),
      );
      Array.from(galleryFiles ?? []).forEach((file) =>
        formData.append("galleryFiles", file),
      );
      Array.from(ecoleFiles ?? []).forEach((file) =>
        formData.append("ecoleFiles", file),
      );

      const result =
        mode === "update" && branchId
          ? await updateBranchAction(branchId, formData)
          : await createBranchAction(organizationId, formData);

      if (result.error) {
        form.setError("root", {
          type: "server",
          message: result.error,
        });
        toast.error(result.error);
        return;
      }

      toast.success(
        mode === "update" ? "Établissement modifié." : "Établissement créé.",
      );

      router.push(`/admin/organizations/${organizationId}/branches`);
      router.refresh();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Impossible de joindre le serveur.";

      form.setError("root", {
        type: "server",
        message:
          mode === "update"
            ? "Modification impossible. Réessayez plus tard."
            : "Création impossible. Réessayez plus tard.",
      });

      toast.error(message);
    }
  }

  const latitude = form.watch("latitude");
  const longitude = form.watch("longitude");

  const images = form.watch("image") ?? {
    logo: "",
    event: [],
    gallery: [],
    ecole: [],
  };

  function setLogo(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    form.setValue("image.logo", file.name, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  function addImages(
    type: "event" | "gallery" | "ecole",
    files: FileList | null,
  ) {
    if (!files?.length) return;

    const names = Array.from(files).map((file) => file.name);
    const current = form.getValues(`image.${type}`) ?? [];

    form.setValue(`image.${type}`, [...current, ...names], {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  function removeImage(type: "event" | "gallery" | "ecole", index: number) {
    const current = form.getValues(`image.${type}`) ?? [];

    form.setValue(
      `image.${type}`,
      current.filter((_, i) => i !== index),
      {
        shouldValidate: true,
        shouldDirty: true,
      },
    );
  }

  function removeLogo() {
    form.setValue("image.logo", "", {
      shouldValidate: true,
      shouldDirty: true,
    });
  }
  return (
    <>
      <Form {...form}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit(onSubmit)(e);
          }}
        >
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="flex flex-col rounded-3xl bg-blue-950 p-7 text-white shadow-2xl shadow-blue-950/10 md:p-9">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
                <School className="size-4" />
                Inscription école
              </div>

              <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                Ajoutez votre établissement
              </h1>

              <p className="mt-4 max-w-[430px] text-sm leading-7 text-blue-50 md:text-base">
                Créez la fiche de votre école, indiquez ses coordonnées et
                positionnez-la sur la carte pour faciliter la recherche locale.
              </p>

              {/* Les cartes sont maintenant juste sous le texte */}
              <div className="mt-6 grid gap-3 text-sm">
                <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
                  <BadgeCheck className="mt-0.5 size-5 shrink-0" />
                  <span>
                    Une fiche claire pour présenter votre établissement.
                  </span>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
                  <MapPin className="mt-0.5 size-5 shrink-0" />
                  <span>
                    Une localisation précise pour les élèves et les parents.
                  </span>
                </div>
              </div>
            </section>

            <section className="grid gap-5">
              <div className="rounded-3xl border bg-white p-6 shadow-sm md:p-7">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-950 text-white">
                    <Building2 className="size-5" />
                  </span>

                  <div>
                    <h2 className="text-2xl font-bold text-slate-950">
                      Informations de l’école
                    </h2>
                    <p className="text-sm text-slate-500">
                      Les champs essentiels permettent de créer la fiche de
                      base.
                    </p>
                  </div>
                </div>

                <div className="mt-7 grid gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de l’établissement</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Nom de l’école *"
                            autoComplete="organization"
                            className="h-12 rounded-2xl"
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="idnat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID NAT</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="ID NAT"
                              className="h-12 rounded-2xl"
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="typebranch"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type de branche</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isSubmitting}
                          >
                            <FormControl>
                              <SelectTrigger className="h-12 rounded-2xl">
                                <SelectValue placeholder="Selectionner le type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="PRIMAIRE">Primaire</SelectItem>
                              <SelectItem value="SECONDAIRE">
                                Secondaire
                              </SelectItem>
                            </SelectContent>
                          </Select>
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
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-4 h-4 w-4 text-slate-400" />
                              <Input
                                {...field}
                                type="tel"
                                inputMode="tel"
                                maxLength={15}
                                placeholder="+243xxxxxxxxx"
                                className="h-12 rounded-2xl pl-10"
                                disabled={isSubmitting}
                                onChange={(e) => {
                                  const value = e.target.value
                                    .replace(/[^\d+]/g, "")
                                    .slice(0, 15);

                                  field.onChange(value);
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="adresse"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresse</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Adresse"
                            className="h-12 rounded-2xl"
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="ville"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ville</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ville"
                              className="h-12 rounded-2xl"
                              disabled={isSubmitting}
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
                              placeholder="Pays"
                              className="h-12 rounded-2xl"
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="latitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Latitude</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="any"
                              placeholder="-4.4419"
                              className="h-12 rounded-2xl"
                              disabled={isSubmitting}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="longitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Longitude</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="any"
                              placeholder="15.2663"
                              className="h-12 rounded-2xl"
                              disabled={isSubmitting}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="attendanceRadius"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rayon présence</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={10}
                              step={1}
                              placeholder="100"
                              className="h-12 rounded-2xl"
                              disabled={isSubmitting}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormDescription>
                    Le rayon est exprimé en mètres pour valider une présence.
                  </FormDescription>

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <Button
                      type="button"
                      onClick={useCurrentLocation}
                      variant="outline"
                      disabled={isSubmitting}
                      className="h-12 rounded-full border-blue-950/20 text-blue-950 hover:bg-blue-50"
                    >
                      <Navigation className="mr-2 h-4 w-4" />
                      Utiliser ma position actuelle
                    </Button>

                    <div className="flex h-12 items-center justify-between gap-3 rounded-full border border-blue-950/10 bg-blue-50/60 px-4">
                      <span className="text-sm font-medium text-blue-950">
                        Utiliser la carte
                      </span>

                      <Switch
                        checked={showMapDialog}
                        onCheckedChange={(checked) => {
                          setShowMapDialog(checked);
                        }}
                      />
                    </div>
                  </div>

                  {form.formState.errors.root && (
                    <p className="text-sm text-destructive" role="alert">
                      {form.formState.errors.root.message}
                    </p>
                  )}
                  <div className="rounded-3xl border bg-white p-5">
                    <h3 className="text-lg font-bold text-slate-950">
                      Images de l’établissement
                    </h3>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div>
                        <FormLabel>Logo</FormLabel>
                        <Input
                          name="logoFile"
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="mt-2 h-12 rounded-2xl"
                          disabled={isSubmitting}
                          onChange={(e) => setLogo(e.target.files)}
                        />
                      </div>

                      <div>
                        <FormLabel>Images événements</FormLabel>
                        <Input
                          name="eventFiles"
                          type="file"
                          multiple
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="mt-2 h-12 rounded-2xl"
                          disabled={isSubmitting}
                          onChange={(e) => addImages("event", e.target.files)}
                        />
                      </div>

                      <div>
                        <FormLabel>Galerie</FormLabel>
                        <Input
                          name="galleryFiles"
                          type="file"
                          multiple
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="mt-2 h-12 rounded-2xl"
                          disabled={isSubmitting}
                          onChange={(e) => addImages("gallery", e.target.files)}
                        />
                      </div>
                      <div>
                        <FormLabel>Ecole</FormLabel>
                        <Input
                          name="ecoleFiles"
                          type="file"
                          multiple
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="mt-2 h-12 rounded-2xl"
                          disabled={isSubmitting}
                          onChange={(e) => addImages("ecole", e.target.files)}
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                      {images.logo && (
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm">
                          <span className="truncate">
                            <strong>Logo : </strong>
                            {images.logo}
                          </span>

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="rounded-full"
                            onClick={removeLogo}
                          >
                            Retirer
                          </Button>
                        </div>
                      )}

                      {images.event.map((fileName, index) => (
                        <div
                          key={`event-${fileName}-${index}`}
                          className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm"
                        >
                          <span className="truncate">
                            <strong>Événement : </strong>
                            {fileName}
                          </span>

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="rounded-full"
                            onClick={() => removeImage("event", index)}
                          >
                            Retirer
                          </Button>
                        </div>
                      ))}

                      {images.gallery.map((fileName, index) => (
                        <div
                          key={`gallery-${fileName}-${index}`}
                          className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm"
                        >
                          <span className="truncate">
                            <strong>Galerie : </strong>
                            {fileName}
                          </span>

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="rounded-full"
                            onClick={() => removeImage("gallery", index)}
                          >
                            Retirer
                          </Button>
                        </div>
                      ))}
                      {images.ecole.map((fileName, index) => (
                        <div
                          key={`ecole-${fileName}-${index}`}
                          className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm"
                        >
                          <span className="truncate">
                            <strong>École : </strong>
                            {fileName}
                          </span>

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="rounded-full"
                            onClick={() => removeImage("ecole", index)}
                          >
                            Retirer
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="sticky bottom-4 z-20 mt-5 rounded-3xl border bg-white/90 p-3 shadow-xl backdrop-blur">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="h-14 w-full rounded-full bg-blue-950 text-base font-semibold text-white hover:bg-blue-900"
                    >
                      {isSubmitting
                        ? mode === "update"
                          ? "Modification en cours..."
                          : "Création en cours..."
                        : mode === "update"
                          ? "Modifier l’établissement"
                          : "Créer l’école"}
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </form>
      </Form>
      <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
        <DialogContent className="max-w-5xl rounded-3xl p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-2xl font-bold text-slate-950">
              Emplacement de l’école
            </DialogTitle>
            <DialogDescription>
              Cliquez sur la carte pour pointer l’emplacement exact de l’école.
            </DialogDescription>
          </DialogHeader>

          <div className="px-4 pb-4">
            <BranchMapPicker
              latitude={Number(latitude)}
              longitude={Number(longitude)}
              onChange={async (lat, lng) => {
                form.setValue("latitude", lat, { shouldValidate: true });
                form.setValue("longitude", lng, { shouldValidate: true });

                await reverseGeocode(lat, lng);
              }}
            />

            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-blue-950">
                <BadgeCheck className="mt-0.5 size-5 shrink-0" />
                <span>
                  Une fiche claire pour présenter votre établissement.
                </span>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-blue-950">
                <MapPin className="mt-0.5 size-5 shrink-0" />
                <span>
                  Une localisation précise pour les élèves et les parents.
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
