"use client";

import { HTMLAttributes, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import {
  createClasseAction,
  getBranchTypeAction,
  updateClasseAction,
} from "../classe.action";
import {
  buildClassName,
  getClassLevelsForBranch,
  getClassLevelLabel,
  getBranchTypeLabel,
  isCtebLevel,
  isHumanitesLevel,
} from "@/lib/class-structure";
import { primaryLevelOptionCode } from "@/lib/primary-academic-structure";
import { CTEB_OPTION_CODE, CTEB_SECTION_CODE } from "@/lib/class-catalog";
import { ManagedBranchType } from "@/lib/academic-structure";
import type { EducationSystem } from "@/lib/education-system";
import {
  cycleLabel,
  isMaternelleCycle,
  type Cycle,
} from "@/lib/cycle";
import {
  ANGOLA_CICLO1_SECTION_CODE,
  ANGOLA_TECNICA_SECTION_CODE,
  isAngolaElectOption,
  isAngolaNucleoComumOption,
  angolaHoraireHelp,
  getAngolaHoraireType,
  isAngolaFirstCycleLevel,
  isAngolaSecondarySystem,
  angolaRequiresArea,
} from "@/lib/angola-secondary-structure";
import {
  isAngolaPrimaryOption,
  isAngolaPrimarySystem,
} from "@/lib/angola-primary-structure";
import { IOption } from "@/src/interfaces/Option";
import { ICreneau } from "@/src/interfaces/creneau";
import { getCreneauxAction } from "../../creneau/creneau.action";
import { getOptionsAction } from "../../option/option.action";

const formSchema = z.object({
  id: z.string().optional(),
  nameClasse: z.string().trim().optional(),
  cycle: z.string().trim().optional(),
  level: z.string().trim().optional(),
  parallel: z.string().trim().optional(),
  capacity: z.coerce.number().int().positive().optional().nullable(),
  optionId: z.string().optional(),
  sectionId: z.string().optional(),
  creneauId: z.string().optional(),
  statusClasse: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ClasseUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: Partial<FormValues>;
  mode: "create" | "update";
  /** Layout large pour le panneau Sheet d’édition. */
  layout?: "default" | "sheet";
}

export function ClasseUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  layout = "default",
  ...props
}: ClasseUpFormProps) {
  const isLegacyUpdate =
    mode === "update" && !initialData?.level && Boolean(initialData?.nameClasse);
  const isSheet = layout === "sheet";

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [catalogReady, setCatalogReady] = useState(false);
  const [options, setOptions] = useState<IOption[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState(
    initialData?.sectionId ?? "",
  );
  const [creneaux, setCreneaux] = useState<ICreneau[]>([]);
  const [branchType, setBranchType] = useState<ManagedBranchType>("SECONDAIRE");
  const [activatedCycles, setActivatedCycles] = useState<Cycle[]>(["SECONDAIRE"]);
  const [educationSystem, setEducationSystem] =
    useState<EducationSystem>("CONGOLAIS");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: isLegacyUpdate
      ? {
          id: initialData?.id ?? "",
          nameClasse: initialData?.nameClasse ?? "",
          creneauId: initialData?.creneauId ?? "",
          optionId: initialData?.optionId ?? "",
          sectionId: initialData?.sectionId ?? "",
          capacity: initialData?.capacity ?? undefined,
        }
      : {
          id: initialData?.id,
          nameClasse: initialData?.nameClasse ?? "",
          cycle: initialData?.cycle ?? "",
          level: initialData?.level ?? "",
          parallel: initialData?.parallel ?? "",
          capacity: initialData?.capacity ?? undefined,
          creneauId: initialData?.creneauId ?? "",
          optionId: initialData?.optionId ?? "",
          sectionId: initialData?.sectionId ?? "",
        },
  });
  const nameTouchedRef = useRef(
    mode === "update" && Boolean(initialData?.nameClasse),
  );

  useEffect(() => {
    const fetchData = async () => {
      const [
        [branchResult, branchErr],
        [rawOptions, optionsErr],
        [rawCreneaux, creneauxErr],
      ] = await Promise.all([
        getBranchTypeAction(),
        getOptionsAction(),
        getCreneauxAction({ includeArchived: mode === "update" }),
      ]);

      if (branchErr) throw branchErr;
      if (optionsErr) throw optionsErr;
      if (creneauxErr) throw creneauxErr;

      setBranchType(branchResult.typebranch as ManagedBranchType);
      const cycles = (branchResult.cycles?.length
        ? branchResult.cycles
        : [branchResult.typebranch]) as Cycle[];
      setActivatedCycles(cycles);
      if (mode === "create" && cycles.length === 1) {
        form.setValue("cycle", cycles[0]);
      }
      setEducationSystem(
        (branchResult.educationSystem as EducationSystem) ?? "CONGOLAIS",
      );

      const currentOptionId = initialData?.optionId ?? "";
      const loadedOptions = rawOptions.filter(
        (option) =>
          option.statusOption !== false || option.id === currentOptionId,
      );
      setOptions(loadedOptions);

      const currentCreneauId = initialData?.creneauId ?? "";
      const loadedCreneaux = rawCreneaux.filter(
        (creneau) => !creneau.isArchived || creneau.id === currentCreneauId,
      );
      setCreneaux(loadedCreneaux);

      const picked = loadedOptions.find((option) => option.id === currentOptionId);
      const sectionFromOption = picked?.sectionId || initialData?.sectionId || "";
      if (sectionFromOption) {
        setSelectedSectionId(sectionFromOption);
        form.setValue("sectionId", sectionFromOption);
      }
      if (mode === "update") {
        if (currentOptionId) form.setValue("optionId", currentOptionId);
        if (currentCreneauId) form.setValue("creneauId", currentCreneauId);
      }
      setCatalogReady(true);
    };

    fetchData().catch((error) => {
      console.error(error);
      toast.error("Impossible de charger les donnees du formulaire");
    });
  }, []);

  const initialId = initialData?.id;
  useEffect(() => {
    form.reset(
      isLegacyUpdate
        ? {
            id: initialData?.id ?? "",
            nameClasse: initialData?.nameClasse ?? "",
            creneauId: initialData?.creneauId ?? "",
            optionId: initialData?.optionId ?? "",
            sectionId: initialData?.sectionId ?? "",
            capacity: initialData?.capacity ?? undefined,
          }
        : {
            id: initialData?.id,
            nameClasse: initialData?.nameClasse ?? "",
            cycle: initialData?.cycle ?? "",
            level: initialData?.level ?? "",
            parallel: initialData?.parallel ?? "",
            capacity: initialData?.capacity ?? undefined,
            creneauId: initialData?.creneauId ?? "",
            optionId: initialData?.optionId ?? "",
            sectionId: initialData?.sectionId ?? "",
          },
    );
    setSelectedSectionId(initialData?.sectionId ?? "");
    nameTouchedRef.current =
      mode === "update" && Boolean(initialData?.nameClasse);
  }, [initialId, isLegacyUpdate, form, mode]);

  const watchedLevel = form.watch("level");
  const watchedParallel = form.watch("parallel");
  const watchedOptionId = form.watch("optionId");
  const watchedCycle = form.watch("cycle");

  const classCycle = (watchedCycle || activatedCycles[0] || branchType) as Cycle;
  const multiCycle = activatedCycles.length > 1;
  const angolaSecondary = isAngolaSecondarySystem(classCycle, educationSystem);
  const angolaPrimary = isAngolaPrimarySystem(classCycle, educationSystem);
  const classLevels = getClassLevelsForBranch(classCycle, educationSystem);
  const showOptionField = classCycle !== "ATELIER";
  const angolaCycle1 = angolaSecondary && isAngolaFirstCycleLevel(watchedLevel);
  const horaireHelp = angolaSecondary
    ? angolaHoraireHelp(watchedLevel)
    : "";
  const horaireType = getAngolaHoraireType(watchedLevel);

  const cycleOptions = useMemo(
    () =>
      options.filter((option) => {
        if (
          option.statusOption === false &&
          option.id !== watchedOptionId
        ) {
          return false;
        }
        const optionCycle = option.cycle;
        if (!optionCycle) {
          return (
            classCycle === "SECONDAIRE" ||
            classCycle === "PRIMAIRE" ||
            classCycle === "MATERNELLE"
          );
        }
        return optionCycle === classCycle || option.id === watchedOptionId;
      }),
    [classCycle, options, watchedOptionId],
  );

  const sections = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    for (const option of cycleOptions) {
      if (!option.sectionId) continue;
      if (!map.has(option.sectionId)) {
        map.set(option.sectionId, {
          id: option.sectionId,
          name: option.nameSection || option.sectionId,
          code: option.codeSection || "",
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "fr"),
    );
  }, [cycleOptions]);

  const sectionsForLevel = useMemo(() => {
    if (!watchedLevel || classCycle !== "SECONDAIRE") return sections;
    if (angolaSecondary && isAngolaFirstCycleLevel(watchedLevel)) {
      return sections.filter((s) => s.code === ANGOLA_CICLO1_SECTION_CODE);
    }
    if (angolaSecondary && angolaRequiresArea(watchedLevel)) {
      return sections.filter((s) => s.code !== ANGOLA_CICLO1_SECTION_CODE);
    }
    // 7è / 8è : uniquement Éducation de Base (CTEB)
    if (isCtebLevel(watchedLevel)) {
      return sections.filter((s) => s.code === CTEB_SECTION_CODE);
    }
    // 1è–4è Humanités : sections filière (hors CTEB)
    if (isHumanitesLevel(watchedLevel)) {
      return sections.filter((s) => s.code !== CTEB_SECTION_CODE);
    }
    return sections;
  }, [angolaSecondary, classCycle, sections, watchedLevel]);

  const optionsForSection = useMemo(() => {
    if (classCycle === "PRIMAIRE" || classCycle === "MATERNELLE") {
      return cycleOptions;
    }
    if (!selectedSectionId) return cycleOptions;
    const inSection = cycleOptions.filter(
      (option) => option.sectionId === selectedSectionId,
    );
    const list = inSection.length ? inSection : cycleOptions;
    if (watchedOptionId && !list.some((option) => option.id === watchedOptionId)) {
      const extra = options.find((option) => option.id === watchedOptionId);
      if (extra) return [...list, extra];
    }
    return list;
  }, [classCycle, cycleOptions, options, selectedSectionId, watchedOptionId]);

  useEffect(() => {
    if (classCycle !== "PRIMAIRE" || !watchedLevel) return;
    if (angolaPrimary) {
      const geral = options.find((option) => isAngolaPrimaryOption(option));
      if (geral && !form.getValues("optionId")) {
        form.setValue("optionId", geral.id);
        if (geral.sectionId) setSelectedSectionId(geral.sectionId);
      }
      return;
    }
    const code = primaryLevelOptionCode(watchedLevel);
    const levelOption = options.find(
      (option) =>
        option.codeOption === code || option.nameOption === watchedLevel,
    );
    if (levelOption && !form.getValues("optionId")) {
      form.setValue("optionId", levelOption.id);
    }
  }, [angolaPrimary, classCycle, form, options, watchedLevel]);

  // 7è / 8è : section CTEB + option Tronc commun obligatoires (RDC)
  useEffect(() => {
    if (classCycle !== "SECONDAIRE" || angolaSecondary) return;
    if (!isCtebLevel(watchedLevel ?? "")) return;

    const ctebSection = sections.find((s) => s.code === CTEB_SECTION_CODE);
    const troncCommun = options.find(
      (o) =>
        o.codeOption === CTEB_OPTION_CODE ||
        o.nameOption.toLowerCase() === "tronc commun",
    );

    if (ctebSection && selectedSectionId !== ctebSection.id) {
      setSelectedSectionId(ctebSection.id);
    }
    if (troncCommun && !form.getValues("optionId")) {
      form.setValue("optionId", troncCommun.id);
    }
  }, [
    angolaSecondary,
    classCycle,
    watchedLevel,
    sections,
    options,
    selectedSectionId,
    form,
  ]);

  // Angola 7ª–8ª : Núcleo comum (comme le tronc commun)
  useEffect(() => {
    if (!angolaSecondary || !isAngolaFirstCycleLevel(watchedLevel ?? "")) return;

    const cicloSection = sections.find(
      (s) => s.code === ANGOLA_CICLO1_SECTION_CODE,
    );
    const cicloOption = options.find((o) => isAngolaNucleoComumOption(o));

    if (cicloSection && selectedSectionId !== cicloSection.id) {
      setSelectedSectionId(cicloSection.id);
    }
    if (cicloOption && !form.getValues("optionId")) {
      form.setValue("optionId", cicloOption.id);
    }
  }, [
    angolaSecondary,
    watchedLevel,
    sections,
    options,
    selectedSectionId,
    form,
  ]);

  // Angola 9ª–13ª : Técnica / Electricidade par défaut
  useEffect(() => {
    if (!angolaSecondary || !angolaRequiresArea(watchedLevel ?? "")) return;
    if (form.getValues("optionId")) return;

    const tecnica = sections.find((s) => s.code === ANGOLA_TECNICA_SECTION_CODE);
    const elect = options.find((o) => isAngolaElectOption(o));

    if (tecnica && selectedSectionId !== tecnica.id) {
      setSelectedSectionId(tecnica.id);
    }
    if (elect) {
      form.setValue("optionId", elect.id);
    }
  }, [
    angolaSecondary,
    watchedLevel,
    sections,
    options,
    selectedSectionId,
    form,
  ]);

  useEffect(() => {
    if (!catalogReady) return;
    if (classCycle !== "SECONDAIRE" || !watchedLevel) return;
    if (angolaCycle1 || (!angolaSecondary && isCtebLevel(watchedLevel))) return;

    // Réinitialise section/option si elles ne correspondent plus au niveau
    if (
      selectedSectionId &&
      sectionsForLevel.length > 0 &&
      !sectionsForLevel.some((s) => s.id === selectedSectionId)
    ) {
      setSelectedSectionId("");
      form.setValue("optionId", "");
    }
  }, [
    catalogReady,
    classCycle,
    watchedLevel,
    sectionsForLevel,
    selectedSectionId,
    form,
  ]);

  useEffect(() => {
    if (!watchedOptionId || selectedSectionId) return;
    const opt = options.find((o) => o.id === watchedOptionId);
    if (opt?.sectionId) {
      setSelectedSectionId(opt.sectionId);
      form.setValue("sectionId", opt.sectionId);
    }
  }, [watchedOptionId, options, selectedSectionId, form]);

  const previewName = useMemo(() => {
    if (isLegacyUpdate) return null;

    const level = watchedLevel?.trim();
    if (!level) return null;

    const optionName = options.find((option) => option.id === watchedOptionId)
      ?.nameOption;

    return buildClassName({
      typebranch: classCycle,
      educationSystem,
      level,
      parallel: watchedParallel,
      optionName,
    });
  }, [
    classCycle,
    educationSystem,
    isLegacyUpdate,
    options,
    watchedLevel,
    watchedOptionId,
    watchedParallel,
  ]);

  useEffect(() => {
    if (isLegacyUpdate || !previewName) return;
    if (!nameTouchedRef.current) {
      form.setValue("nameClasse", previewName);
    }
  }, [form, isLegacyUpdate, previewName]);

  async function onSubmit(data: FormValues) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        if (!data.level?.trim()) {
          throw new Error("Veuillez selectionner un niveau");
        }
        const [, err] = await createClasseAction({
          cycle: classCycle,
          level: data.level,
          parallel: data.parallel,
          nameClasse: data.nameClasse,
          capacity: data.capacity,
          optionId: data.optionId,
          creneauId: data.creneauId,
        });
        if (err) throw new Error(err.message);
        toast.success("Classe creee avec succes");
        nameTouchedRef.current = false;
        form.reset({
          cycle: multiCycle ? "" : classCycle,
          level: "",
          parallel: "",
          nameClasse: "",
          capacity: undefined,
          creneauId: "",
          optionId: "",
        });
        onCreated?.();
      } else {
        const payload = isLegacyUpdate
          ? {
              id: data.id,
              nameClasse: data.nameClasse,
              parallel: data.parallel,
              capacity: data.capacity,
              optionId: data.optionId,
              creneauId: data.creneauId,
            }
          : {
              id: data.id,
              nameClasse: data.nameClasse,
              level: data.level,
              parallel: data.parallel,
              capacity: data.capacity,
              optionId: data.optionId,
              creneauId: data.creneauId,
            };
        const [, err] = await updateClasseAction(payload);
        if (err) throw new Error(err.message);
        toast.success("Classe mise a jour avec succes");
        onUpdated?.();
      }
      onSuccess?.();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Une erreur est survenue";
      setErrorMessage(message);
      toast.error(
        mode === "create"
          ? message || "Echec de la creation de la classe"
          : message || "Echec de la mise a jour de la classe",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("min-h-0", className)} {...props}>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            "flex min-h-0 flex-col gap-3",
            isSheet && "h-full",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Branche {getBranchTypeLabel(branchType)}
              {multiCycle ? ` · ${cycleLabel(classCycle)}` : ""}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {isLegacyUpdate ? (
              <FormField
                control={form.control}
                name="nameClasse"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nom de la classe</FormLabel>
                    <FormControl>
                      <Input placeholder="Le nom de la classe" {...field} />
                    </FormControl>
                    <FormDescription>
                      Classe existante sans niveau structure.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <>
                {multiCycle || isMaternelleCycle(classCycle) ? (
                  <FormField
                    control={form.control}
                    name="cycle"
                    render={({ field }) => (
                      <FormItem className={multiCycle ? "sm:col-span-2" : undefined}>
                        <FormLabel>Cycle</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            searchable="auto"
                            options={activatedCycles.map((cycle) => ({
                              value: cycle,
                              label: cycleLabel(cycle),
                            }))}
                            value={field.value ?? ""}
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue("level", "");
                              form.setValue("optionId", "");
                              form.setValue("nameClasse", "");
                              nameTouchedRef.current = false;
                              setSelectedSectionId("");
                            }}
                            placeholder="Selectionner un cycle"
                            searchPlaceholder="Rechercher un cycle…"
                            triggerClassName="h-9"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Niveau</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          searchable="auto"
                          options={classLevels.map((level) => ({
                            value: level,
                            label: getClassLevelLabel(
                              classCycle,
                              level,
                              educationSystem,
                            ),
                          }))}
                          value={field.value ?? ""}
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("optionId", "");
                            form.setValue("nameClasse", "");
                            nameTouchedRef.current = false;
                            setSelectedSectionId("");
                          }}
                          placeholder="Selectionner un niveau"
                          searchPlaceholder="Rechercher un niveau…"
                          triggerClassName="h-9"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchedLevel ? (
                  <FormField
                    control={form.control}
                    name="nameClasse"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Nom de la classe</FormLabel>
                        <FormControl>
                          <Input
                            className="h-9"
                            placeholder={previewName || "Nom de la classe"}
                            {...field}
                            value={field.value ?? ""}
                            onChange={(event) => {
                              nameTouchedRef.current = true;
                              field.onChange(event.target.value);
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Prérempli d&apos;après le niveau. Vous pouvez le
                          modifier.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                {horaireHelp ? (
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-[11px] leading-snug text-muted-foreground sm:col-span-2">
                    <p>
                      <span className="font-medium text-foreground">
                        {horaireType === "REDUIT"
                          ? "Horaire réduit"
                          : "Horaire complet"}
                        {" · "}
                      </span>
                      {horaireHelp}
                    </p>
                  </div>
                ) : null}

                <FormField
                  control={form.control}
                  name="parallel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parallele (optionnel)</FormLabel>
                      <FormControl>
                        <Input
                          className="h-9"
                          placeholder="Ex: A, B, C"
                          maxLength={3}
                          {...field}
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(event.target.value.toUpperCase())
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {angolaCycle1 ? (
              <p className="text-[11px] leading-snug text-muted-foreground sm:col-span-2">
                7ª–8ª : Núcleo comum est proposé par défaut. Vous pouvez choisir
                une autre option.
              </p>
            ) : null}

            {showOptionField &&
            classCycle !== "PRIMAIRE" &&
            classCycle !== "MATERNELLE" &&
            sectionsForLevel.length > 0 ? (
              <FormItem>
                <FormLabel>Section (filiere)</FormLabel>
                <SearchableSelect
                  searchable
                  options={sectionsForLevel.map((section) => ({
                    value: section.id,
                    label: section.name,
                  }))}
                  value={selectedSectionId}
                  onValueChange={(value) => {
                    setSelectedSectionId(value);
                    form.setValue("optionId", "");
                    form.setValue("sectionId", value);
                  }}
                  placeholder={
                    catalogReady
                      ? "Selectionner une section"
                      : "Chargement…"
                  }
                  searchPlaceholder="Rechercher une section…"
                  triggerClassName="h-9"
                />
                {isCtebLevel(watchedLevel ?? "") && !angolaSecondary ? (
                  <FormDescription className="text-[11px] leading-snug">
                    CTEB (7ᵉ / 8ᵉ) : Tronc commun proposé par défaut, modifiable.
                  </FormDescription>
                ) : null}
              </FormItem>
            ) : null}

            {showOptionField ? (
              <FormField
                control={form.control}
                name="optionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {classCycle === "PRIMAIRE" || classCycle === "MATERNELLE"
                        ? "Niveau de pondération"
                        : "Option"}
                    </FormLabel>
                    <FormControl>
                      <SearchableSelect
                        searchable
                        options={optionsForSection.map((option) => ({
                          value: option.id,
                          label: option.nameSection
                            ? `${option.nameOption} · ${option.nameSection}`
                            : option.nameOption,
                          search: `${option.nameOption} ${option.codeOption} ${option.nameSection ?? ""}`,
                        }))}
                        value={field.value ?? ""}
                        onValueChange={(value) => {
                          field.onChange(value);
                          const picked = options.find((option) => option.id === value);
                          if (picked?.sectionId) {
                            setSelectedSectionId(picked.sectionId);
                            form.setValue("sectionId", picked.sectionId);
                          }
                        }}
                        placeholder={
                          !catalogReady
                            ? "Chargement…"
                            : optionsForSection.length
                              ? "Selectionner une option"
                              : "Aucune option disponible"
                        }
                        searchPlaceholder="Rechercher une option…"
                        triggerClassName="h-9"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacite (optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      className="h-9"
                      type="number"
                      min={1}
                      placeholder="Max eleves"
                      value={field.value ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        field.onChange(
                          value === "" ? undefined : Number(value),
                        );
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="creneauId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vacation</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      searchable
                      options={creneaux.map((creneau) => ({
                        value: creneau.id,
                        label: creneau.nameCreneau,
                      }))}
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      placeholder={
                        catalogReady
                          ? "Selectionner une vacation"
                          : "Chargement…"
                      }
                      searchPlaceholder="Rechercher une vacation…"
                      triggerClassName="h-9"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div
            className={cn(
              "mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end",
              isSheet &&
                "sticky bottom-0 -mx-5 mt-auto border-t bg-background px-5 py-3 sm:-mx-6 sm:px-6",
            )}
          >
            {errorMessage ? (
              <p className="text-sm text-destructive sm:mr-auto">
                {errorMessage}
              </p>
            ) : null}
            <Button
              type="submit"
              className={cn(
                "w-full font-medium",
                isSheet ? "h-11 text-base sm:w-full" : "sm:w-auto",
              )}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {mode === "create"
                ? "Enregistrer la classe"
                : "Mettre à jour la classe"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
