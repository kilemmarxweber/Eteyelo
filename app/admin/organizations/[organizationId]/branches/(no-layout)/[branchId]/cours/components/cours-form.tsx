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
import { createCoursAction, updateCoursAction } from "../cours.action";
import { coursSchema } from "@/src/interfaces/Cours";
import { Textarea } from "@/components/ui/textarea";

interface CoursUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof coursSchema>;
  mode: "create" | "update";
}

export function CoursUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  ...props
}: CoursUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<z.infer<typeof coursSchema>>({
    resolver: zodResolver(coursSchema),
    defaultValues: initialData || {
      nameCours: "",
      codeCours: "",
      description: "",
    },
  });

  async function onSubmit(data: z.infer<typeof coursSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const [cours, err] = await createCoursAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Cours créée avec succès");
      } else {
        const [cours, err] = await updateCoursAction({
          ...data,
        }); // Action de mise à jour
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Cours mis à jour avec succès");
      }

      if (mode === "create") {
        form.reset({ nameCours: "", codeCours: "", description: "" });
        onCreated?.();
      } else {
        onUpdated?.();
      }
      onSuccess?.();
    } catch (error: any) {
      console.log(error);
      setErrorMessage(error.message ?? "");
      toast.error(
        mode === "create"
          ? error.message || "Échec de la création de la cours"
          : "Échec de la mise à jour de la cours",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-5">
            <FormField
              control={form.control}
              name="nameCours"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Nom du cours</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex. Mathématiques" autoFocus {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Décrivez brièvement le contenu ou l'objectif du cours"
                      className="min-h-28 resize-none"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {mode === "create" && (
              <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Le code sera généré automatiquement et restera unique dans cette branche.
              </p>
            )}
            <Button type="submit" className="mt-2" loading={isLoading}>
              {mode === "create"
                ? "Créer le cours"
                : "Enregistrer les modifications"}
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

function generateCoursname(nom: string, prenom: string): string {
  return `${nom.toUpperCase()}/${prenom.toUpperCase()}`;
}
