"use client";

import { HTMLAttributes, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/custom/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  createPeriodSettingsAction,
  updatePeriodSettingsAction,
} from "./periodes.action";

const periodFormSchema = z
  .object({
    id: z.number().int().positive().optional(),
    label: z
      .string()
      .trim()
      .min(2, "Le libellé doit contenir au moins 2 caractères.")
      .max(120),
    semesterId: z.string().min(1, "Choisissez un semestre / trimestre."),
    startDate: z.string().min(1, "Date de début requise."),
    endDate: z.string().min(1, "Date de fin requise."),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "La date de fin doit être après la date de début.",
    path: ["endDate"],
  });

export type PeriodFormValues = z.infer<typeof periodFormSchema>;

export type PeriodSemesterOption = {
  id: number;
  label: string;
};

interface PeriodUpFormProps extends HTMLAttributes<HTMLDivElement> {
  mode: "create" | "update";
  semesters: PeriodSemesterOption[];
  initialData?: PeriodFormValues;
  onCreated?: () => void;
  onUpdated?: () => void;
}

export function PeriodUpForm({
  className,
  mode,
  semesters,
  initialData,
  onCreated,
  onUpdated,
  ...props
}: PeriodUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<PeriodFormValues>({
    resolver: zodResolver(periodFormSchema),
    defaultValues: initialData ?? {
      label: "",
      semesterId: semesters[0] ? String(semesters[0].id) : "",
      startDate: "",
      endDate: "",
    },
  });

  useEffect(() => {
    if (initialData && mode === "update") {
      form.reset(initialData);
    }
  }, [initialData, mode, form]);

  async function onSubmit(data: PeriodFormValues) {
    setIsLoading(true);
    setErrorMessage("");

    const payload = {
      label: data.label,
      semesterId: Number(data.semesterId),
      startDate: data.startDate,
      endDate: data.endDate,
    };

    try {
      if (mode === "create") {
        const [, err] = await createPeriodSettingsAction(payload);
        if (err) throw new Error(err.message);
        toast.success("Période créée avec succès");
        form.reset({
          label: "",
          semesterId: semesters[0] ? String(semesters[0].id) : "",
          startDate: "",
          endDate: "",
        });
        onCreated?.();
      } else {
        if (!data.id) throw new Error("Identifiant de période manquant.");
        const [, err] = await updatePeriodSettingsAction({
          ...payload,
          id: data.id,
        });
        if (err) throw new Error(err.message);
        toast.success("Période mise à jour avec succès");
        onUpdated?.();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Une erreur est survenue";
      setErrorMessage(message);
      toast.error(
        mode === "create"
          ? "Échec de la création de la période"
          : "Échec de la mise à jour de la période",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("grid gap-2", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-y-2">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem className="space-y-0.5">
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    Libellé
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: 1ere Periode"
                      className="h-9 rounded-md px-3 text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="semesterId"
              render={({ field }) => (
                <FormItem className="space-y-0.5">
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    Semestre / trimestre
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Choisir…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {semesters.map((semester) => (
                        <SelectItem
                          key={semester.id}
                          value={String(semester.id)}
                        >
                          {semester.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="space-y-0.5">
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      Date de début
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="h-9 rounded-md px-3 text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="space-y-0.5">
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      Date de fin
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="h-9 rounded-md px-3 text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {semesters.length === 0 ? (
              <p className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                Aucun semestre / trimestre. Cliquez d&apos;abord sur « Initialiser
                depuis le modèle ».
              </p>
            ) : (
              <p className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                Les libellés doivent rester cohérents avec le calendrier scolaire
                de la branche (notes, fiches, bulletins).
              </p>
            )}

            <Button
              type="submit"
              className="mt-2 h-11 w-full text-base font-medium"
              loading={isLoading}
              disabled={semesters.length === 0}
            >
              {mode === "create"
                ? "Enregistrer la période"
                : "Mettre à jour la période"}
            </Button>

            {errorMessage ? (
              <p className="mt-2 text-center text-xs text-red-500">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </form>
      </Form>
    </div>
  );
}
