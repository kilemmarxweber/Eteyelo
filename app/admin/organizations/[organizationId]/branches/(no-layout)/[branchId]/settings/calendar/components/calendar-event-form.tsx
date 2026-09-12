"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  IconLanguage,
  IconPhotoPlus,
  IconTrash,
} from "@tabler/icons-react";
import {
  calendarEventSchema,
  Recurrence,
  type CalendarEventFormData,
  type CalendarEventFormInput,
  type ICalendarEvent,
} from "@/src/interfaces/CalendarEvent";
import {
  createCalendarEvent,
  updateCalendarEvent,
} from "../../../CalendarEvent/CalendarEvent.acton";
import {
  EVENT_LOCALES,
  normalizeLocaleMap,
  type EventLocaleCode,
  type EventLocaleMap,
} from "@/lib/calendar-event-i18n";
import { translateEventTextsAction } from "../translate-event.action";
import { MAX_IMAGE_UPLOAD_BYTES, uploadFile } from "@/lib/upload-file";
import { normalizeImageSrc, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { MultiSelect } from "../../../paiement/components/MultiSelect";
import {
  CYCLE_SORT_ORDER,
  cycleLabel,
  normalizeCycle,
  type Cycle,
} from "@/lib/cycle";
import { compareClassesByLevel } from "@/lib/class-structure";

type EventTypeOption = { id: string; name: string };
type ClasseOption = {
  id: string;
  nameClasse: string;
  codeClasse: string;
  level?: string | null;
  parallel?: string | null;
  cycle?: string | null;
  option?: {
    id: string;
    nameOption: string;
    codeOption: string;
    cycle?: string | null;
  } | null;
};

const NO_OPTION_VALUE = "__none__";

function classeCycle(classe: ClasseOption): Cycle {
  return normalizeCycle(classe.cycle || classe.option?.cycle);
}

function sortCalendarClasses(classes: ClasseOption[]) {
  return [...classes].sort((left, right) => {
    const cycle =
      CYCLE_SORT_ORDER[classeCycle(left)] - CYCLE_SORT_ORDER[classeCycle(right)];
    if (cycle !== 0) return cycle;
    const option = (left.option?.nameOption || "Sans option").localeCompare(
      right.option?.nameOption || "Sans option",
      "fr",
    );
    if (option !== 0) return option;
    return compareClassesByLevel(left, right);
  });
}

function classSelectLabel(classe: ClasseOption) {
  const cycle = cycleLabel(classeCycle(classe));
  const option = classe.option?.nameOption || "Sans option";
  const name = classe.codeClasse
    ? `${classe.nameClasse} (${classe.codeClasse})`
    : classe.nameClasse;
  return `${cycle} · ${option} · ${name}`;
}

function initialClasseIds(initialEvent?: ICalendarEvent | null) {
  if (initialEvent?.classeIds?.length) return initialEvent.classeIds;
  if (initialEvent?.classeId) return [initialEvent.classeId];
  return [];
}

type CalendarEventFormProps = {
  userId: string;
  mode: "create" | "update";
  eventTypes: EventTypeOption[];
  classes?: ClasseOption[];
  initialEvent?: ICalendarEvent | null;
  onSuccess?: () => void;
};

/** Normalise une valeur image DB (fileName, /uploads/..., /api/uploads/...) → fileName. */
function toStoredImageFileName(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!trimmed.includes("/")) return trimmed;

  try {
    const pathname = trimmed.startsWith("http")
      ? new URL(trimmed).pathname
      : trimmed;
    const base = pathname.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(base);
  } catch {
    return trimmed;
  }
}

function toLocalInputValue(date?: Date | string | null) {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function buildDefaultValues(
  userId: string,
  initialEvent?: ICalendarEvent | null,
): CalendarEventFormInput {
  const titleI18n = normalizeLocaleMap(initialEvent?.titleI18n);
  const descriptionI18n = normalizeLocaleMap(initialEvent?.descriptionI18n);
  if (initialEvent?.title) titleI18n.fr = initialEvent.title;
  if (initialEvent?.description) descriptionI18n.fr = initialEvent.description;

  const hasTranslations = Boolean(
    initialEvent?.titleI18n &&
      Object.values(normalizeLocaleMap(initialEvent.titleI18n)).some(
        (value, index) => index > 0 && Boolean(value?.trim()),
      ),
  );

  return {
    id: initialEvent?.id,
    title: initialEvent?.title ?? "",
    description: initialEvent?.description ?? "",
    location: initialEvent?.location ?? "",
    image: toStoredImageFileName(initialEvent?.image),
    allDay: initialEvent?.allDay ?? false,
    closesAttendance: initialEvent?.closesAttendance ?? false,
    createdBy: userId,
    recurrence: initialEvent?.recurrence ?? Recurrence.HEBDOMADAIRE,
    dateStart: initialEvent?.dateStart
      ? new Date(initialEvent.dateStart)
      : new Date(),
    dateEnd: initialEvent?.dateEnd
      ? new Date(initialEvent.dateEnd)
      : null,
    typeId: initialEvent?.typeId ?? "",
    classeId: initialClasseIds(initialEvent)[0] ?? "",
    classeIds: initialClasseIds(initialEvent),
    titleI18n,
    descriptionI18n,
    translationsEnabled: hasTranslations,
  };
}

const RECURRENCE_LABELS: Record<string, string> = {
  JOURNALIER: "Journalier",
  HEBDOMADAIRE: "Hebdomadaire",
  MENSUEL: "Mensuel",
  SEMESTRIEL: "Semestriel",
  TRIMESTRIEL: "Trimestriel",
  ANNUEL: "Annuel",
};

export function CalendarEventForm({
  userId,
  mode,
  eventTypes,
  classes = [],
  initialEvent,
  onSuccess,
}: CalendarEventFormProps) {
  const [pending, startTransition] = useTransition();
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(
    null,
  );
  const [savedImageFileName, setSavedImageFileName] = useState(
    () => toStoredImageFileName(initialEvent?.image),
  );
  const [translating, setTranslating] = useState(false);
  const [activeLocale, setActiveLocale] = useState<EventLocaleCode>("fr");
  const [cycleFilter, setCycleFilter] = useState<string[]>([]);
  const [optionFilter, setOptionFilter] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CalendarEventFormInput>({
    resolver: zodResolver(calendarEventSchema),
    defaultValues: buildDefaultValues(userId, initialEvent),
  });

  const translationsEnabled = form.watch("translationsEnabled");
  const titleValue = form.watch("title") ?? "";
  const descriptionValue = form.watch("description") ?? "";
  const locationValue = form.watch("location") ?? "";
  const dateStartValue = form.watch("dateStart");
  const dateEndValue = form.watch("dateEnd");
  const titleI18n = normalizeLocaleMap(form.watch("titleI18n"));
  const descriptionI18n = normalizeLocaleMap(form.watch("descriptionI18n"));
  const selectedClasseIds = form.watch("classeIds") ?? [];

  const sortedClasses = useMemo(
    () => sortCalendarClasses(classes),
    [classes],
  );

  const cycleOptions = useMemo(() => {
    const values = new Set(sortedClasses.map((classe) => classeCycle(classe)));
    return [...values]
      .sort((a, b) => CYCLE_SORT_ORDER[a] - CYCLE_SORT_ORDER[b])
      .map((cycle) => ({
        value: cycle,
        label: cycleLabel(cycle),
      }));
  }, [sortedClasses]);

  const classesAfterCycle = useMemo(() => {
    if (cycleFilter.length === 0) return sortedClasses;
    const selected = new Set(cycleFilter);
    return sortedClasses.filter((classe) => selected.has(classeCycle(classe)));
  }, [cycleFilter, sortedClasses]);

  const optionOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];
    for (const classe of classesAfterCycle) {
      const value = classe.option?.id || NO_OPTION_VALUE;
      if (seen.has(value)) continue;
      seen.add(value);
      options.push({
        value,
        label: classe.option?.nameOption || "Sans option",
      });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [classesAfterCycle]);

  const filteredClasses = useMemo(() => {
    if (optionFilter.length === 0) return classesAfterCycle;
    const selected = new Set(optionFilter);
    return classesAfterCycle.filter((classe) =>
      selected.has(classe.option?.id || NO_OPTION_VALUE),
    );
  }, [classesAfterCycle, optionFilter]);

  const classOptions = useMemo(() => {
    const visible = new Map(
      filteredClasses.map((classe) => [classe.id, classe] as const),
    );
    for (const id of selectedClasseIds) {
      const classe = sortedClasses.find((item) => item.id === id);
      if (classe) visible.set(id, classe);
    }
    return sortCalendarClasses([...visible.values()]).map((classe) => ({
      value: classe.id,
      label: classSelectLabel(classe),
    }));
  }, [filteredClasses, selectedClasseIds, sortedClasses]);

  function setSelectedClasseIds(next: string[]) {
    const unique = [...new Set(next.filter(Boolean))];
    form.setValue("classeIds", unique, { shouldDirty: true });
    form.setValue("classeId", unique[0] ?? "", { shouldDirty: true });
  }

  const previewSrc = pendingPreviewUrl
    ? pendingPreviewUrl
    : savedImageFileName
      ? normalizeImageSrc(savedImageFileName)
      : "";

  useEffect(() => {
    const defaults = buildDefaultValues(userId, initialEvent);
    form.reset(defaults);
    setPendingImageFile(null);
    setPendingPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setSavedImageFileName(toStoredImageFileName(initialEvent?.image));
    setCycleFilter([]);
    setOptionFilter([]);
  }, [form, initialEvent, userId]);

  useEffect(() => {
    const allowedOptions = new Set(optionOptions.map((option) => option.value));
    setOptionFilter((current) =>
      current.filter((value) => allowedOptions.has(value)),
    );
  }, [optionOptions]);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  function setLocaleField(
    kind: "titleI18n" | "descriptionI18n",
    locale: EventLocaleCode,
    value: string,
  ) {
    const current = normalizeLocaleMap(form.getValues(kind));
    const next: EventLocaleMap = { ...current, [locale]: value };
    form.setValue(kind, next, { shouldDirty: true });

    if (locale === "fr") {
      if (kind === "titleI18n") {
        form.setValue("title", value, { shouldDirty: true });
      } else {
        form.setValue("description", value, { shouldDirty: true });
      }
    }
  }

  async function handleLocaleChange(locale: EventLocaleCode) {
    setActiveLocale(locale);

    if (locale === "fr" || translating) return;

    const titles = normalizeLocaleMap(form.getValues("titleI18n"));
    const descriptions = normalizeLocaleMap(form.getValues("descriptionI18n"));
    const sourceTitle = (titles.fr || form.getValues("title") || "").trim();
    const sourceDescription = (
      descriptions.fr ||
      form.getValues("description") ||
      ""
    ).trim();

    if (!sourceTitle && !sourceDescription) return;

    setTranslating(true);
    try {
      const translated = await translateEventTextsAction({
        title: sourceTitle,
        description: sourceDescription,
        targetLocale: locale,
      });

      if (translated.title) {
        setLocaleField("titleI18n", locale, translated.title);
      }
      if (translated.description) {
        setLocaleField("descriptionI18n", locale, translated.description);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Traduction impossible.",
      );
    } finally {
      setTranslating(false);
    }
  }

  function handleImageChange(file: File | null) {
    if (!file) return;

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.error(
        `Le fichier depasse la taille maximale autorisee de ${Math.round(MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024)} Mo.`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setPendingImageFile(file);
    setPendingPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    form.setValue("image", file.name, { shouldDirty: true, shouldValidate: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function clearImage() {
    setPendingImageFile(null);
    setPendingPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setSavedImageFileName("");
    form.setValue("image", "", { shouldDirty: true, shouldValidate: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function resolveImageFileName(): Promise<string> {
    if (pendingImageFile) {
      const uploaded = await uploadFile(pendingImageFile);
      if (!uploaded.ok) {
        throw new Error(uploaded.message);
      }
      return uploaded.fileName;
    }
    return toStoredImageFileName(savedImageFileName || form.getValues("image"));
  }

  function onSubmit(values: CalendarEventFormInput) {
    startTransition(async () => {
      try {
        const imageFileName = await resolveImageFileName();
        const parsed = calendarEventSchema.parse({
          ...values,
          image: imageFileName,
        });
        const payload: CalendarEventFormData = {
          ...parsed,
          image: imageFileName,
          title:
            parsed.translationsEnabled
              ? parsed.titleI18n?.fr?.trim() || parsed.title
              : parsed.title,
          description:
            parsed.translationsEnabled
              ? parsed.descriptionI18n?.fr?.trim() || parsed.description
              : parsed.description,
        };

        if (mode === "create") {
          const [result, error] = await createCalendarEvent(payload);
          if (error || !result?.success) {
            throw new Error(error?.message || result?.message || "Creation impossible.");
          }
          toast.success(result.message);
        } else {
          const [result, error] = await updateCalendarEvent({
            ...payload,
            id: initialEvent?.id ?? payload.id,
          });
          if (error) throw new Error(error.message);
          toast.success("Evenement mis a jour.");
          void result;
        }
        setPendingImageFile(null);
        setPendingPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return null;
        });
        setSavedImageFileName("");
        form.reset(buildDefaultValues(userId, null));
        onSuccess?.();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Enregistrement impossible.",
        );
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
        <div className="space-y-2">
          <Label>Image</Label>
          <input type="hidden" {...form.register("image")} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/30 transition hover:border-primary/40"
          >
            {previewSrc ? (
              <Image
                src={previewSrc}
                alt="Illustration evenement"
                fill
                unoptimized
                sizes="140px"
                className="object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 px-2 text-center text-xs text-muted-foreground">
                <IconPhotoPlus className="size-5" />
                Ajouter
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) =>
              handleImageChange(event.target.files?.[0] ?? null)
            }
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={pending}
              onClick={() => fileInputRef.current?.click()}
            >
              Parcourir
            </Button>
            {previewSrc ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={clearImage}
              >
                <IconTrash className="size-4" />
              </Button>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            JPG/PNG/WEBP · max {Math.round(MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024)} Mo
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <IconLanguage className="size-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Traduire le contenu</p>
                <p className="text-xs text-muted-foreground">
                  Francais, anglais, portugais, lingala
                </p>
              </div>
            </div>
            <Switch
              checked={Boolean(translationsEnabled)}
              onCheckedChange={(checked) => {
                form.setValue("translationsEnabled", checked, {
                  shouldDirty: true,
                });
                if (checked) {
                  setLocaleField("titleI18n", "fr", form.getValues("title") || "");
                  setLocaleField(
                    "descriptionI18n",
                    "fr",
                    form.getValues("description") || "",
                  );
                }
              }}
            />
          </div>

          {translationsEnabled ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
                {EVENT_LOCALES.map((locale) => (
                  <button
                    key={locale.code}
                    type="button"
                    disabled={translating}
                    onClick={() => void handleLocaleChange(locale.code)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition",
                      activeLocale === locale.code
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                      translating && "opacity-60",
                    )}
                  >
                    {locale.short}
                  </button>
                ))}
              </div>
              {translating ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Traduction en cours depuis le francais...
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Ecrivez en FR, puis cliquez EN / PT / LN pour traduire
                  automatiquement.
                </p>
              )}
            </div>
          ) : null}

          {translationsEnabled ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>
                  Titre ({EVENT_LOCALES.find((item) => item.code === activeLocale)?.label})
                </Label>
                <Input
                  value={titleI18n[activeLocale] ?? ""}
                  disabled={translating}
                  onChange={(event) =>
                    setLocaleField("titleI18n", activeLocale, event.target.value)
                  }
                  placeholder="Titre de l'evenement"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Description (
                  {EVENT_LOCALES.find((item) => item.code === activeLocale)?.label})
                </Label>
                <Textarea
                  rows={4}
                  value={descriptionI18n[activeLocale] ?? ""}
                  disabled={translating}
                  onChange={(event) =>
                    setLocaleField(
                      "descriptionI18n",
                      activeLocale,
                      event.target.value,
                    )
                  }
                  placeholder="Details de l'evenement"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="event-title">Titre</Label>
                <Input
                  id="event-title"
                  {...form.register("title")}
                  value={titleValue}
                  placeholder="Titre de l'evenement"
                />
                {form.formState.errors.title ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.title.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-description">Description</Label>
                <Textarea
                  id="event-description"
                  rows={4}
                  {...form.register("description")}
                  value={descriptionValue}
                  placeholder="Details de l'evenement"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="event-start">Debut</Label>
          <Input
            id="event-start"
            type="datetime-local"
            value={toLocalInputValue(dateStartValue)}
            onChange={(event) =>
              form.setValue("dateStart", new Date(event.target.value), {
                shouldDirty: true,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-end">Fin</Label>
          <Input
            id="event-end"
            type="datetime-local"
            value={toLocalInputValue(dateEndValue)}
            onChange={(event) =>
              form.setValue(
                "dateEnd",
                event.target.value ? new Date(event.target.value) : null,
                { shouldDirty: true },
              )
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="event-location">Lieu</Label>
          <Input
            id="event-location"
            {...form.register("location")}
            value={locationValue}
            placeholder="Salle, campus, en ligne..."
          />
        </div>
        <div className="space-y-2">
          <Label>Type d&apos;evenement</Label>
          <Select
            value={form.watch("typeId") || "none"}
            onValueChange={(value) =>
              form.setValue("typeId", value === "none" ? "" : value, {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selectionner un type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sans type</SelectItem>
              {eventTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Classes (optionnel)</Label>
          <p className="text-[11px] text-muted-foreground">
            Filtrez par cycle puis option, puis choisissez une ou plusieurs
            classes. Aucune classe = événement global (toute l&apos;école).
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Cycle</Label>
            <MultiSelect
              options={cycleOptions}
              value={cycleFilter}
              onValueChange={setCycleFilter}
              placeholder="Tous les cycles"
              selectedCountLabel={(count) =>
                `${count} cycle${count > 1 ? "s" : ""}`
              }
              maxCount={2}
              showSelectAll
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Option</Label>
            <MultiSelect
              options={optionOptions}
              value={optionFilter}
              onValueChange={setOptionFilter}
              placeholder="Toutes les options"
              selectedCountLabel={(count) =>
                `${count} option${count > 1 ? "s" : ""}`
              }
              maxCount={2}
              showSelectAll
              disabled={pending}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Classes</Label>
          <MultiSelect
            options={classOptions}
            value={selectedClasseIds}
            onValueChange={setSelectedClasseIds}
            placeholder="Global (toute l'école)"
            selectedCountLabel={(count) =>
              `${count} classe${count > 1 ? "s" : ""}`
            }
            maxCount={2}
            showSelectAll
            disabled={pending}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Recurrence</Label>
          <Select
            value={form.watch("recurrence")}
            onValueChange={(value) =>
              form.setValue("recurrence", value as CalendarEventFormData["recurrence"], {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(Recurrence).map((value) => (
                <SelectItem key={value} value={value}>
                  {RECURRENCE_LABELS[value] ?? value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <label className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span>Journee entiere</span>
            <Switch
              checked={Boolean(form.watch("allDay"))}
              onCheckedChange={(checked) =>
                form.setValue("allDay", checked, { shouldDirty: true })
              }
            />
          </label>
        </div>
      </div>

      <label className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm">
          <span className="font-medium text-foreground">
            Jour férié / établissement fermé
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Aucune alerte ni pointage de présence ce jour-là.
          </span>
        </span>
        <Switch
          className="mt-2 sm:mt-0"
          checked={Boolean(form.watch("closesAttendance"))}
          onCheckedChange={(checked) => {
            form.setValue("closesAttendance", checked, { shouldDirty: true });
            if (checked) {
              form.setValue("allDay", true, { shouldDirty: true });
            }
          }}
        />
      </label>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="submit" disabled={pending || translating}>
          {pending
            ? "Enregistrement..."
            : mode === "create"
              ? "Creer l'evenement"
              : "Mettre a jour l'evenement"}
        </Button>
      </div>
    </form>
  );
}
