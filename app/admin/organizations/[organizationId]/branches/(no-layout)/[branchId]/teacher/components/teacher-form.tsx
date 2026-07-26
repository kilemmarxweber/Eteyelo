"use client";

import { HTMLAttributes, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { PhoneInput } from "@/components/ui/phone-input";
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
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";

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
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const peopleLabels = useBranchPeopleLabels();
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
          dateOfBirth: initialData.dateOfBirth
            ? new Date(initialData.dateOfBirth)
            : new Date(),
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
          dateOfBirth: new Date(),
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

    const payload = {
      ...data,
      dateOfBirth:
        mode === "create"
          ? new Date()
          : data.dateOfBirth
            ? new Date(data.dateOfBirth)
            : new Date(),
    };

    try {
      if (mode === "create") {
        const [result, err] = await createTeacherAction(payload);
        if (err) throw new Error(err.message);
        if (!result?.ok) {
          throw new Error(result?.message || "Creation impossible");
        }

        toast.success(`${peopleLabels.teacher} cree avec succes`);
        onTeacherCreated?.();
      } else {
        const [result, err] = await updateTeacherAction(payload);
        if (err) throw new Error(err.message);
        if (!result?.ok) {
          throw new Error(result?.message || "Mise a jour impossible");
        }

        toast.success(`${peopleLabels.teacher} mis a jour avec succes`);
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

  const fieldClass = "space-y-0.5";
  const labelClass = "text-xs font-medium text-muted-foreground";
  const controlClass = isDialog
    ? "h-9 rounded-md px-3 text-sm font-normal"
    : "h-8 rounded-md px-3 text-sm font-normal";

  return (
    <div className={cn("grid gap-3", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="nom"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel className={labelClass}>Nom</FormLabel>
                  <FormControl>
                    <Input
                      inputSize="sm"
                      placeholder="Nom"
                      className={controlClass}
                      {...field}
                    />
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
                  <FormLabel className={labelClass}>Postnom</FormLabel>
                  <FormControl>
                    <Input
                      inputSize="sm"
                      placeholder="Postnom"
                      className={controlClass}
                      {...field}
                    />
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
                  <FormLabel className={labelClass}>Prénom</FormLabel>
                  <FormControl>
                    <Input
                      inputSize="sm"
                      placeholder="Prénom"
                      className={controlClass}
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
                  <FormLabel className={labelClass}>Sexe</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className={controlClass}>
                        <SelectValue placeholder="Sexe" />
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
              name="telephone"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel className={labelClass}>Téléphone</FormLabel>
                  <FormControl>
                    <PhoneInput
                      defaultCountry="CD"
                      placeholder="Téléphone"
                      maxLength={14}
                      className="h-8 [&_button]:h-8 [&_input]:h-8 [&_input]:text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel className={labelClass}>E-mail</FormLabel>
                  <FormControl>
                    <Input
                      inputSize="sm"
                      placeholder="Email"
                      className={controlClass}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className={cn(fieldClass, "sm:col-span-2")}>
                  <FormLabel className={labelClass}>Adresse</FormLabel>
                  <FormControl>
                    <Input
                      inputSize="sm"
                      placeholder="Adresse"
                      className={controlClass}
                      {...field}
                    />
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
                  <FormItem>
                    <FormControl>
                      <Input {...field} disabled />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="sm:col-span-2">
              <Button
                type="submit"
                size="sm"
                className="mt-1 w-full font-medium sm:w-auto"
                loading={isLoading}
              >
                {mode === "create"
                  ? `Enregistrer le ${peopleLabels.teacherLower}`
                  : `Mettre à jour le ${peopleLabels.teacherLower}`}
              </Button>
            </div>

            {errorMessage ? (
              <p className="text-center text-xs text-red-500 sm:col-span-2">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </form>
      </Form>
    </div>
  );
}
