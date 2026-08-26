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
  requiresOptionForClass,
  allowsOptionForBranch,
  isCtebLevel,
  isHumanitesLevel,
} from "@/lib/class-structure";
import { primaryLevelOptionCode, isPrimaryClassLevel } from "@/lib/primary-academic-structure";
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
  isAngolaNucleoComumOption,
  angolaHoraireHelp,
  getAngolaHoraireType,
  isAngolaFirstCycleLevel,
  isAngolaSecondarySystem,
  angolaRequiresArea,
} from "@/lib/angola-secondary-structure";
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
  const [options, setOptions] = useState<IOption[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
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
        getCreneauxAction({}),
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
      setOptions(rawOptions);
      setCreneaux(rawCreneaux);
    };

    fetchData().catch((error) => {
      console.error(error);
      toast.error("Impossible de charger les donnees du formulaire");
    });
  }, []);

  useEffect(() => {
    form.reset(
      isLegacyUpdate
        ? {
            id: initialData?.id ?? "",
            nameClasse: initialData?.nameClasse ?? "",
            creneauId: initialData?.creneauId ?? "",
            optionId: initialData?.optionId ?? "",
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
          },
    );
    nameTouchedRef.current =
      mode === "update" && Boolean(initialData?.nameClasse);
  }, [initialData, isLegacyUpdate, form, mode]);

  const watchedLevel = form.watch("level");
  const watchedParallel = form.watch("parallel");
  const watchedOptionId = form.watch("optionId");
  const watchedCycle = form.watch("cycle");

  const classCycle = (watchedCycle || activatedCycles[0] || branchType) as Cycle;
  const multiCycle = activatedCycles.length > 1;
  const angolaSecondary = isAngolaSecondarySystem(classCycle, educationSystem);
  const classLevels = getClassLevelsForBranch(classCycle, educationSystem);
  const showOptionField =
    classCycle === "PRIMAIRE" ||
    (allowsOptionForBranch(classCycle) &&
      (isLegacyUpdate ||
        requiresOptionForClass(
          classCycle,
          watchedLevel ?? "",
          educationSystem,
        )));
  const angolaCycle1 = angolaSecondary && isAngolaFirstCycleLevel(watchedLevel);
  const troncCommunLevel =
    angolaCycle1 || (!angolaSecondary && isCtebLevel(watchedLevel ?? ""));
  const horaireHelp = angolaSecondary
    ? angolaHoraireHelp(watchedLevel)
    : "";
  const horaireType = getAngolaHoraireType(watchedLevel);

  const cycleOptions = useMemo(
    () =>
      options.filter((option) => {
        const optionCycle = (option as { cycle?: string | null }).cycle;
        if (!optionCycle) return classCycle === "SECONDAIRE" || classCycle === "PRIMAIRE";
        return optionCycle === classCycle;
      }),
    [classCycle, options],
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
    if (classCycle === "PRIMAIRE") {
      if (!watchedLevel) return cycleOptions;
      const code = primaryLevelOptionCode(watchedLevel);
      const match = cycleOptions.filter(
        (o) =>
          o.codeOption === code ||
          o.nameOption === watchedLevel,
      );
      return match.length ? match : cycleOptions;
    }
    if (!selectedSectionId) return [];
    const inSection = cycleOptions.filter((o) => o.sectionId === selectedSectionId);
    if (isAngolaFirstCycleLevel(watchedLevel ?? "")) {
      return inSection.filter(
        (o) =>
          isAngolaNucleoComumOption(o),
      );
    }
    if (isCtebLevel(watchedLevel ?? "")) {
      return inSection.filter(
        (o) =>
          o.codeOption === CTEB_OPTION_CODE ||
          o.nameOption.toLowerCase() === "tronc commun",
      );
    }
    return inSection;
  }, [classCycle, cycleOptions, selectedSectionId, watchedLevel]);

  useEffect(() => {
    if (classCycle !== "PRIMAIRE" || !watchedLevel) return;
    const code = primaryLevelOptionCode(watchedLevel);
    const levelOption = options.find(
      (option) =>
        option.codeOption === code || option.nameOption === watchedLevel,
    );
    if (levelOption && form.getValues("optionId") !== levelOption.id) {
      form.setValue("optionId", levelOption.id);
    }
  }, [classCycle, form, cycleOptions, watchedLevel]);

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
    if (troncCommun && form.getValues("optionId") !== troncCommun.id) {
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

  // Angola 7ª–9ª : Núcleo comum (comme le tronc commun)
  useEffect(() => {
    if (!angolaSecondary || !isAngolaFirstCycleLevel(watchedLevel ?? "")) return;

    const cicloSection = sections.find(
      (s) => s.code === ANGOLA_CICLO1_SECTION_CODE,
    );
    const cicloOption = options.find((o) => isAngolaNucleoComumOption(o));

    if (cicloSection && selectedSectionId !== cicloSection.id) {
      setSelectedSectionId(cicloSection.id);
    }
    if (cicloOption && form.getValues("optionId") !== cicloOption.id) {
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

  useEffect(() => {
    if (classCycle !== "SECONDAIRE" || !watchedLevel) return;
    if (angolaCycle1 || (!angolaSecondary && isCtebLevel(watchedLevel))) return;

    // Réinitialise section/option si elles ne correspondent plus au niveau
    if (
      selectedSectionId &&
      !sectionsForLevel.some((s) => s.id === selectedSectionId)
    ) {
      setSelectedSectionId("");
      form.setValue("optionId", "");
    }
  }, [
    classCycle,
    watchedLevel,
    sectionsForLevel,
    selectedSectionId,
    form,
  ]);

  useEffect(() => {
    if (!watchedOptionId || selectedSectionId) return;
    const opt = options.find((o) => o.id === watchedOptionId);
    if (opt?.sectionId) setSelectedSectionId(opt.sectionId);
  }, [watchedOptionId, options, selectedSectionId]);

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
                7ª–9ª : Núcleo comum (comme le tronc commun). Choisissez seulement
                le niveau et le parallèle — pas de filière.
              </p>
            ) : null}

            {showOptionField && classCycle === "SECONDAIRE" && !angolaCycle1 ? (
              <FormItem>
                <FormLabel>Section (filiere)</FormLabel>
                <SearchableSelect
                  searchable="auto"
                  options={sectionsForLevel.map((section) => ({
                    value: section.id,
                    label: section.name,
                  }))}
                  value={selectedSectionId}
                  onValueChange={(value) => {
                    setSelectedSectionId(value);
                    form.setValue("optionId", "");
                  }}
                      disabled={troncCommunLevel}
                      placeholder="Selectionner une section"
                      searchPlaceholder="Rechercher une section…"
                      triggerClassName="h-9"
                    />
                    {angolaCycle1 ? (
                      <FormDescription className="text-[11px] leading-snug">
                        7ª–9ª — Núcleo comum (comme le tronc commun). Pas d'option à choisir.
                      </FormDescription>
                    ) : isCtebLevel(watchedLevel ?? "") && !angolaSecondary ? (
                      <FormDescription className="text-[11px] leading-snug">
                        CTEB — Tronc commun obligatoire (7ᵉ / 8ᵉ).
                      </FormDescription>
                    ) : null}
              </FormItem>
            ) : null}

            {showOptionField && !angolaCycle1 ? (
              <FormField
                control={form.control}
                name="optionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {classCycle === "PRIMAIRE"
                        ? "Niveau de pondération"
                        : "Option"}
                    </FormLabel>
                    <FormControl>
                      <SearchableSelect
                        searchable="auto"
                        options={optionsForSection.map((option) => ({
                          value: option.id,
                          label: option.nameOption,
                        }))}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        disabled={
                          classCycle === "PRIMAIRE" ||
                          troncCommunLevel ||
                          (classCycle === "SECONDAIRE" && !selectedSectionId)
                        }
                        placeholder={
                          classCycle === "PRIMAIRE"
                            ? watchedLevel
                              ? `${watchedLevel} année`
                              : "Selon le niveau"
                            : troncCommunLevel
                              ? angolaCycle1
                                ? "Núcleo comum"
                                : "Tronc commun"
                              : !selectedSectionId &&
                                  classCycle === "SECONDAIRE"
                                ? "Choisir d'abord une section"
                                : "Selectionner une option"
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
                      searchable="auto"
                      options={creneaux.map((creneau) => ({
                        value: creneau.id,
                        label: creneau.nameCreneau,
                      }))}
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      placeholder="Selectionner une vacation"
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
