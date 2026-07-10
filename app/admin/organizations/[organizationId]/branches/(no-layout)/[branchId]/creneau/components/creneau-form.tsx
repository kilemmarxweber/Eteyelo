"use client";
import { HTMLAttributes, useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/custom/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { createCreneauAction, updateCreneauAction } from "../creneau.action";
import { creneauSchema } from "@/src/interfaces/creneau";

// Fonction pour convertir une chaîne de caractères HH:MM en objet Date
type CreneauFormValues = z.infer<typeof creneauSchema>;

// Fonction pour convertir un objet Date en chaîne de caractères HH:MM
const emptyCreneauValues = (): CreneauFormValues => ({
  nameCreneau: "",
  startTime: "",
  endTime: "",
  durationCourse: undefined as unknown as number,
  recreationHour: "",
  recreationDuration: undefined as unknown as number,
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
    initialData?.durationCourse ?? (undefined as unknown as number),
  recreationHour: initialData?.recreationHour ?? "",
  recreationDuration:
    initialData?.recreationDuration ?? (undefined as unknown as number),
});

const controlledTime = (value: unknown) =>
  typeof value === "string" ? value : "";

const controlledNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : "";

const toOptionalPositiveInteger = (value: string) => {
  if (value === "") return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

interface CreneauUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onCreneauAction?: () => void;
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof creneauSchema>;
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

  const form = useForm<z.infer<typeof creneauSchema>>({
    resolver: zodResolver(creneauSchema),
    defaultValues: normalizeCreneauValues(initialData),
  });

  useEffect(() => {
    form.reset(normalizeCreneauValues(initialData));
  }, [form, initialData]);

  const onSubmit: SubmitHandler<z.infer<typeof creneauSchema>> = async (
    data,
  ) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const [creneau, err] = await createCreneauAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Vacation créée avec succès");
      } else {
        const [creneau, err] = await updateCreneauAction({
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
    } catch (error: any) {
      console.log(error);
      setErrorMessage(error.message ?? "");
      toast.error(
        mode === "create"
          ? error.message || "Échec de la création de le creneau"
          : error.message || "Échec de la mise à jour de le creneau",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="w-full max-w-md mx-auto grid gap-2">
            <FormField
              control={form.control}
              name="nameCreneau"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Nom de la vacation</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Le nom de le creneau"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex space-x-2">
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Debut</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          placeholder="Début"
                          {...field}
                          value={controlledTime(field.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Fin</FormLabel>{" "}
                      <FormControl>
                        <Input
                          type="time"
                          placeholder="Fin"
                          {...field}
                          value={controlledTime(field.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="durationCourse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Durée</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Durée en minutes"
                          {...field}
                          value={controlledNumber(field.value)}
                          onChange={(e) =>
                            field.onChange(
                              toOptionalPositiveInteger(e.target.value),
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
            <div className="flex space-x-2">
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="recreationHour"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Heure de récré</FormLabel>{" "}
                      <FormControl>
                        <Input
                          type="time"
                          placeholder="Fin"
                          {...field}
                          value={controlledTime(field.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="recreationDuration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Durée de la récréation</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Durée en minutes"
                          {...field}
                          value={controlledNumber(field.value)}
                          onChange={(e) =>
                            field.onChange(
                              toOptionalPositiveInteger(e.target.value),
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
            <Button className="mt-2" loading={isLoading}>
              {mode === "create"
                ? "Enregistrer la vacation"
                : "Mettre à jour la vacation"}
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
