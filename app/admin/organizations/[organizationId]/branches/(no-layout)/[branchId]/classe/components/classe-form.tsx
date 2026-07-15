"use client";
import { HTMLAttributes, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Button, buttonVariants } from "@/components/custom/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { IconSelector, IconCheck } from "@tabler/icons-react";
import {
  createClasseAction,
  getBranchTypeAction,
  updateClasseAction,
} from "../classe.action";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
}

export function ClasseUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  ...props
}: ClasseUpFormProps) {
  const isLegacyUpdate =
    mode === "update" && !initialData?.level && Boolean(initialData?.nameClasse);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [options, setOptions] = useState<IOption[]>([]);
  const [optionSearch, setOptionSearch] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [creneauSearch, setCreneauSearch] = useState("");
  const [creneaux, setCreneaux] = useState<ICreneau[]>([]);
  const [branchType, setBranchType] = useState<ManagedBranchType>("SECONDAIRE");
  const [optionOpen, setOptionOpen] = useState(false);
  const [creneauOpen, setCreneauOpen] = useState(false);

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
      const [[branchResult, branchErr], [rawOptions, optionsErr], [rawCreneaux, creneauxErr]] =
        await Promise.all([
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
      (isLegacyUpdate || requiresOptionForClass(branchType, watchedLevel ?? "")));

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

  const filteredOptions = optionsForSection.filter((option) =>
    option.nameOption.toLowerCase().includes(optionSearch.toLowerCase()),
  );

  async function onSubmit(data: FormValues) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        if (!data.level?.trim()) {
          throw new Error("Veuillez selectionner un niveau");
        }
        const [classe, err] = await createClasseAction({
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
        const [classe, err] = await updateClasseAction(payload);
        if (err) throw new Error(err.message);
        toast.success("Classe mise a jour avec succes");
        onUpdated?.();
      }
      onSuccess?.();
    } catch (error: any) {
      setErrorMessage(error.message ?? "");
      toast.error(
        mode === "create"
          ? error.message || "Echec de la creation de la classe"
          : error.message || "Echec de la mise a jour de la classe",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">
              Branche {getBranchTypeLabel(branchType)}
            </p>

            {isLegacyUpdate ? (
              <FormField
                control={form.control}
                name="nameClasse"
                render={({ field }) => (
                  <FormItem className="space-y-1">
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
                        <SelectTrigger>
                          <SelectValue placeholder="Selectionner un niveau" />
                        </SelectTrigger>
                        <SelectContent>
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
                    <FormItem className="space-y-1">
                      <FormLabel>Parallele (optionnel)</FormLabel>
                      <FormControl>
                        <Input
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
                        Distingue les classes du meme niveau (ex. 1è-PR A, 1è Biologie-Chimie B).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {previewName && (
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Nom genere : </span>
                    <span className="font-medium">{previewName}</span>
                  </div>
                )}
              </>
            )}

            {showOptionField && branchType === "SECONDAIRE" && (
              <FormItem>
                <FormLabel>Section (filière)</FormLabel>
                <Select
                  value={selectedSectionId || undefined}
                  onValueChange={(value) => {
                    setSelectedSectionId(value);
                    form.setValue("optionId", "");
                  }}
                  disabled={isCtebLevel(watchedLevel ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectionner une section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionsForLevel.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}

            {showOptionField && (
              <FormField
                control={form.control}
                name="optionId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Option</FormLabel>
                    <Popover open={optionOpen} onOpenChange={setOptionOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={
                            branchType === "PRIMAIRE" ||
                            isCtebLevel(watchedLevel ?? "") ||
                            !selectedSectionId
                          }
                          role="combobox"
                          aria-expanded={optionOpen}
                          aria-controls="classe-option-listbox"
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "h-10 w-full justify-between font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value
                            ? options.find((option) => option.id === field.value)
                                ?.nameOption
                            : branchType === "PRIMAIRE"
                              ? "PRIMAIRE"
                              : !selectedSectionId
                                ? "Choisir d'abord une section"
                                : "Selectionner une option"}
                          <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0">
                        <Command id="classe-option-listbox">
                          <CommandInput
                            placeholder="Rechercher une option..."
                            value={optionSearch}
                            onValueChange={setOptionSearch}
                          />
                          <CommandList>
                            <CommandEmpty>Aucune option trouvee.</CommandEmpty>
                            <CommandGroup>
                              {filteredOptions.map((option) => (
                                <CommandItem
                                  value={option.nameOption}
                                  key={option.id}
                                  onSelect={() => {
                                    form.setValue("optionId", option.id || "");
                                  }}
                                >
                                  <IconCheck
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      option.id === field.value
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {option.nameOption}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Capacite (optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Nombre maximum d'eleves"
                      value={field.value ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        field.onChange(value === "" ? undefined : Number(value));
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
                <FormItem className="flex flex-col">
                  <FormLabel>Vacation</FormLabel>
                  <Popover open={creneauOpen} onOpenChange={setCreneauOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        role="combobox"
                        aria-expanded={creneauOpen}
                        aria-controls="classe-creneau-listbox"
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "h-10 w-full justify-between font-normal",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        {field.value
                          ? creneaux.find((creneau) => creneau.id === field.value)
                              ?.nameCreneau
                          : "Selectionner une vacation"}
                        <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command id="classe-creneau-listbox">
                        <CommandInput
                          placeholder="Rechercher une vacation..."
                          value={creneauSearch}
                          onValueChange={setCreneauSearch}
                        />
                        <CommandList>
                          <CommandEmpty>Aucune vacation trouvee.</CommandEmpty>
                          <CommandGroup>
                            {creneaux.map((creneau) => (
                              <CommandItem
                                value={creneau.nameCreneau}
                                key={creneau.id}
                                onSelect={() => {
                                  form.setValue("creneauId", creneau.id || "");
                                }}
                              >
                                <IconCheck
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    creneau.id === field.value
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {creneau.nameCreneau}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="mt-2" loading={isLoading}>
              {mode === "create"
                ? "Enregistrer la classe"
                : "Mettre a jour la classe"}
            </Button>
            {errorMessage && (
              <p className="mt-2 text-center text-red-500">{errorMessage}</p>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
