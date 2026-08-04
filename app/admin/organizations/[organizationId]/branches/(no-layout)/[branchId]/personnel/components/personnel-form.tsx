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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import generateUsername from "@/src/hooks/generateUsername";
import { updatePersonnelSchema, userSchema } from "@/src/interfaces/Personnel";

import {
  createPersonnelAction,
  updatePersonnelAction,
} from "../personnel.action";

type PersonnelFormValues =
  | z.infer<typeof userSchema>
  | z.infer<typeof updatePersonnelSchema>;

interface PersonnelUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onPersonnelCreated?: () => void;
  onPersonnelUpdate?: () => void;
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof userSchema>;
  mode: "create" | "update";
  layout?: "default" | "dialog";
}

const emptyValues: PersonnelFormValues = {
  personnelId: "",
  username: "",
  name: "",
  prenom: "",
  postnom: "",
  sexe: "",
  telephone: "",
  email: "",
  address: "",
  orgRole: "",
  dateOfBirth: new Date(),
};

export function PersonnelUpForm({
  className,
  onPersonnelCreated,
  onPersonnelUpdate,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  layout = "default",
  ...props
}: PersonnelUpFormProps) {
  const isDialog = layout === "dialog";
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const sexeToUi: Record<string, "masculin" | "feminin"> = {
    M: "masculin",
    F: "feminin",
    masculin: "masculin",
    feminin: "feminin",
  };

  const schema = mode === "update" ? updatePersonnelSchema : userSchema;

  const form = useForm<PersonnelFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialData
      ? {
          ...initialData,
          sexe: initialData.sexe
            ? (sexeToUi[initialData.sexe] ?? initialData.sexe)
            : "",
          dateOfBirth: initialData.dateOfBirth
            ? new Date(initialData.dateOfBirth)
            : new Date(),
        }
      : emptyValues,
  });

  useEffect(() => {
    const nom = form.getValues("name");
    const prenom = form.getValues("prenom");

    if (nom && prenom) {
      const username = generateUsername("Personnel", nom, prenom);
      if (mode === "create") {
        form.setValue("username", username);
      } else if (!form.getValues("username")) {
        form.setValue("username", username);
      }
    }
  }, [form.watch("name"), form.watch("prenom"), mode, form]);

  async function onSubmit(data: PersonnelFormValues) {
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
        const [result, err] = await createPersonnelAction(payload);
        if (err) throw new Error(err.message);
        if (!result?.ok) {
          throw new Error(result?.message || "Création impossible");
        }

        toast.success("Personnel créé avec succès");
        form.reset({ ...emptyValues, dateOfBirth: new Date() });
        onCreated?.();
        onPersonnelCreated?.();
      } else {
        const [, err] = await updatePersonnelAction({
          ...payload,
          personnelId: data.personnelId,
        });
        if (err) throw new Error(err.message);

        toast.success("Personnel mis à jour avec succès");
        onUpdated?.();
        onPersonnelUpdate?.();
      }

      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Une erreur est survenue";
      setErrorMessage(message);
      toast.error(
        mode === "create"
          ? "Échec de la création du personnel"
          : "Échec de la mise à jour du personnel",
      );
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
    <div className={cn(isDialog ? "grid gap-2" : "grid gap-3", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div
            className={cn(
              "grid sm:grid-cols-2",
              isDialog ? "gap-x-4 gap-y-2" : "gap-2.5",
            )}
          >
            <FormField
              control={form.control}
              name="name"
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
              name="orgRole"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel className={labelClass}>Rôle</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      searchable="auto"
                      options={ALL_ORG_ROLE_SLUGS.map((slug) => ({
                        value: slug,
                        label: orgRoleLabel(slug),
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Choisir un rôle"
                      searchPlaceholder="Rechercher un rôle…"
                      emptyMessage="Aucun rôle trouvé."
                      triggerClassName={controlClass}
                    />
                  </FormControl>
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
                <FormItem className={fieldClass}>
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
              <FormField
                control={form.control}
                name="personnelId"
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
                size={isDialog ? "default" : "sm"}
                className={cn(
                  "mt-2 w-full font-medium",
                  isDialog && "h-11 text-base",
                )}
                loading={isLoading}
              >
                {mode === "create"
                  ? "Enregistrer le personnel"
                  : "Mettre à jour le personnel"}
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
