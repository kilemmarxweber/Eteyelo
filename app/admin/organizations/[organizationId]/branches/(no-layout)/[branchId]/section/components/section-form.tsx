"use client";
import { HTMLAttributes, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { any, z } from "zod";
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
import { DialogClose } from "@/components/ui/dialog";
import { createSectionAction, updateSectionAction } from "../section.action";
import { sectionSchema } from "@/src/interfaces/Section";

interface SectionUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSectionAction?: () => void;
  initialData?: z.infer<typeof sectionSchema>;
  mode: "create" | "update";
}

export function SectionUpForm({
  className,
  onSectionAction,
  initialData,
  mode,
  ...props
}: SectionUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [SectionCreated, setSectionCreated] = useState(false);

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
        const [section, err] = await createSectionAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Section créée avec succès");
      } else {
        const [section, err] = await updateSectionAction({
          ...data,
        }); // Action de mise à jour
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Section mis à jour avec succès");
      }

      if (mode === "create") {
        form.reset({
          nameSection: "",
        });
      }
      setSectionCreated(true);
      onSectionAction && onSectionAction(); // Appeler la fonction de rafraîchissement
    } catch (error: any) {
      toast.error(
        mode === "create"
          ? error.message || "Échec de la création de la section"
          : "Échec de la mise à jour de la section"
      );
    } finally {
      setIsLoading(false);
    }
  }

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <FormField
              control={form.control}
              name="nameSection"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Nom de la section</FormLabel>
                  <FormControl>
                    <Input placeholder="Le nom de la section" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button className="mt-2" loading={isLoading}>
              {mode === "create"
                ? "Enregistrer la section"
                : "Mettre à jour de la section"}
            </Button>
            {SectionCreated && <DialogClose />}
            {errorMessage && (
              <p className="mt-2 text-center text-red-500">{errorMessage}</p>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}

function generateSectionname(nom: string, prenom: string): string {
  return `${nom.toUpperCase()}/${prenom.toUpperCase()}`;
}
