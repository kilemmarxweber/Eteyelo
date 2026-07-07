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
import { DialogClose } from "@/components/ui/dialog";
import { createTypeFraisAction } from "../frais.action";
import { typeFraisSchema } from "@/src/interfaces/Frais";

interface TypeFraisUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onTypeFraisCreated?: () => void;
  initialData?: z.infer<typeof typeFraisSchema>;
  mode: "create" | "update";
}

export function TypeFraisUpForm({
  className,
  onTypeFraisCreated,
  initialData,
  mode,
  ...props
}: TypeFraisUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [typeFraisCreated, setTypeFraisCreated] = useState(false);

  const form = useForm<z.infer<typeof typeFraisSchema>>({
    resolver: zodResolver(typeFraisSchema),
    defaultValues: initialData || {
      codeType: "",
      nameType: "",
      description: "",
      statusType: true,
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
      } else {
        throw new Error("La modification des types de frais n'est pas encore disponible");
      }

      setTypeFraisCreated(true);
      onTypeFraisCreated?.();
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

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="codeType"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: SCOL" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nameType"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Nom du type</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Frais de scolarité"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Description (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Description du type de frais"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button className="mt-2" loading={isLoading}>
              {mode === "create"
                ? "Enregistrer le type de frais"
                : "Mettre à jour le type de frais"}
            </Button>

            {typeFraisCreated && <DialogClose />}
            {errorMessage && (
              <p className="mt-2 text-center text-red-500 text-sm">
                {errorMessage}
              </p>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
