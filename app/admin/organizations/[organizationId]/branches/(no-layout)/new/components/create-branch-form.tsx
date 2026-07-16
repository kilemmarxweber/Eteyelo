"use client";

import dynamic from "next/dynamic";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
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
import { uploadFile, uploadFiles } from "@/lib/upload-file";
import { useState } from "react";

type BranchImages = {
  logo: string;
  event: string[];
  gallery: string[];
  ecole: string[];
};

type PendingBranchFiles = {
  logo: File | null;
  event: File[];
  gallery: File[];
  ecole: File[];
};

const emptyBranchImages = (): BranchImages => ({
  logo: "",
  event: [],
  gallery: [],
  ecole: [],
});

const emptyPendingFiles = (): PendingBranchFiles => ({
  logo: null,
  event: [],
  gallery: [],
  ecole: [],
});

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
  const [savedImages, setSavedImages] = useState<BranchImages>(
    defaultValues?.image ?? emptyBranchImages(),
  );
  const [pendingFiles, setPendingFiles] =
    useState<PendingBranchFiles>(emptyPendingFiles);
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
      province: defaultValues?.province ?? "",
      ville: defaultValues?.ville ?? "",
      commune: defaultValues?.commune ?? "",
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

      form.setValue(
        "commune",
        address.suburb ||
          address.municipality ||
          address.city_district ||
          address.county ||
          "",
        { shouldValidate: true },
      );

      form.setValue(
        "province",
        address.state || address.region || address.province || "",
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

  async function buildFinalImages(): Promise<BranchImages> {
    let logo = savedImages.logo;

    if (pendingFiles.logo) {
      const uploadedLogo = await uploadFile(pendingFiles.logo);
      if (!uploadedLogo.ok) {
        throw new Error(uploadedLogo.message);
      }
      logo = uploadedLogo.fileName;
    }

    const [event, gallery, ecole] = await Promise.all([
      uploadFiles(pendingFiles.event).then(
        (names) => [...savedImages.event, ...names],
      ),
      uploadFiles(pendingFiles.gallery).then(
        (names) => [...savedImages.gallery, ...names],
      ),
      uploadFiles(pendingFiles.ecole).then(
        (names) => [...savedImages.ecole, ...names],
      ),
    ]);

    return { logo, event, gallery, ecole };
  }

  async function onSubmit(values: CreateBranchFormValues) {
    form.clearErrors("root");

    try {
      const image = await buildFinalImages();
      const payload: CreateBranchFormValues = {
        ...values,
        image,
      };

      const result =
        mode === "update" && branchId
          ? await updateBranchAction(branchId, payload)
          : await createBranchAction(organizationId, payload);

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

  function setLogo(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    setPendingFiles((current) => ({ ...current, logo: file }));
  }

  function addImages(
    type: "event" | "gallery" | "ecole",
    files: FileList | null,
  ) {
    if (!files?.length) return;

    const nextFiles = Array.from(files);
    setPendingFiles((current) => ({
      ...current,
      [type]: [...current[type], ...nextFiles],
    }));
  }

  function removePendingImage(
    type: "event" | "gallery" | "ecole",
    index: number,
  ) {
    setPendingFiles((current) => ({
      ...current,
      [type]: current[type].filter((_, i) => i !== index),
    }));
  }

  function removeSavedImage(
    type: "event" | "gallery" | "ecole",
    index: number,
  ) {
    setSavedImages((current) => ({
      ...current,
      [type]: current[type].filter((_, i) => i !== index),
    }));
  }

  function removeLogo() {
    setPendingFiles((current) => ({ ...current, logo: null }));
    setSavedImages((current) => ({ ...current, logo: "" }));
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
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="flex flex-col rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/10 sm:p-6">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
                <School className="size-3.5" />
                Inscription école
              </div>

              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Ajoutez votre établissement
              </h1>

              <p className="mt-2 max-w-[430px] text-sm leading-6 text-primary-foreground/90">
                Créez la fiche de votre école, indiquez ses coordonnées et
                positionnez-la sur la carte pour faciliter la recherche locale.
              </p>

              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex items-start gap-2.5 rounded-xl bg-primary-foreground/10 p-3">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Une fiche claire pour présenter votre établissement.
                  </span>
                </div>

                <div className="flex items-start gap-2.5 rounded-xl bg-primary-foreground/10 p-3">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Une localisation précise pour les élèves et les parents.
                  </span>
                </div>
              </div>
            </section>

            <section className="grid gap-4">
              <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Building2 className="size-4" />
                  </span>

                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      Informations de l’école
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Les champs essentiels permettent de créer la fiche de
                      base.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
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
                            className="h-9 rounded-xl"
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
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Code école (bulletin)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ex. 123456789012"
                              maxLength={32}
                              className="h-9 rounded-xl font-mono uppercase"
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                              className="h-9 rounded-xl"
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
                              <SelectTrigger className="h-9 rounded-xl">
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
                              <Phone className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type="tel"
                                inputMode="tel"
                                maxLength={15}
                                placeholder="+243xxxxxxxxx"
                                className="h-9 rounded-xl pl-10"
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
                            className="h-9 rounded-xl"
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
                      name="province"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Province éducationnelle</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ex. Kinshasa / Lukunga"
                              className="h-9 rounded-xl"
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="commune"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commune / Ter. (1)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Commune ou territoire"
                              className="h-9 rounded-xl"
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
                      name="ville"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ville</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ville"
                              className="h-9 rounded-xl"
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
                              className="h-9 rounded-xl"
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
                              className="h-9 rounded-xl"
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
                              className="h-9 rounded-xl"
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
                              className="h-9 rounded-xl"
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

                  <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                    <Button
                      size="sm"
                      type="button"
                      onClick={useCurrentLocation}
                      variant="outline"
                      disabled={isSubmitting}
                      className="rounded-full border-primary/20 text-foreground hover:bg-primary/5"
                    >
                      <Navigation className="mr-1.5 size-3.5" />
                      Utiliser ma position actuelle
                    </Button>

                    <div className="flex h-8 items-center justify-between gap-3 rounded-full border border-primary/10 bg-primary/5 px-3">
                      <span className="text-sm font-medium text-foreground">
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
                  <div className="rounded-2xl border bg-card p-4">
                    <h3 className="text-base font-semibold text-foreground">
                      Images de l’établissement
                    </h3>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div>
                        <FormLabel>Logo</FormLabel>
                        <Input
                          name="logoFile"
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="mt-2 h-9 rounded-xl"
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
                          className="mt-2 h-9 rounded-xl"
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
                          className="mt-2 h-9 rounded-xl"
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
                          className="mt-2 h-9 rounded-xl"
                          disabled={isSubmitting}
                          onChange={(e) => addImages("ecole", e.target.files)}
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                      {(savedImages.logo || pendingFiles.logo) && (
                        <div className="flex items-center justify-between rounded-2xl bg-muted p-3 text-sm">
                          <span className="truncate">
                            <strong>Logo : </strong>
                            {pendingFiles.logo?.name ?? savedImages.logo}
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

                      {savedImages.event.map((fileName, index) => (
                        <div
                          key={`saved-event-${fileName}-${index}`}
                          className="flex items-center justify-between rounded-2xl bg-muted p-3 text-sm"
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
                            onClick={() => removeSavedImage("event", index)}
                          >
                            Retirer
                          </Button>
                        </div>
                      ))}

                      {pendingFiles.event.map((file, index) => (
                        <div
                          key={`pending-event-${file.name}-${index}`}
                          className="flex items-center justify-between rounded-2xl bg-muted p-3 text-sm"
                        >
                          <span className="truncate">
                            <strong>Événement (nouveau) : </strong>
                            {file.name}
                          </span>

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="rounded-full"
                            onClick={() => removePendingImage("event", index)}
                          >
                            Retirer
                          </Button>
                        </div>
                      ))}

                      {savedImages.gallery.map((fileName, index) => (
                        <div
                          key={`saved-gallery-${fileName}-${index}`}
                          className="flex items-center justify-between rounded-2xl bg-muted p-3 text-sm"
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
                            onClick={() => removeSavedImage("gallery", index)}
                          >
                            Retirer
                          </Button>
                        </div>
                      ))}

                      {pendingFiles.gallery.map((file, index) => (
                        <div
                          key={`pending-gallery-${file.name}-${index}`}
                          className="flex items-center justify-between rounded-2xl bg-muted p-3 text-sm"
                        >
                          <span className="truncate">
                            <strong>Galerie (nouveau) : </strong>
                            {file.name}
                          </span>

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="rounded-full"
                            onClick={() => removePendingImage("gallery", index)}
                          >
                            Retirer
                          </Button>
                        </div>
                      ))}

                      {savedImages.ecole.map((fileName, index) => (
                        <div
                          key={`saved-ecole-${fileName}-${index}`}
                          className="flex items-center justify-between rounded-2xl bg-muted p-3 text-sm"
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
                            onClick={() => removeSavedImage("ecole", index)}
                          >
                            Retirer
                          </Button>
                        </div>
                      ))}

                      {pendingFiles.ecole.map((file, index) => (
                        <div
                          key={`pending-ecole-${file.name}-${index}`}
                          className="flex items-center justify-between rounded-2xl bg-muted p-3 text-sm"
                        >
                          <span className="truncate">
                            <strong>École (nouveau) : </strong>
                            {file.name}
                          </span>

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="rounded-full"
                            onClick={() => removePendingImage("ecole", index)}
                          >
                            Retirer
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="sticky bottom-4 z-20 mt-4 rounded-2xl border bg-card/90 p-2.5 shadow-md backdrop-blur">
                    <Button
                      size="sm"
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isSubmitting
                        ? mode === "update"
                          ? "Envoi en cours..."
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
        <DialogContent className="max-w-5xl rounded-2xl p-0">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="text-lg font-semibold text-foreground">
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
              <div className="flex items-start gap-3 rounded-2xl bg-primary/5 p-4 text-foreground">
                <BadgeCheck className="mt-0.5 size-5 shrink-0" />
                <span>
                  Une fiche claire pour présenter votre établissement.
                </span>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-primary/5 p-4 text-foreground">
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
