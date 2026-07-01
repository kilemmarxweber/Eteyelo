"use client";

import { HTMLAttributes, useState, useEffect } from "react";
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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createParentAction, updateParentAction } from "../parent.action";

import { PhoneInput } from "@/components/ui/phone-input";
import { parentSchema } from "@/src/interfaces/Parent";
import generateUsername from "@/src/hooks/generateUsername";

interface ParentUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onParentCreated?: () => void;
  initialData?: z.input<typeof parentSchema>;
  mode: "create" | "update";
}

export function ParentUpForm({
  className,
  onParentCreated,
  initialData,
  mode,
  ...props
}: ParentUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const sexeToUi: Record<string, "masculin" | "feminin"> = {
    M: "masculin",
    F: "feminin",
  };
  const form = useForm<
    z.input<typeof parentSchema>,
    any,
    z.output<typeof parentSchema>
  >({
    resolver: zodResolver(parentSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          sexe: sexeToUi[initialData.sexe], // 👈 conversion DB → UI
        }
      : {
          username: "",
          name: "",
          prenom: "",
          postnom: "",
          sexe: "",
          telephone: "",
          email: "",
          address: "",
          discount: {
            scope: "PARENT",
            percentage: 0,
            minChildren: 0,
          },
        },
  });
  // Auto-generate username
  useEffect(() => {
    const nom = form.getValues("name");
    const prenom = form.getValues("prenom");

    if (nom && prenom) {
      const username = generateUsername("Parent", nom, prenom);
      form.setValue("username", username);
    }
  }, [form.watch("name"), form.watch("prenom")]);

  async function onSubmit(data: z.output<typeof parentSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const { discount, ...userData } = data;

        const [result, err] = await createParentAction({
          ...userData,
          discount,
        });
        if (err) {
          throw new Error(err.message);
        }

        if (!result?.ok) {
          throw new Error(result?.message || "Création impossible");
        }

        toast.success("Parent créé avec succès");
        onParentCreated?.();
      } else {
        const [, err] = await updateParentAction({
          ...data,
        });

        if (err) throw new Error(err.message);

        toast.success("Parent mis à jour avec succès");
      }

    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Une erreur est survenue";
      setErrorMessage(message);
      toast.error("Erreur lors de l'opération");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-3">
            {/* Nom */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Postnom */}
            <FormField
              control={form.control}
              name="postnom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postnom</FormLabel>
                  <FormControl>
                    <Input placeholder="Postnom" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Prenom */}
            <FormField
              control={form.control}
              name="prenom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prénom</FormLabel>
                  <FormControl>
                    <Input placeholder="Prénom" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Telephone + Sexe */}
            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem className="w-1/2">
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <PhoneInput defaultCountry="CD" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sexe"
                render={({ field }) => (
                  <FormItem className="w-1/2">
                    <FormLabel>Sexe</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sexe" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="masculin">Masculin</SelectItem>
                        <SelectItem value="feminin">Féminin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex gap-2">
              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="w-1/2">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="w-1/2">
                    <FormLabel>Adresse</FormLabel>
                    <FormControl>
                      <Input placeholder="Adresse complète" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {/* Username */}
            <div className="grid gap-3 border rounded-lg p-3 mt-2">
              <p className="text-sm font-medium">Réduction</p>

              {/* Scope */}
              <FormField
                control={form.control}
                name="discount.scope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de réduction</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Type de réduction" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PARENT">Parent</SelectItem>
                        <SelectItem value="GROUP">Groupe</SelectItem>
                        <SelectItem value="ORPHAN">Orphelin</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Percentage */}
              <FormField
                control={form.control}
                name="discount.percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pourcentage (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={
                          typeof field.value === "number" &&
                          Number.isFinite(field.value)
                            ? field.value
                            : ""
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(value === "" ? "" : Number(value));
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* MIN CHILDREN (ONLY GROUP) */}
              {form.watch("discount.scope") === "GROUP" && (
                <FormField
                  control={form.control}
                  name="discount.minChildren"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre minimum d'enfants</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={
                            typeof field.value === "number" &&
                            Number.isFinite(field.value)
                              ? field.value
                              : ""
                          }
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(
                              value === "" ? undefined : Number(value),
                            );
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>
            <div className="hidden">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code d'accès</FormLabel>
                    <FormControl>
                      <Input disabled {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {/* Submit */}
            <Button className="mt-2" loading={isLoading}>
              {mode === "create" ? "Enregistrer" : "Mettre à jour"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
