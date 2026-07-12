"use client";
import { HTMLAttributes, useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
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
import { Coffee } from "lucide-react";
import { createCreneauAction, updateCreneauAction } from "../creneau.action";
import {
  creneauSchema,
  defaultCreneauValues,
  type CreneauFormValues,
} from "@/src/interfaces/creneau";

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

interface CreneauUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onCreneauAction?: () => void;
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: Partial<CreneauFormValues>;
  mode: "create" | "update";
}

export function CreneauUpForm({
  className,
  onCreneauAction,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  ...props
}: CreneauUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<CreneauFormValues>({
    resolver: zodResolver(creneauSchema),
    defaultValues: normalizeCreneauValues(initialData),
  });

  useEffect(() => {
    form.reset(normalizeCreneauValues(initialData));
  }, [form, mode, initialData?.id]);

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

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="nameCreneau"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom de la vacation</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex. Matinée, Après-midi..."
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormDescription>
                  Identifiant affiché dans les listes et les emplois du temps.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Horaires de la vacation</h3>
              <p className="text-sm text-muted-foreground">
                Plage horaire couverte par cette vacation.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure de début</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
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
                  <FormItem>
                    <FormLabel>Heure de fin</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        value={controlledTime(field.value)}
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
            name="durationCourse"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Durée d&apos;un cours (minutes)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Durée du cours en minutes"
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
                <FormDescription>
                  Durée standard d&apos;une période de cours dans cette
                  vacation.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="rounded-xl border border-dashed bg-muted/30 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
                <Coffee className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-medium">Récréation</h3>
                <p className="text-sm text-muted-foreground">
                  Pause prévue au milieu de la vacation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="recreationHour"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure de la récréation</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
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
                  <FormItem>
                    <FormLabel>Durée (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Durée de la récréation en minutes"
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

          <Button type="submit" className="w-full" loading={isLoading}>
            {mode === "create"
              ? "Enregistrer la vacation"
              : "Mettre à jour la vacation"}
          </Button>

          {errorMessage && (
            <p className="text-center text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
        </form>
      </Form>
    </div>
  );
}
