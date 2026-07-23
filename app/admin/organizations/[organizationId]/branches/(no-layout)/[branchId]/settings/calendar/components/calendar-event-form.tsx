"use client";

import { useEffect, useRef, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
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

type EventTypeOption = { id: string; name: string };
type ClasseOption = { id: string; nameClasse: string; codeClasse: string };

type CalendarEventFormProps = {
  userId: string;
  mode: "create" | "update";
  eventTypes: EventTypeOption[];
  classes?: ClasseOption[];
  initialEvent?: ICalendarEvent | null;
  onSuccess?: () => void;
};

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
    image: initialEvent?.image ?? "",
    allDay: initialEvent?.allDay ?? false,
    createdBy: userId,
    recurrence: initialEvent?.recurrence ?? Recurrence.HEBDOMADAIRE,
    dateStart: initialEvent?.dateStart
      ? new Date(initialEvent.dateStart)
      : new Date(),
    dateEnd: initialEvent?.dateEnd
      ? new Date(initialEvent.dateEnd)
      : null,
    typeId: initialEvent?.typeId ?? "",
    classeId: initialEvent?.classeId ?? "",
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
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [activeLocale, setActiveLocale] = useState<EventLocaleCode>("fr");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CalendarEventFormInput>({
    resolver: zodResolver(calendarEventSchema),
    defaultValues: buildDefaultValues(userId, initialEvent),
  });

  const translationsEnabled = form.watch("translationsEnabled");
  const imageUrl = form.watch("image") ?? "";
  const titleValue = form.watch("title") ?? "";
  const descriptionValue = form.watch("description") ?? "";
  const locationValue = form.watch("location") ?? "";
  const dateStartValue = form.watch("dateStart");
  const dateEndValue = form.watch("dateEnd");
  const titleI18n = normalizeLocaleMap(form.watch("titleI18n"));
  const descriptionI18n = normalizeLocaleMap(form.watch("descriptionI18n"));

  useEffect(() => {
    form.reset(buildDefaultValues(userId, initialEvent));
  }, [form, initialEvent, userId]);

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

  async function handleImageChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(file);
      if (!uploaded.ok) {
        toast.error(uploaded.message);
        return;
      }
      form.setValue("image", uploaded.url, { shouldDirty: true });
      toast.success("Image ajoutee.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function onSubmit(values: CalendarEventFormInput) {
    startTransition(async () => {
      try {
        const parsed = calendarEventSchema.parse(values);
        const payload: CalendarEventFormData = {
          ...parsed,
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
          const [result, error] = await updateCalendarEvent(payload);
          if (error) throw new Error(error.message);
          toast.success("Evenement mis a jour.");
          void result;
        }
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/30 transition hover:border-primary/40"
          >
            {imageUrl ? (
              <Image
                src={normalizeImageSrc(imageUrl)}
                alt="Illustration evenement"
                fill
                unoptimized
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
              void handleImageChange(event.target.files?.[0] ?? null)
            }
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={uploading || pending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "..." : "Parcourir"}
            </Button>
            {imageUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => form.setValue("image", "", { shouldDirty: true })}
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

      <div className="space-y-2">
        <Label>Classe (optionnel)</Label>
        <Select
          value={form.watch("classeId") || "global"}
          onValueChange={(value) =>
            form.setValue("classeId", value === "global" ? "" : value, {
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Global (toute l'ecole)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">Global (toute l&apos;ecole)</SelectItem>
            {classes.map((classe) => (
              <SelectItem key={classe.id} value={classe.id}>
                {classe.nameClasse}
                {classe.codeClasse ? ` (${classe.codeClasse})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Laissez Global pour un evenement visible de toute l&apos;ecole, ou
          choisissez une classe pour le cibler.
        </p>
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

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="submit" disabled={pending || uploading || translating}>
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
