"use client";

import { HTMLAttributes, useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { CTEB_SECTION_CODE } from "@/lib/class-catalog";
import { ManagedBranchType } from "@/lib/academic-structure";
import { IOption } from "@/src/interfaces/Option";
import { ICreneau } from "@/src/interfaces/creneau";
import { getCreneauxAction } from "../../creneau/creneau.action";
import { getOptionsAction } from "../../option/option.action";

const formSchema = z.object({
  id: z.string().optional(),
  nameClasse: z.string().trim().optional(),
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
          level: initialData?.level ?? "",
          parallel: initialData?.parallel ?? "",
          capacity: initialData?.capacity ?? undefined,
          creneauId: initialData?.creneauId ?? "",
          optionId: initialData?.optionId ?? "",
        },
  });

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
            level: initialData?.level ?? "",
            parallel: initialData?.parallel ?? "",
            capacity: initialData?.capacity ?? undefined,
            creneauId: initialData?.creneauId ?? "",
            optionId: initialData?.optionId ?? "",
          },
    );
  }, [initialData, isLegacyUpdate, form]);

  const watchedLevel = form.watch("level");
  const watchedParallel = form.watch("parallel");
  const watchedOptionId = form.watch("optionId");

  const classLevels = getClassLevelsForBranch(branchType);
  const showOptionField =
    branchType === "PRIMAIRE" ||
    (allowsOptionForBranch(branchType) &&
      (isLegacyUpdate ||
        requiresOptionForClass(branchType, watchedLevel ?? "")));

  const sections = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    for (const option of options) {
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
  }, [options]);

  const sectionsForLevel = useMemo(() => {
    if (!watchedLevel || branchType !== "SECONDAIRE") return sections;
    if (isCtebLevel(watchedLevel)) {
      return sections.filter((s) => s.code === CTEB_SECTION_CODE);
    }
    if (isHumanitesLevel(watchedLevel)) {
      return sections.filter((s) => s.code !== CTEB_SECTION_CODE);
    }
    return sections;
  }, [branchType, sections, watchedLevel]);

  const optionsForSection = useMemo(() => {
    if (branchType === "PRIMAIRE") return options;
    if (!selectedSectionId) return [];
    return options.filter((o) => o.sectionId === selectedSectionId);
  }, [branchType, options, selectedSectionId]);

  useEffect(() => {
    if (branchType !== "PRIMAIRE") return;
    const primaryOption = options.find(
      (option) => option.nameOption.toUpperCase() === "PRIMAIRE",
    );
    if (primaryOption && form.getValues("optionId") !== primaryOption.id) {
      form.setValue("optionId", primaryOption.id);
    }
  }, [branchType, form, options]);

  useEffect(() => {
    if (branchType !== "SECONDAIRE" || !watchedLevel) return;

    if (isCtebLevel(watchedLevel)) {
      const cteb = sections.find((s) => s.code === CTEB_SECTION_CODE);
      if (cteb) setSelectedSectionId(cteb.id);
      const tronc = options.find(
        (o) =>
          o.codeSection === CTEB_SECTION_CODE &&
          o.nameOption.toLowerCase().includes("tronc"),
      );
      if (tronc) form.setValue("optionId", tronc.id);
      return;
    }

    if (
      selectedSectionId &&
      !sectionsForLevel.some((s) => s.id === selectedSectionId)
    ) {
      setSelectedSectionId("");
      form.setValue("optionId", "");
    }
  }, [
    branchType,
    watchedLevel,
    sections,
    sectionsForLevel,
    selectedSectionId,
    options,
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
      typebranch: branchType,
      level,
      parallel: watchedParallel,
      optionName,
    });
  }, [
    branchType,
    isLegacyUpdate,
    options,
    watchedLevel,
    watchedOptionId,
    watchedParallel,
  ]);

  async function onSubmit(data: FormValues) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        if (!data.level?.trim()) {
          throw new Error("Veuillez selectionner un niveau");
        }
        const [, err] = await createClasseAction({
          level: data.level,
          parallel: data.parallel,
          capacity: data.capacity,
          optionId: data.optionId,
          creneauId: data.creneauId,
        });
        if (err) throw new Error(err.message);
        toast.success("Classe creee avec succes");
        form.reset({
          level: "",
          parallel: "",
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
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Branche {getBranchTypeLabel(branchType)}
          </p>

          <div
            className={cn(
              "grid gap-4",
              isSheet ? "sm:grid-cols-2" : "grid-cols-1",
            )}
          >
            {isLegacyUpdate ? (
              <FormField
                control={form.control}
                name="nameClasse"
                render={({ field }) => (
                  <FormItem className={cn(isSheet && "sm:col-span-2")}>
                    <FormLabel>Nom de la classe</FormLabel>
                    <FormControl>
                      <Input placeholder="Le nom de la classe" {...field} />
                    </FormControl>
                    <FormDescription>
                      Classe existante sans niveau structure. Conservez le nom
                      actuel ou migrez vers le formulaire structure.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Niveau</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("optionId", "");
                          if (!isCtebLevel(value)) setSelectedSectionId("");
                        }}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Selectionner un niveau" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          {classLevels.map((level) => (
                            <SelectItem key={level} value={level}>
                              {getClassLevelLabel(branchType, level)}
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
                  name="parallel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parallele (optionnel)</FormLabel>
                      <FormControl>
                        <Input
                          className="h-10"
                          placeholder="Ex: A, B, C"
                          maxLength={3}
                          {...field}
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(event.target.value.toUpperCase())
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Distingue les classes du meme niveau (ex. 1è-PR A).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {previewName ? (
                  <div
                    className={cn(
                      "rounded-lg border bg-muted/40 px-3 py-2.5 text-sm",
                      isSheet && "sm:col-span-2",
                    )}
                  >
                    <span className="text-muted-foreground">Nom genere : </span>
                    <span className="font-medium">{previewName}</span>
                  </div>
                ) : null}
              </>
            )}

            {showOptionField && branchType === "SECONDAIRE" ? (
              <FormItem>
                <FormLabel>Section (filiere)</FormLabel>
                <Select
                  value={selectedSectionId || undefined}
                  onValueChange={(value) => {
                    setSelectedSectionId(value);
                    form.setValue("optionId", "");
                  }}
                  disabled={isCtebLevel(watchedLevel ?? "")}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selectionner une section" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {sectionsForLevel.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            ) : null}

            {showOptionField ? (
              <FormField
                control={form.control}
                name="optionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Option</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                      disabled={
                        branchType === "PRIMAIRE" ||
                        isCtebLevel(watchedLevel ?? "") ||
                        (branchType === "SECONDAIRE" && !selectedSectionId)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="h-10">
                          <SelectValue
                            placeholder={
                              branchType === "PRIMAIRE"
                                ? "PRIMAIRE"
                                : !selectedSectionId &&
                                    branchType === "SECONDAIRE"
                                  ? "Choisir d'abord une section"
                                  : "Selectionner une option"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper">
                        {optionsForSection.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.nameOption}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      className="h-10"
                      type="number"
                      min={1}
                      placeholder="Nombre maximum d'eleves"
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
                <FormItem className={cn(!showOptionField && isSheet && "sm:col-span-1")}>
                  <FormLabel>Vacation</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selectionner une vacation" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent position="popper">
                      {creneaux.map((creneau) => (
                        <SelectItem key={creneau.id} value={creneau.id}>
                          {creneau.nameCreneau}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div
            className={cn(
              "flex flex-col gap-3",
              isSheet &&
                "sticky bottom-0 -mx-6 border-t bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-end",
            )}
          >
            <Button
              type="submit"
              className={cn(!isSheet && "w-full sm:w-auto")}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {mode === "create"
                ? "Enregistrer la classe"
                : "Mettre a jour la classe"}
            </Button>
            {errorMessage ? (
              <p className="text-sm text-destructive sm:mr-auto">{errorMessage}</p>
            ) : null}
          </div>
        </form>
      </Form>
    </div>
  );
}
