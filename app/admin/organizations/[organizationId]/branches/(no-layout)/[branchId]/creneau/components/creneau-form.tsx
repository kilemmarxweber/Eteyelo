"use client";
import { HTMLAttributes, useMemo, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
import {
  CRENEAU_WEEKDAY_OPTIONS,
  DEFAULT_CRENEAU_WORKING_DAYS,
  normalizeCreneauWorkingDays,
} from "@/lib/creneau-working-days";
import { Checkbox } from "@/components/ui/checkbox";

const emptyCreneauValues = (): CreneauFormValues => ({
  ...defaultCreneauValues,
  workingDays: [...DEFAULT_CRENEAU_WORKING_DAYS],
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
  workingDays: normalizeCreneauWorkingDays(initialData?.workingDays),
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

function useStructurePresets(): StructurePreset[] {
  const t = useTranslations("teaching.vacation.form");
  return useMemo(
    () => [
      {
        id: "secondaire-matin",
        label: t("presetSecondaryMorning"),
        description: t("presetSecondaryMorningDesc"),
        values: {
          nameCreneau: t("presetSecondaryMorningName"),
          startTime: "07:30",
          endTime: "12:15",
          durationCourse: 45,
          recreationHour: "09:45",
          recreationDuration: 15,
        },
      },
      {
        id: "secondaire-aprem",
        label: t("presetSecondaryAfternoon"),
        description: t("presetSecondaryAfternoonDesc"),
        values: {
          nameCreneau: t("presetSecondaryAfternoonName"),
          startTime: "12:30",
          endTime: "17:15",
          durationCourse: 45,
          recreationHour: "14:45",
          recreationDuration: 15,
        },
      },
      {
        id: "primaire-matin",
        label: t("presetPrimaryMorning"),
        description: t("presetPrimaryMorningDesc"),
        values: {
          nameCreneau: t("presetPrimaryMorningName"),
          startTime: "07:30",
          endTime: "11:50",
          durationCourse: 40,
          recreationHour: "10:10",
          recreationDuration: 20,
        },
      },
    ],
    [t],
  );
}

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
  const t = useTranslations("teaching.vacation.form");
  const tc = useTranslations("common");
  const structurePresets = useStructurePresets();
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
        toast.success(t("created"));
      } else {
        const [, err] = await updateCreneauAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success(t("updated"));
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
        error instanceof Error ? error.message : tc("errorGeneric");
      setErrorMessage(message);
      toast.error(
        mode === "create"
          ? message || t("createFailed")
          : message || t("updateFailed"),
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
                  {t("presetsTitle")}
                </h3>
                {!isDialog ? (
                  <p className="text-sm text-muted-foreground">
                    {t("presetsDesc")}
                  </p>
                ) : null}
              </div>
              <div
                className={cn(
                  "grid gap-2",
                  isDialog ? "sm:grid-cols-3" : "sm:grid-cols-1",
                )}
              >
                {structurePresets.map((preset) => {
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
                <FormLabel className={labelClass}>{t("name")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("namePlaceholder")}
                    className={controlClass}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                {!isDialog ? (
                  <FormDescription>
                    {t("nameDesc")}
                  </FormDescription>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className={cn(isDialog ? "space-y-2" : "space-y-4")}>
            {!isDialog ? (
              <div>
                <h3 className="text-sm font-medium">{t("scheduleTitle")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("scheduleDesc")}
                </p>
              </div>
            ) : (
              <p className="text-xs font-medium text-muted-foreground">
                {t("scheduleShort")}
              </p>
            )}

            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem className={fieldClass}>
                    <FormLabel className={labelClass}>{t("start")}</FormLabel>
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
                    <FormLabel className={labelClass}>{t("end")}</FormLabel>
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
                      {t("sessionDurationLabel")}
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
                        {t("sessionDurationDesc")}
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
                <h3 className="text-sm font-medium">{t("recreation")}</h3>
                {!isDialog ? (
                  <p className="text-sm text-muted-foreground">
                    {t("recreationDesc")}
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
                    <FormLabel className={labelClass}>{t("recreationTime")}</FormLabel>
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
                    <FormLabel className={labelClass}>{t("recreationDuration")}</FormLabel>
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

          <FormField
            control={form.control}
            name="workingDays"
            render={({ field }) => (
              <FormItem className={cn(isDialog ? "space-y-2" : "space-y-3")}>
                <div>
                  <FormLabel className={labelClass ?? "text-sm font-medium"}>
                    {t("workingDays")}
                  </FormLabel>
                  {!isDialog ? (
                    <FormDescription>
                      {t("workingDaysDesc")}
                    </FormDescription>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      {t("workingDaysShort")}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CRENEAU_WEEKDAY_OPTIONS.map((day) => {
                    const checked = (field.value ?? []).includes(day.value);
                    return (
                      <label
                        key={day.value}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                          checked
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/40",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(state) => {
                            const current = field.value ?? [];
                            const next =
                              state === true
                                ? normalizeCreneauWorkingDays([
                                    ...current,
                                    day.value,
                                  ])
                                : current.filter((d) => d !== day.value);
                            field.onChange(next);
                          }}
                        />
                        <span>{day.label}</span>
                      </label>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {periodPreview ? (
            <div
              className={cn(
                "rounded-lg border bg-background text-sm",
                isDialog ? "px-3 py-2.5" : "p-4",
              )}
            >
              <p className="font-medium">{t("previewTitle")}</p>
              <p className="mt-1 text-muted-foreground">
                {t("previewSummary", {
                  before: periodPreview.before,
                  after: periodPreview.after,
                  total: periodPreview.total,
                })}
              </p>
              {periodPreview.slots.length > 0 ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {t("previewStarts", { slots: periodPreview.slots.join(" · ") })}
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
              ? t("createSubmit")
              : t("updateSubmit")}
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
