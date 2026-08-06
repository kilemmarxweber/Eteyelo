"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/custom/button";
import {
  createPrimaryCourseAction,
  updatePrimaryCourseAction,
} from "../settings.action";

const formSchema = z.object({
  id: z.string().optional(),
  nameCours: z
    .string()
    .trim()
    .min(4, "Le nom du cours doit avoir au moins 4 caractères."),
  description: z.string().optional(),
  primaryDomain: z.string().min(1, "Choisissez un domaine."),
});

type FormValues = z.infer<typeof formSchema>;

export type PrimaryCourseFormInitial = {
  id: string;
  nameCours: string;
  description?: string;
  primaryDomain: string | null;
};

type DomainOption = {
  code: string;
  shortLabel: string;
};

type PrimaryCourseFormProps = {
  mode: "create" | "update";
  initialData?: PrimaryCourseFormInitial;
  domains: DomainOption[];
  onCreated?: () => void;
  onUpdated?: () => void;
};

export function PrimaryCourseForm({
  mode,
  initialData,
  domains,
  onCreated,
  onUpdated,
}: PrimaryCourseFormProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: initialData?.id,
      nameCours: initialData?.nameCours ?? "",
      description: initialData?.description ?? "",
      primaryDomain: initialData?.primaryDomain || "NONE",
    },
  });

  useEffect(() => {
    if (mode === "update" && initialData) {
      form.reset({
        id: initialData.id,
        nameCours: initialData.nameCours,
        description: initialData.description ?? "",
        primaryDomain: initialData.primaryDomain || "NONE",
      });
    }
  }, [form, initialData, mode]);

  async function onSubmit(values: FormValues) {
    setLoading(true);
    setErrorMessage("");
    const payload = {
      id: values.id,
      nameCours: values.nameCours,
      description: values.description ?? "",
      primaryDomain:
        values.primaryDomain === "NONE" ? null : values.primaryDomain,
    };

    try {
      const result =
        mode === "create"
          ? await createPrimaryCourseAction(payload)
          : await updatePrimaryCourseAction(payload);

      if (!result.ok) {
        setErrorMessage(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      if (mode === "create") {
        form.reset({
          nameCours: "",
          description: "",
          primaryDomain: "NONE",
        });
        onCreated?.();
      } else {
        onUpdated?.();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Enregistrement impossible.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-y-2">
        <FormField
          control={form.control}
          name="nameCours"
          render={({ field }) => (
            <FormItem className="space-y-0.5">
              <FormLabel className="text-xs font-medium text-muted-foreground">
                Nom du cours
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: Français"
                  className="h-9 text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="primaryDomain"
          render={({ field }) => (
            <FormItem className="space-y-0.5">
              <FormLabel className="text-xs font-medium text-muted-foreground">
                Domaine
              </FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choisir un domaine" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="NONE">Non classé</SelectItem>
                  {domains.map((d) => (
                    <SelectItem key={d.code} value={d.code}>
                      {d.shortLabel}
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
          name="description"
          render={({ field }) => (
            <FormItem className="space-y-0.5">
              <FormLabel className="text-xs font-medium text-muted-foreground">
                Description (optionnel)
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Précisions éventuelles"
                  className="min-h-20 resize-none text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="mt-2 h-11 w-full text-base font-medium"
          loading={loading}
        >
          {mode === "create" ? "Enregistrer le cours" : "Mettre à jour le cours"}
        </Button>

        {errorMessage ? (
          <p className="text-center text-xs text-red-500">{errorMessage}</p>
        ) : null}
      </form>
    </Form>
  );
}
