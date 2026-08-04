"use client";
import { HTMLAttributes, useMemo, useState, useEffect } from "react";
import { useForm, SubmitHandler, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Button } from "@/components/custom/button";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Check, Coffee } from "lucide-react";
import { createCreneauAction, updateCreneauAction } from "../creneau.action";
import {
  creneauSchema,
  defaultCreneauValues,
  type CreneauFormValues,
} from "@/src/interfaces/creneau";
import { previewPeriodsAroundRecreation } from "@/src/hooks/getCourseHours";

const emptyCreneauValues = (): CreneauFormValues => ({
  ...defaultCreneauValues,
});

const normalizeCreneauValues = (
  initialData?: Partial<CreneauFormValues>,
): CreneauFormValues => ({
  ...emptyCreneauValues(),
  ...initialData,
  nameCreneau: initialData?.nameCreneau ?? "",
  startTime: initialData?.startTime ?? "",
  endTime: initialData?.endTime ?? "",
  durationCourse:
    typeof initialData?.durationCourse === "number" &&
    Number.isFinite(initialData.durationCourse)
      ? initialData.durationCourse
      : defaultCreneauValues.durationCourse,
  recreationHour: initialData?.recreationHour ?? "",
  recreationDuration:
    typeof initialData?.recreationDuration === "number" &&
    Number.isFinite(initialData.recreationDuration)
      ? initialData.recreationDuration
      : defaultCreneauValues.recreationDuration,
});

const controlledTime = (value: unknown) =>
  typeof value === "string" ? value : "";

const controlledNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : "";

const toFormNumber = (value: string, fallback: number) => {
  if (value === "") return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

type StructurePreset = {
  id: string;
  label: string;
  description: string;
  values: Partial<CreneauFormValues>;
};

const STRUCTURE_PRESETS: StructurePreset[] = [
  {
    id: "secondaire-matin",
    label: "Secondaire matin (3 + 3)",
    description: "6 × 45 min · récré 15 min",
    values: {
      nameCreneau: "Horaire standard matin",
      startTime: "07:30",
      endTime: "12:15",
      durationCourse: 45,
      recreationHour: "09:45",
      recreationDuration: 15,
    },
  },
  {
    id: "secondaire-aprem",
    label: "Secondaire après-midi (3 + 3)",
    description: "6 × 45 min · récré 15 min",
    values: {
      nameCreneau: "Horaire standard après-midi",
      startTime: "12:30",
      endTime: "17:15",
      durationCourse: 45,
      recreationHour: "14:45",
      recreationDuration: 15,
    },
  },
  {
    id: "primaire-matin",
    label: "Primaire matin (4 + 2)",
    description: "6 × 40 min · récré 20 min",
    values: {
      nameCreneau: "Horaire primaire matin",
      startTime: "07:30",
      endTime: "11:50",
      durationCourse: 40,
      recreationHour: "10:10",
      recreationDuration: 20,
    },
  },
];

interface CreneauUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onCreneauAction?: () => void;
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: Partial<CreneauFormValues>;
  mode: "create" | "update";
  layout?: "default" | "dialog";
}

export function CreneauUpForm({
  className,
  onCreneauAction,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  layout = "default",
  ...props
}: CreneauUpFormProps) {
  const isDialog = layout === "dialog";
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const form = useForm<CreneauFormValues>({
    resolver: zodResolver(creneauSchema),
    defaultValues: normalizeCreneauValues(initialData),
  });

  useEffect(() => {
    form.reset(normalizeCreneauValues(initialData));
    setActivePresetId(null);
  }, [form, mode, initialData?.id]);

  const watched = useWatch({ control: form.control });
  const periodPreview = useMemo(
    () =>
      previewPeriodsAroundRecreation(
        watched.startTime ?? "",
        watched.endTime ?? "",
        Number(watched.durationCourse) || 0,
        watched.recreationHour ?? "",
        Number(watched.recreationDuration) || 0,
      ),
    [watched],
  );

  function applyPreset(preset: StructurePreset) {
    setActivePresetId(preset.id);
    form.reset({
      ...normalizeCreneauValues(form.getValues()),
      ...preset.values,
      id: form.getValues("id"),
    });
  }

  const onSubmit: SubmitHandler<CreneauFormValues> = async (data) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const [, err] = await createCreneauAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Vacation créée avec succès");
      } else {
        const [, err] = await updateCreneauAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Vacation mise à jour avec succès");
      }

      if (mode === "create") {
        form.reset(emptyCreneauValues());
        setActivePresetId(null);
        onCreated?.();
      } else {
        onUpdated?.();
      }
      onSuccess?.();
      onCreneauAction?.();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Une erreur est survenue";
      setErrorMessage(message);
      toast.error(
        mode === "create"
          ? message || "Échec de la création de la vacation"
          : message || "Échec de la mise à jour de la vacation",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fieldClass = isDialog ? "space-y-0.5" : "space-y-2";
  const labelClass = isDialog
    ? "text-xs font-medium text-muted-foreground"
    : undefined;
  const controlClass = isDialog
    ? "h-9 rounded-md px-3 text-sm font-normal"
    : undefined;

  return (
    <div
      className={cn(isDialog ? "grid gap-2" : "grid gap-6", className)}
      {...props}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(isDialog ? "space-y-4" : "space-y-6")}
        >
          {mode === "create" ? (
            <div className={cn(isDialog ? "space-y-2" : "space-y-3")}>
              <div>
                <h3
                  className={cn(
                    "font-medium",
                    isDialog ? "text-xs text-muted-foreground" : "text-sm",
                  )}
                >
                  Modèles rapides
                </h3>
                {!isDialog ? (
                  <p className="text-sm text-muted-foreground">
                    Secondaire / humanités : souvent 3 + 3 séances autour de la
                    récréation. Le primaire peut différer.
                  </p>
                ) : null}
              </div>
              <div
                className={cn(
                  "grid gap-2",
                  isDialog ? "sm:grid-cols-3" : "sm:grid-cols-1",
                )}
              >
                {STRUCTURE_PRESETS.map((preset) => {
                  const selected = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        "relative rounded-lg border px-3 py-2.5 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border bg-background hover:border-primary/40 hover:bg-muted/40",
                      )}
                    >
                      {selected ? (
                        <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                      ) : null}
                      <span className="block pr-5 text-xs font-medium leading-snug">
                        {preset.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {preset.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <FormField
            control={form.control}
            name="nameCreneau"
            render={({ field }) => (
              <FormItem className={fieldClass}>
                <FormLabel className={labelClass}>Nom de la vacation</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex. Matinée, Après-midi..."
                    className={controlClass}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                {!isDialog ? (
                  <FormDescription>
                    Identifiant affiché dans les listes et les emplois du temps.
                  </FormDescription>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className={cn(isDialog ? "space-y-2" : "space-y-4")}>
            {!isDialog ? (
              <div>
                <h3 className="text-sm font-medium">Horaires de la vacation</h3>
                <p className="text-sm text-muted-foreground">
                  Plage horaire couverte par cette vacation.
                </p>
              </div>
            ) : (
              <p className="text-xs font-medium text-muted-foreground">
                Horaires
              </p>
            )}

            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem className={fieldClass}>
                    <FormLabel className={labelClass}>Début</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        className={controlClass}
                        {...field}
                        value={controlledTime(field.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem className={fieldClass}>
                    <FormLabel className={labelClass}>Fin</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        className={controlClass}
                        {...field}
                        value={controlledTime(field.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="durationCourse"
                render={({ field }) => (
                  <FormItem className={fieldClass}>
                    <FormLabel className={labelClass}>
                      Durée séance (min)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="45"
                        className={controlClass}
                        {...field}
                        value={controlledNumber(field.value)}
                        onChange={(e) =>
                          field.onChange(
                            toFormNumber(
                              e.target.value,
                              defaultCreneauValues.durationCourse,
                            ),
                          )
                        }
                      />
                    </FormControl>
                    {!isDialog ? (
                      <FormDescription>
                        Durée standard d&apos;une séance.
                      </FormDescription>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div
            className={cn(
              "rounded-lg border border-dashed bg-muted/30",
              isDialog ? "p-3" : "rounded-xl p-4 sm:p-5",
            )}
          >
            <div className={cn("flex items-center gap-2", isDialog ? "mb-2.5" : "mb-4")}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
                <Coffee className="size-3.5" />
              </span>
              <div>
                <h3 className="text-sm font-medium">Récréation</h3>
                {!isDialog ? (
                  <p className="text-sm text-muted-foreground">
                    Pause prévue au milieu de la vacation.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="recreationHour"
                render={({ field }) => (
                  <FormItem className={fieldClass}>
                    <FormLabel className={labelClass}>Heure</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        className={controlClass}
                        {...field}
                        value={controlledTime(field.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recreationDuration"
                render={({ field }) => (
                  <FormItem className={fieldClass}>
                    <FormLabel className={labelClass}>Durée (min)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="15"
                        className={controlClass}
                        {...field}
                        value={controlledNumber(field.value)}
                        onChange={(e) =>
                          field.onChange(
                            toFormNumber(
                              e.target.value,
                              defaultCreneauValues.recreationDuration,
                            ),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {periodPreview ? (
            <div
              className={cn(
                "rounded-lg border bg-background text-sm",
                isDialog ? "px-3 py-2.5" : "p-4",
              )}
            >
              <p className="font-medium">Aperçu des séances</p>
              <p className="mt-1 text-muted-foreground">
                {periodPreview.before} + {periodPreview.after} ·{" "}
                {periodPreview.total} séances
              </p>
              {periodPreview.slots.length > 0 ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Débuts : {periodPreview.slots.join(" · ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <Button
            type="submit"
            size={isDialog ? "default" : undefined}
            className={cn(
              "w-full font-medium",
              isDialog && "h-11 text-base",
            )}
            loading={isLoading}
          >
            {mode === "create"
              ? "Enregistrer la vacation"
              : "Mettre à jour la vacation"}
          </Button>

          {errorMessage ? (
            <p
              className={cn(
                "text-center text-destructive",
                isDialog ? "text-xs" : "text-sm",
              )}
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
        </form>
      </Form>
    </div>
  );
}
