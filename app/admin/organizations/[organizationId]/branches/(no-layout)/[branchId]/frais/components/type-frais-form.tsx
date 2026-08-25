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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/custom/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTypeFraisAction, updateTypeFraisAction } from "../frais.action";
import { typeFraisSchema } from "@/src/interfaces/Frais";

interface TypeFraisUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof typeFraisSchema>;
  mode: "create" | "update";
  layout?: "default" | "dialog" | "sheet";
}

export function TypeFraisUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  layout = "default",
  ...props
}: TypeFraisUpFormProps) {
  const isCompact = layout === "dialog" || layout === "sheet";
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<z.infer<typeof typeFraisSchema>>({
    resolver: zodResolver(typeFraisSchema),
    defaultValues: initialData || {
      codeType: "",
      nameType: "",
      description: "",
      statusType: true,
      cycle: null,
    },
  });

  useEffect(() => {
    if (initialData && mode === "update") {
      form.reset(initialData);
    }
  }, [initialData, mode, form]);

  async function onSubmit(data: z.infer<typeof typeFraisSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const [, err] = await createTypeFraisAction({
          ...data,
          statusType: data.statusType ?? true,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Type de frais créé avec succès");
        form.reset({
          codeType: "",
          nameType: "",
          description: "",
          statusType: true,
        });
        onCreated?.();
      } else {
        const [, err] = await updateTypeFraisAction({
          ...data,
          statusType: data.statusType ?? true,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Type de frais mis à jour avec succès");
        onUpdated?.();
      }
      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Une erreur est survenue";
      setErrorMessage(message);
      toast.error(
        mode === "create"
          ? "Échec de la création du type de frais"
          : "Échec de la mise à jour du type de frais",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const fieldClass = isCompact ? "space-y-0.5" : "space-y-1";
  const labelClass = isCompact
    ? "text-xs font-medium text-muted-foreground"
    : undefined;
  const inputClass = isCompact
    ? "h-9 rounded-md px-3 text-sm font-normal"
    : undefined;

  return (
    <div
      className={cn(isCompact ? "grid gap-2" : "grid gap-6", className)}
      {...props}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className={cn("grid", isCompact ? "gap-y-2" : "gap-4")}>
            <FormField
              control={form.control}
              name="nameType"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel className={labelClass}>Nom du type</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Frais de scolarité"
                      className={inputClass}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel className={labelClass}>
                    Description (optionnel)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Description du type de frais"
                      className={cn("resize-none", isCompact && "min-h-20 text-sm")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cycle"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel className={labelClass}>
                    Cycle (optionnel)
                  </FormLabel>
                  <Select
                    value={field.value ?? "ALL"}
                    onValueChange={(value) =>
                      field.onChange(value === "ALL" ? null : value)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Tous les cycles" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ALL">Tous les cycles</SelectItem>
                      <SelectItem value="MATERNELLE">Maternelle</SelectItem>
                      <SelectItem value="PRIMAIRE">Primaire</SelectItem>
                      <SelectItem value="SECONDAIRE">Secondaire</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="statusType"
              render={({ field }) => (
                <FormItem
                  className={cn(
                    "flex items-center gap-2 space-y-0 rounded-md border",
                    isCompact ? "p-2.5" : "p-3",
                  )}
                >
                  <FormControl>
                    <Checkbox
                      checked={field.value ?? true}
                      onCheckedChange={(checked) =>
                        field.onChange(Boolean(checked))
                      }
                    />
                  </FormControl>
                  <FormLabel className="font-normal">Type actif</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === "create" && isCompact ? (
              <p className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                Le code sera généré automatiquement et restera unique dans cette
                branche.
              </p>
            ) : null}

            <Button
              type="submit"
              size={isCompact ? "default" : undefined}
              className={cn(
                "mt-2 w-full font-medium",
                isCompact && "h-11 text-base",
              )}
              loading={isLoading}
            >
              {mode === "create"
                ? "Enregistrer le type de frais"
                : "Mettre à jour le type de frais"}
            </Button>

            {errorMessage ? (
              <p
                className={cn(
                  "mt-2 text-center text-red-500",
                  isCompact ? "text-xs" : "text-sm",
                )}
              >
                {errorMessage}
              </p>
            ) : null}
          </div>
        </form>
      </Form>
    </div>
  );
}
