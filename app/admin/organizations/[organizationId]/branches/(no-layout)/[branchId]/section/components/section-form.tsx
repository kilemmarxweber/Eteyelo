"use client";

import { HTMLAttributes, useState } from "react";
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
import { Button } from "@/components/custom/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createSectionAction, updateSectionAction } from "../section.action";
import { sectionSchema } from "@/src/interfaces/Section";

interface SectionUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof sectionSchema>;
  mode: "create" | "update";
  layout?: "default" | "dialog";
}

export function SectionUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  layout = "default",
  ...props
}: SectionUpFormProps) {
  const isDialog = layout === "dialog";
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<z.infer<typeof sectionSchema>>({
    resolver: zodResolver(sectionSchema),
    defaultValues: initialData || {
      nameSection: "",
    },
  });

  async function onSubmit(data: z.infer<typeof sectionSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const [, err] = await createSectionAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Section créée avec succès");
      } else {
        const [, err] = await updateSectionAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Section mise à jour avec succès");
      }

      if (mode === "create") {
        form.reset({
          nameSection: "",
        });
        onCreated?.();
      } else {
        onUpdated?.();
      }
      onSuccess?.();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Une erreur est survenue";
      setErrorMessage(message);
      toast.error(
        mode === "create"
          ? message || "Échec de la création de la section"
          : "Échec de la mise à jour de la section",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const fieldClass = isDialog ? "space-y-0.5" : "space-y-1";
  const labelClass = isDialog
    ? "text-xs font-medium text-muted-foreground"
    : undefined;

  return (
    <div
      className={cn(isDialog ? "grid gap-2" : "grid gap-6", className)}
      {...props}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className={cn("grid", isDialog ? "gap-y-2" : "gap-2")}>
            <FormField
              control={form.control}
              name="nameSection"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel className={labelClass}>Nom de la section</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex. Scientifique, Technique…"
                      className={
                        isDialog
                          ? "h-9 rounded-md px-3 text-sm font-normal"
                          : undefined
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === "create" && isDialog ? (
              <p className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                Le code sera généré automatiquement et restera unique dans cette
                branche.
              </p>
            ) : null}

            <Button
              type="submit"
              size={isDialog ? "default" : undefined}
              className={cn(
                "mt-2 w-full font-medium",
                isDialog && "h-11 text-base",
              )}
              loading={isLoading}
            >
              {mode === "create"
                ? "Enregistrer la section"
                : "Mettre à jour la section"}
            </Button>

            {errorMessage ? (
              <p
                className={cn(
                  "mt-2 text-center text-red-500",
                  isDialog && "text-xs",
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
