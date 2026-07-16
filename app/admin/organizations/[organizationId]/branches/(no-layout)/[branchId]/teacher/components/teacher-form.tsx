"use client";

import { HTMLAttributes, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconCalendar } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/custom/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import generateUsername from "@/src/hooks/generateUsername";
import { teacherSchema } from "@/src/interfaces/Teacher";

import { createTeacherAction, updateTeacherAction } from "../teacher.action";

interface TeacherUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onTeacherCreated?: () => void;
  initialData?: z.infer<typeof teacherSchema>;
  onTeacherUpdate?: () => void;
  mode: "create" | "update";
  layout?: "default" | "dialog";
}

export function TeacherUpForm({
  className,
  onTeacherCreated,
  onTeacherUpdate,
  initialData,
  mode,
  layout = "default",
  ...props
}: TeacherUpFormProps) {
  const isDialog = layout === "dialog";
  const fieldClass = isDialog ? "space-y-0.5" : "space-y-1";
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const sexeToUi: Record<string, "masculin" | "feminin"> = {
    M: "masculin",
    F: "feminin",
  };

  const form = useForm<z.infer<typeof teacherSchema>>({
    resolver: zodResolver(teacherSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          sexe: sexeToUi[initialData.sexe] ?? initialData.sexe,
        }
      : {
          username: "",
          nom: "",
          prenom: "",
          postnom: "",
          sexe: "",
          telephone: "",
          email: "",
          address: "",
        },
  });

  const nom = form.watch("nom");
  const prenom = form.watch("prenom");

  useEffect(() => {
    if (!nom || !prenom) return;

    const username = generateUsername("Teacher", nom, prenom);
    if (mode === "create" || !form.getValues("username")) {
      form.setValue("username", username);
    }
  }, [form, mode, nom, prenom]);

  async function onSubmit(data: z.infer<typeof teacherSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const [result, err] = await createTeacherAction({ ...data });
        if (err) throw new Error(err.message);
        if (!result?.ok) {
          throw new Error(result?.message || "Creation impossible");
        }

        toast.success("Enseignant cree avec succes");
      } else {
        const [result, err] = await updateTeacherAction({ ...data });
        if (err) throw new Error(err.message);
        if (!result?.ok) {
          throw new Error(result?.message || "Mise a jour impossible");
        }

        toast.success("Enseignant mis a jour avec succes");
      }

      if (mode === "create") {
        onTeacherCreated?.();
      } else {
        onTeacherUpdate?.();
      }
    } catch (error: any) {
      const message = error?.message || "Erreur lors de l'operation";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("grid gap-4", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div
            className={cn(
              "grid gap-2.5",
              isDialog ? "sm:grid-cols-2" : "grid-cols-1 gap-2",
            )}
          >
            <FormField
              control={form.control}
              name="nom"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Le nom de l'enseignant" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="postnom"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel>Postnom</FormLabel>
                  <FormControl>
                    <Input placeholder="Le postnom de l'enseignant" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prenom"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel>Prénom</FormLabel>
                  <FormControl>
                    <Input placeholder="Le prénom de l'enseignant" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel>Date d&apos;affectation</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full justify-between text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value ? (
                            new Date(field.value).toLocaleDateString("fr-FR", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })
                          ) : (
                            <span>Choisir une date</span>
                          )}
                          <IconCalendar className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        fromYear={1900}
                        toYear={new Date().getFullYear()}
                        selected={
                          field.value ? new Date(field.value) : undefined
                        }
                        onSelect={(date) => field.onChange(date)}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telephone"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <PhoneInput
                      defaultCountry="CD"
                      placeholder="Téléphone"
                      maxLength={14}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sexe"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel>Sexe</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez le sexe" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent position="popper">
                      <SelectItem value="masculin">Masculin</SelectItem>
                      <SelectItem value="feminin">Féminin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input placeholder="Email de l'enseignant" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Input placeholder="Adresse de l'enseignant" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="hidden">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Code d'acces</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Votre code sera genere automatiquement"
                        {...field}
                        disabled
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className={cn(isDialog && "sm:col-span-2")}>
              <Button type="submit" className="mt-1 w-full sm:w-auto" loading={isLoading}>
                {mode === "create"
                  ? "Enregistrer l'enseignant"
                  : "Mettre à jour l'enseignant"}
              </Button>
              {errorMessage ? (
                <p className="mt-2 text-center text-sm text-red-500">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
