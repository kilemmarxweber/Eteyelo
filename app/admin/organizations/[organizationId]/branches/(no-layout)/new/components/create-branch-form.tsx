"use client";

import dynamic from "next/dynamic";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldErrors, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  BadgeCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
  IdCard,
  ImageIcon,
  Images,
  Mail,
  MapPin,
  Navigation,
  Phone,
  School,
  Upload,
  X,
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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BranchTypeCards } from "@/components/branch/branch-type-cards";
import { EducationSystemCards } from "@/components/branch/education-system-cards";
import {
  isSchoolCycle,
  principalTypebranchFromSchoolCycles,
} from "@/lib/cycle";
import type { ManagedBranchType } from "@/lib/academic-structure";
import { isExtendedBranch } from "@/lib/branch-capabilities";
import { isSchoolBranchType } from "@/lib/education-system";
import { getRegistrationFormLabels } from "@/lib/registration-form-labels";
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
import { schoolRegistrationRequestSchema } from "@/app/components/inscription-ecole/schema";
import {
  createBranchAction,
  updateBranchAction,
} from "../../branche.action";
import type { BranchFormActionResult } from "@/app/components/inscription-ecole/ecole.action";
import { uploadFile, uploadFiles } from "@/lib/upload-file";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { writeLocaleCookie } from "@/lib/user-locale";

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

type BranchFormTab = "identity" | "type" | "location" | "images";
type BranchFormValues = CreateBranchFormValues & { contactEmail?: string };

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

function firstTabWithErrors(
  errors: FieldErrors<BranchFormValues>,
  hasImagesTab: boolean,
): BranchFormTab {
  if (
    errors.name ||
    errors.description ||
    errors.code ||
    errors.idnat ||
    errors.tel ||
    errors.contactEmail
  ) {
    return "identity";
  }
  if (errors.typebranch || errors.schoolCycles || errors.educationSystem) {
    return "type";
  }
  if (
    errors.adresse ||
    errors.province ||
    errors.commune ||
    errors.ville ||
    errors.pays ||
    errors.latitude ||
    errors.longitude ||
    errors.attendanceRadius
  ) {
    return "location";
  }
  if (hasImagesTab && (errors.image || errors.note)) return "images";
  return "identity";
}

type CreateBranchFormProps = {
  organizationId: string;
  mode?: "create" | "update";
  branchId?: string;
  defaultValues?: Partial<CreateBranchFormValues>;
  submissionMode?: "create" | "request";
  createAction?: (
    organizationId: string,
    values: CreateBranchFormValues,
  ) => Promise<BranchFormActionResult>;
  successRedirectPath?: string | false;
  successMessage?: string;
};

export function CreateBranchForm({
  organizationId,
  mode = "create",
  branchId,
  defaultValues,
  submissionMode = "create",
  createAction = createBranchAction,
  successRedirectPath,
  successMessage,
}: CreateBranchFormProps) {
  const isRequestMode = submissionMode === "request";
  const router = useRouter();
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<BranchFormTab>("identity");
  const [savedImages, setSavedImages] = useState<BranchImages>(
    defaultValues?.image ?? emptyBranchImages(),
  );
  const [pendingFiles, setPendingFiles] =
    useState<PendingBranchFiles>(emptyPendingFiles);
  const form = useForm<BranchFormValues>({
    resolver: zodResolver(
      isRequestMode ? schoolRegistrationRequestSchema : createBranchFormSchema,
    ),
    defaultValues: {
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      code: defaultValues?.code ?? "",
      contactEmail: "",
      image: defaultValues?.image ?? {
        logo: "",
        event: [],
        gallery: [],
        ecole: [],
      },
      adresse: defaultValues?.adresse ?? "",
      note: defaultValues?.note ?? "",
      province: defaultValues?.province ?? "",
      ville: defaultValues?.ville ?? "",
      commune: defaultValues?.commune ?? "",
      pays: defaultValues?.pays ?? "RDC",
      idnat: defaultValues?.idnat ?? "",
      tel: defaultValues?.tel ?? "",
      latitude: defaultValues?.latitude ?? -4.4419,
      longitude: defaultValues?.longitude ?? 15.2663,
      attendanceRadius: defaultValues?.attendanceRadius ?? 10,
      typebranch: defaultValues?.typebranch ?? "SECONDAIRE",
      schoolCycles: defaultValues?.schoolCycles ??
        (defaultValues?.typebranch === "PRIMAIRE" ||
        defaultValues?.typebranch === "SECONDAIRE"
          ? [defaultValues.typebranch]
          : ["SECONDAIRE"]),
      educationSystem: defaultValues?.educationSystem ?? "CONGOLAIS",
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const { isSubmitting } = form.formState;
  const selectedTypebranch = form.watch("typebranch") as ManagedBranchType;
  const selectedEducationSystem = form.watch("educationSystem");
  const selectedSchoolCycles = (form.watch("schoolCycles") ?? []).filter(
    isSchoolCycle,
  );

  useEffect(() => {
    if (mode !== "create") return;
    if (selectedEducationSystem === "ANGOLAIS") {
      writeLocaleCookie("pt");
      const pays = form.getValues("pays")?.trim() || "RDC";
      if (pays === "RDC" || pays === "RD Congo" || pays === "Congo") {
        form.setValue("pays", "Angola", { shouldDirty: true });
      }
      return;
    }
    if (selectedEducationSystem === "CONGOLAIS") {
      const pays = form.getValues("pays")?.trim() || "";
      if (pays === "Angola") {
        form.setValue("pays", "RDC", { shouldDirty: true });
      }
    }
  }, [form, mode, selectedEducationSystem]);
  const showEducationSystem =
    selectedSchoolCycles.length > 0 ||
    (!isExtendedBranch(selectedTypebranch) &&
      isSchoolBranchType(selectedTypebranch));
  const labels = getRegistrationFormLabels(
    selectedTypebranch,
    selectedSchoolCycles,
  );
  const imageCount =
    (savedImages.logo || pendingFiles.logo ? 1 : 0) +
    savedImages.event.length +
    pendingFiles.event.length +
    savedImages.gallery.length +
    pendingFiles.gallery.length +
    savedImages.ecole.length +
    pendingFiles.ecole.length;

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
      const image = isRequestMode
        ? emptyBranchImages()
        : await buildFinalImages();
      const schoolCycles = selectedSchoolCycles;
      const payload: CreateBranchFormValues = {
        ...values,
        image,
        schoolCycles,
        typebranch:
          schoolCycles.length > 0
            ? principalTypebranchFromSchoolCycles(schoolCycles)
            : values.typebranch,
      };

      const result =
        mode === "update" && branchId
          ? await updateBranchAction(branchId, payload)
          : await createAction(organizationId, payload);

      if (result.error) {
        form.setError("root", {
          type: "server",
          message: result.error,
        });
        toast.error(result.error);
        return;
      }

      toast.success(
        successMessage ??
          (mode === "update"
            ? "Établissement modifié."
            : isRequestMode
              ? "Demande envoyée."
              : "Établissement créé."),
      );

      const redirectPath =
        successRedirectPath === false
          ? null
          : (successRedirectPath ??
            `/admin/organizations/${organizationId}/branches`);

      if (redirectPath) {
        router.push(redirectPath);
        router.refresh();
      } else {
        form.reset();
        setSavedImages(emptyBranchImages());
        setPendingFiles(emptyPendingFiles());
      }
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
            : isRequestMode
              ? "Envoi impossible. Réessayez plus tard."
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

  const tabCount = isRequestMode ? 3 : 4;
  const formTabs: BranchFormTab[] = isRequestMode
    ? ["identity", "type", "location"]
    : ["identity", "type", "location", "images"];
  const tabIndex = Math.max(0, formTabs.indexOf(activeTab));
  const isFirstTab = tabIndex === 0;
  const isLastTab = tabIndex === formTabs.length - 1;
  form.watch();
  const canCreate = (
    isRequestMode
      ? schoolRegistrationRequestSchema
      : createBranchFormSchema
  ).safeParse(form.getValues()).success;

  return (
    <>
      <Form {...form}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit(onSubmit, (errors) => {
              setActiveTab(firstTabWithErrors(errors, !isRequestMode));
            })(e);
          }}
          className="space-y-5"
        >
          <header className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.12] via-card to-card p-5 shadow-sm sm:p-6">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <School className="size-3.5" />
              {labels.badge}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {isRequestMode ? labels.titleRequest : labels.titleCreate}
            </h1>
            <p className="mt-2 max-w-7xl text-sm leading-6 text-muted-foreground">
              {isRequestMode
                ? labels.descriptionRequest
                : labels.descriptionCreate}
            </p>
          </header>

          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as BranchFormTab)}
              className="gap-0"
            >
              <div className="border-b bg-muted/30 px-3 py-3 sm:px-5">
                <TabsList
                  className={cn(
                    "grid h-auto w-full gap-1 rounded-xl bg-muted p-1",
                    tabCount === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
                  )}
                >
                  <TabsTrigger
                    value="identity"
                    className="h-auto gap-1.5 rounded-lg px-2 py-2.5 text-xs sm:text-sm"
                  >
                    <IdCard className="size-3.5 shrink-0" />
                    Identité
                  </TabsTrigger>
                  <TabsTrigger
                    value="type"
                    className="h-auto gap-1.5 rounded-lg px-2 py-2.5 text-xs sm:text-sm"
                  >
                    <School className="size-3.5 shrink-0" />
                    Type
                  </TabsTrigger>
                  <TabsTrigger
                    value="location"
                    className="h-auto gap-1.5 rounded-lg px-2 py-2.5 text-xs sm:text-sm"
                  >
                    <MapPin className="size-3.5 shrink-0" />
                    Localisation
                  </TabsTrigger>
                  {!isRequestMode ? (
                    <TabsTrigger
                      value="images"
                      className="h-auto gap-1.5 rounded-lg px-2 py-2.5 text-xs sm:text-sm"
                    >
                      <Images className="size-3.5 shrink-0" />
                      Images
                      {imageCount > 0 ? (
                        <Badge
                          variant="secondary"
                          className="h-5 min-w-5 rounded-full px-1.5 text-[10px]"
                        >
                          {imageCount}
                        </Badge>
                      ) : null}
                    </TabsTrigger>
                  ) : null}
                </TabsList>
              </div>

              <div className="p-4 sm:p-6">
                <TabsContent value="identity" className="mt-0 space-y-5">
                  <TabPanelHeader
                    icon={<Building2 className="size-4" />}
                    title={labels.sectionTitle}
                    description={
                      isRequestMode
                        ? labels.sectionDescriptionRequest
                        : labels.sectionDescriptionCreate
                    }
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{labels.nameLabel}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={labels.namePlaceholder}
                            autoComplete="organization"
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
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description officielle (documents)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Nom officiel long affiché uniquement sur les PDF et Excel…"
                            className="min-h-24 rounded-xl"
                            disabled={isSubmitting}
                            maxLength={2000}
                          />
                        </FormControl>
                        <FormDescription>
                          Non affichée sur les cartes. Utilisée comme intitulé de l’établissement sur les bulletins, PDF et exports Excel.
                        </FormDescription>
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
                          <FormLabel>{labels.codeLabel}</FormLabel>
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
                      name="tel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Téléphone</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
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

                    {isRequestMode ? (
                      <FormField
                        control={form.control}
                        name="contactEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email de contact</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                                <Input
                                  {...field}
                                  placeholder="contact@ecole.cd *"
                                  type="email"
                                  autoComplete="email"
                                  className="h-9 rounded-xl pl-10"
                                  disabled={isSubmitting}
                                />
                              </div>
                            </FormControl>
                            <FormDescription>
                              Un email de confirmation vous sera envoyé à cette
                              adresse.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : null}
                  </div>
                </TabsContent>

                <TabsContent value="type" className="mt-0 space-y-5">
                  <TabPanelHeader
                    icon={<School className="size-4" />}
                    title={labels.typeLabel}
                    description="Combinez maternelle, primaire et secondaire sur une seule branche, ou choisissez un autre type d'établissement."
                  />

                  <FormField
                    control={form.control}
                    name="schoolCycles"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <BranchTypeCards
                            typebranch={selectedTypebranch}
                            schoolCycles={selectedSchoolCycles}
                            disabled={isSubmitting}
                            hideTypes={
                              isRequestMode ? (["ATELIER"] as const) : undefined
                            }
                            onChange={({ typebranch, schoolCycles }) => {
                              field.onChange(schoolCycles);
                              form.setValue("typebranch", typebranch, {
                                shouldValidate: true,
                                shouldDirty: true,
                              });
                              if (isExtendedBranch(typebranch)) {
                                form.setValue("educationSystem", "CONGOLAIS");
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {showEducationSystem ? (
                    <FormField
                      control={form.control}
                      name="educationSystem"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Système d&apos;enseignement</FormLabel>
                          <FormControl>
                            <EducationSystemCards
                              value={field.value ?? "CONGOLAIS"}
                              disabled={isSubmitting}
                              onChange={(value) => {
                                field.onChange(value);
                                if (mode === "create" && value === "ANGOLAIS") {
                                  writeLocaleCookie("pt");
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}

                  <Alert className="rounded-xl border-primary/20 bg-primary/5">
                    <AlertDescription className="text-sm leading-6">
                      {labels.typeDescription}
                    </AlertDescription>
                  </Alert>
                </TabsContent>

                <TabsContent value="location" className="mt-0 space-y-5">
                  <TabPanelHeader
                    icon={<MapPin className="size-4" />}
                    title="Localisation"
                    description="Adresse, commune et position GPS utilisées pour les documents et le pointage."
                  />

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

                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="mb-3 text-sm font-medium">Position GPS</p>
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
                            <FormLabel>Rayon présence (m)</FormLabel>
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
                    <FormDescription className="mt-2">
                      Le rayon est exprimé en mètres pour valider une présence.
                    </FormDescription>

                    <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                      <Button
                        size="sm"
                        type="button"
                        onClick={useCurrentLocation}
                        variant="outline"
                        disabled={isSubmitting}
                        className="rounded-full"
                      >
                        <Navigation className="mr-1.5 size-3.5" />
                        Utiliser ma position actuelle
                      </Button>

                      <div className="flex h-9 items-center justify-between gap-3 rounded-full border bg-background px-3">
                        <span className="text-sm font-medium">
                          Utiliser la carte
                        </span>
                        <Switch
                          checked={showMapDialog}
                          onCheckedChange={setShowMapDialog}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {!isRequestMode ? (
                  <TabsContent value="images" className="mt-0 space-y-5">
                    <TabPanelHeader
                      icon={<ImageIcon className="size-4" />}
                      title="Images de l’établissement"
                      description="Logo, photos de l’école, galerie et visuels événements. La note à la une apparaît sur la page d’accueil."
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <ImageUploadCard
                        label="Logo"
                        hint="Un seul fichier"
                        multiple={false}
                        disabled={isSubmitting}
                        onChange={setLogo}
                      />
                      <ImageUploadCard
                        label="École"
                        hint="Plusieurs photos"
                        multiple
                        disabled={isSubmitting}
                        onChange={(files) => addImages("ecole", files)}
                      />
                      <ImageUploadCard
                        label="Galerie"
                        hint="Plusieurs photos"
                        multiple
                        disabled={isSubmitting}
                        onChange={(files) => addImages("gallery", files)}
                      />
                      <ImageUploadCard
                        label="Événements"
                        hint="Plusieurs photos"
                        multiple
                        disabled={isSubmitting}
                        onChange={(files) => addImages("event", files)}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="note"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note à la une (facultatif)</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Court texte affiché avec l'image de l'établissement sur la page d'accueil…"
                              className="min-h-20 rounded-xl"
                              disabled={isSubmitting}
                              maxLength={500}
                            />
                          </FormControl>
                          <FormDescription>
                            Visible sur la page d&apos;accueil dans la section actualités / événements.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {imageCount > 0 ? (
                      <div className="grid gap-2">
                        {(savedImages.logo || pendingFiles.logo) && (
                          <ImageChip
                            label="Logo"
                            name={pendingFiles.logo?.name ?? savedImages.logo}
                            pending={Boolean(pendingFiles.logo)}
                            onRemove={removeLogo}
                          />
                        )}
                        {savedImages.ecole.map((fileName, index) => (
                          <ImageChip
                            key={`saved-ecole-${fileName}-${index}`}
                            label="École"
                            name={fileName}
                            onRemove={() => removeSavedImage("ecole", index)}
                          />
                        ))}
                        {pendingFiles.ecole.map((file, index) => (
                          <ImageChip
                            key={`pending-ecole-${file.name}-${index}`}
                            label="École"
                            name={file.name}
                            pending
                            onRemove={() => removePendingImage("ecole", index)}
                          />
                        ))}
                        {savedImages.gallery.map((fileName, index) => (
                          <ImageChip
                            key={`saved-gallery-${fileName}-${index}`}
                            label="Galerie"
                            name={fileName}
                            onRemove={() => removeSavedImage("gallery", index)}
                          />
                        ))}
                        {pendingFiles.gallery.map((file, index) => (
                          <ImageChip
                            key={`pending-gallery-${file.name}-${index}`}
                            label="Galerie"
                            name={file.name}
                            pending
                            onRemove={() =>
                              removePendingImage("gallery", index)
                            }
                          />
                        ))}
                        {savedImages.event.map((fileName, index) => (
                          <ImageChip
                            key={`saved-event-${fileName}-${index}`}
                            label="Événement"
                            name={fileName}
                            onRemove={() => removeSavedImage("event", index)}
                          />
                        ))}
                        {pendingFiles.event.map((file, index) => (
                          <ImageChip
                            key={`pending-event-${file.name}-${index}`}
                            label="Événement"
                            name={file.name}
                            pending
                            onRemove={() =>
                              removePendingImage("event", index)
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Aucune image sélectionnée pour le moment.
                      </p>
                    )}
                  </TabsContent>
                ) : null}
              </div>
            </Tabs>
          </section>

          <div className="sticky bottom-4 z-20 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur">
            {form.formState.errors.root && isLastTab ? (
              <p className="mb-2 px-1 text-sm text-destructive" role="alert">
                {form.formState.errors.root.message}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              {!isFirstTab ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-full px-4"
                  disabled={isSubmitting}
                  onClick={() => {
                    const previous = formTabs[tabIndex - 1];
                    if (previous) setActiveTab(previous);
                  }}
                >
                  <ChevronLeft className="size-4" />
                  Précédent
                </Button>
              ) : null}

              {isLastTab ? (
                <Button
                  size="sm"
                  type="submit"
                  disabled={isSubmitting || !canCreate}
                  className="h-10 min-w-0 flex-1 rounded-full"
                >
                  {isSubmitting
                    ? mode === "update"
                      ? "Envoi en cours..."
                      : isRequestMode
                        ? "Envoi en cours..."
                        : "Création en cours..."
                    : mode === "update"
                      ? "Modifier l’établissement"
                      : isRequestMode
                        ? labels.submitRequest
                        : labels.submitCreate}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="h-10 min-w-0 flex-1 rounded-full"
                  disabled={isSubmitting}
                  onClick={() => {
                    const next = formTabs[tabIndex + 1];
                    if (next) setActiveTab(next);
                  }}
                >
                  Suivant
                  <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
            {isLastTab && !canCreate ? (
              <p className="mt-2 px-1 text-center text-xs text-muted-foreground">
                {isRequestMode
                  ? "Renseignez le nom, l’email de contact et le type d’établissement pour activer l’envoi."
                  : "Renseignez le nom et le type d’établissement pour activer la création."}
              </p>
            ) : null}
          </div>
        </form>
      </Form>
      <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
        <DialogContent className="max-w-5xl rounded-2xl p-0">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="text-lg font-semibold text-foreground">
              {labels.mapTitle}
            </DialogTitle>
            <DialogDescription>{labels.mapDescription}</DialogDescription>
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
                <span>{labels.mapBenefit1}</span>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-primary/5 p-4 text-foreground">
                <MapPin className="mt-0.5 size-5 shrink-0" />
                <span>{labels.mapBenefit2}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TabPanelHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ImageUploadCard({
  label,
  hint,
  multiple,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  multiple: boolean;
  disabled: boolean;
  onChange: (files: FileList | null) => void;
}) {
  return (
    <label className="group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/25 bg-muted/20 px-4 py-6 text-center transition hover:border-primary/50 hover:bg-primary/5">
      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Upload className="size-4" />
      </span>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <Input
        type="file"
        multiple={multiple}
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="absolute inset-0 cursor-pointer opacity-0"
        disabled={disabled}
        onChange={(e) => onChange(e.target.files)}
      />
    </label>
  );
}

function ImageChip({
  label,
  name,
  pending,
  onRemove,
}: {
  label: string;
  name: string;
  pending?: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-3 py-2 text-sm">
      <span className="min-w-0 truncate">
        <strong>{label}</strong>
        {pending ? " (nouveau) : " : " : "}
        {name}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onRemove}
        aria-label={`Retirer ${label}`}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
