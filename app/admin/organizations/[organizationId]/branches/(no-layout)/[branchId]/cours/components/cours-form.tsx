"use client";
import { HTMLAttributes, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { toast } from "sonner";
import { createCoursAction, updateCoursAction } from "../cours.action";
import { coursSchema } from "@/src/interfaces/Cours";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIMARY_DOMAIN_ORDER,
  PRIMARY_DOMAIN_SHORT_LABELS,
  type PrimaryDomainCode,
} from "@/lib/primary-domains";

interface CoursUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof coursSchema>;
  mode: "create" | "update";
  /** Affiche le select domaine (branche primaire uniquement). */
  isPrimary?: boolean;
}

export function CoursUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  isPrimary = false,
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
      primaryDomain: null,
    },
  });

  async function onSubmit(data: z.infer<typeof coursSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const payload = {
        ...data,
        primaryDomain: isPrimary ? (data.primaryDomain ?? null) : undefined,
      };

      if (mode === "create") {
        const [, err] = await createCoursAction(payload);
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Cours créée avec succès");
      } else {
        const [, err] = await updateCoursAction(payload);
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Cours mis à jour avec succès");
      }

      if (mode === "create") {
        form.reset({
          nameCours: "",
          codeCours: "",
          description: "",
          primaryDomain: null,
        });
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
                    <Input
                      placeholder="Ex. Mathématiques"
                      autoFocus
                      {...field}
                      disabled={isLoading}
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
            {isPrimary && (
              <FormField
                control={form.control}
                name="primaryDomain"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Domaine du bulletin (optionnel)</FormLabel>
                    <Select
                      value={field.value ?? "NONE"}
                      onValueChange={(value) =>
                        field.onChange(
                          value === "NONE" ? null : (value as PrimaryDomainCode),
                        )
                      }
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir un domaine" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NONE">Non classé</SelectItem>
                        {PRIMARY_DOMAIN_ORDER.map((code) => (
                          <SelectItem key={code} value={code}>
                            {PRIMARY_DOMAIN_SHORT_LABELS[code]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Les 5 domaines RDC. Si vous laissez « Non classé » à la
                      création, une suggestion automatique peut être appliquée.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {mode === "create" && (
              <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Le code sera généré automatiquement et restera unique dans cette
                branche.
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
