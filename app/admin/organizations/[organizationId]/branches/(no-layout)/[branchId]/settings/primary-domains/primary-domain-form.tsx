"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { saveBranchPrimaryDomainAction } from "../settings.action";

const formSchema = z.object({
  id: z.string().optional(),
  shortLabel: z
    .string()
    .trim()
    .min(2, "Au moins 2 caractères.")
    .max(80),
  label: z
    .string()
    .trim()
    .min(3, "Au moins 3 caractères.")
    .max(160),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export type DomainFormInitial = {
  id: string;
  shortLabel: string;
  label: string;
  sortOrder: number;
};

type Props = {
  mode: "create" | "update";
  initialData?: DomainFormInitial;
  onSaved: () => void;
};

export function PrimaryDomainForm({ mode, initialData, onSaved }: Props) {
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: initialData?.id,
      shortLabel: initialData?.shortLabel ?? "",
      label: initialData?.label ?? "",
      sortOrder: initialData?.sortOrder,
    },
  });

  useEffect(() => {
    if (mode === "update" && initialData) {
      form.reset({
        id: initialData.id,
        shortLabel: initialData.shortLabel,
        label: initialData.label,
        sortOrder: initialData.sortOrder,
      });
    }
  }, [form, initialData, mode]);

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const result = await saveBranchPrimaryDomainAction({
        id: values.id,
        shortLabel: values.shortLabel,
        label: values.label,
        sortOrder: values.sortOrder,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onSaved();
      if (mode === "create") {
        form.reset({ shortLabel: "", label: "", sortOrder: undefined });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="shortLabel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom court</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex. Langues, Arts…"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    if (mode === "create" && !form.getValues("label")) {
                      const short = e.target.value.trim();
                      if (short) {
                        form.setValue(
                          "label",
                          `DOMAINE DES ${short.toUpperCase()}`,
                          { shouldDirty: true },
                        );
                      }
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Libellé bulletin</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex. DOMAINE DES LANGUES"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sortOrder"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ordre d’affichage</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  placeholder="Auto"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" loading={loading} className="w-full sm:w-auto">
          {mode === "create" ? "Créer le domaine" : "Enregistrer"}
        </Button>
      </form>
    </Form>
  );
}
