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

import { createParentAction, updateParentAction, updateParentExtraInfoAction } from "../parent.action";
import { getTypeFraisAction } from "../../frais/frais.action";

import { PhoneInput } from "@/components/ui/phone-input";
import { parentSchema } from "@/src/interfaces/Parent";
import generateUsername from "@/src/hooks/generateUsername";
import type { ITypeFrais } from "@/src/interfaces/Frais";
import { RegistrationExtraInfoFields } from "@/components/registration-extra-info-fields";
import { DateOfBirthPicker } from "@/components/date-of-birth-picker";
import {
  emptyFamilyExtraInfo,
  emptyStudentExtraInfo,
  type FamilyExtraInfo,
} from "@/lib/registration-extra-info";

interface ParentUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.input<typeof parentSchema> & {
    familyExtra?: FamilyExtraInfo;
  };
  mode: "create" | "update";
  layout?: "default" | "dialog";
}

export function ParentUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  layout = "default",
  ...props
}: ParentUpFormProps) {
  const isDialog = layout === "dialog";
  const fieldClass = isDialog ? "space-y-0.5" : undefined;
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [typeFraisOptions, setTypeFraisOptions] = useState<ITypeFrais[]>([]);
  const [familyExtra, setFamilyExtra] = useState<FamilyExtraInfo>(
    () => initialData?.familyExtra ?? emptyFamilyExtraInfo(),
  );
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
          dateOfBirth: initialData.dateOfBirth
            ? new Date(initialData.dateOfBirth as Date)
            : undefined,
          discount: {
            scope: initialData.discount?.scope ?? "PARENT",
            percentage: initialData.discount?.percentage ?? 0,
            minChildren: initialData.discount?.minChildren ?? 0,
            typeFraisId: initialData.discount?.typeFraisId ?? "",
          },
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
          dateOfBirth: undefined,
          discount: {
            scope: "PARENT",
            percentage: 0,
            minChildren: 0,
            typeFraisId: "",
          },
        },
  });

  const discountPercentage = form.watch("discount.percentage");

  useEffect(() => {
    setFamilyExtra(initialData?.familyExtra ?? emptyFamilyExtraInfo());
  }, [initialData?.familyExtra]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [types, error] = await getTypeFraisAction();
      if (ignore || error || !types) return;
      setTypeFraisOptions(types);
    })();
    return () => {
      ignore = true;
    };
  }, []);

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
        form.reset({
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
            typeFraisId: "",
          },
        });
        onCreated?.();
      } else {
        const [, err] = await updateParentAction({
          ...data,
        });

        if (err) throw new Error(err.message);

        if (data.parentId) {
          const [extraResult, extraErr] = await updateParentExtraInfoAction({
            parentId: data.parentId,
            familyExtra,
          });
          if (extraErr) throw new Error(extraErr.message);
          if (!extraResult?.ok) {
            throw new Error(
              extraResult?.message ??
                "Mise à jour des autres informations impossible",
            );
          }
        }

        toast.success("Parent mis à jour avec succès");
        onUpdated?.();
      }

      onSuccess?.();
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
    <div className={cn("grid gap-4", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div
            className={cn(
              "grid gap-2.5",
              isDialog ? "sm:grid-cols-2" : "grid-cols-1 gap-3",
            )}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom" {...field} />
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
                    <Input placeholder="Postnom" {...field} />
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
                    <Input placeholder="Prénom" {...field} />
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
                <FormItem className={fieldClass}>
                  <FormLabel>Sexe</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
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
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel>Date de naissance</FormLabel>
                  <FormControl>
                    <DateOfBirthPicker
                      value={field.value}
                      onChange={field.onChange}
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
                <FormItem className={fieldClass}>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Input placeholder="Adresse complète" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div
              className={cn(
                "grid gap-2.5 rounded-lg border p-3",
                isDialog ? "sm:col-span-2 sm:grid-cols-2" : "mt-2",
              )}
            >
              <p
                className={cn(
                  "text-sm font-medium",
                  isDialog && "sm:col-span-2",
                )}
              >
                Réduction
              </p>

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
                    <SelectContent position="popper">
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
                          const next = value === "" ? "" : Number(value);
                          field.onChange(next);
                          if (!(typeof next === "number" && next > 0)) {
                            form.setValue("discount.typeFraisId", "");
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {typeof discountPercentage === "number" &&
              discountPercentage > 0 ? (
                <FormField
                  control={form.control}
                  name="discount.typeFraisId"
                  render={({ field }) => (
                    <FormItem className={isDialog ? "sm:col-span-2" : undefined}>
                      <FormLabel>Type de frais concerné par la remise</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir le type de frais" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          {typeFraisOptions.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.nameType}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        La remise ne s&apos;appliquera qu&apos;aux frais de ce
                        type lors des paiements.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {/* MIN CHILDREN (ONLY GROUP) */}
              {form.watch("discount.scope") === "GROUP" && (
                <FormField
                  control={form.control}
                  name="discount.minChildren"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre minimum d&apos;enfants</FormLabel>
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
            {mode === "update" ? (
              <div
                className={cn(
                  "space-y-3 rounded-lg border border-dashed p-3",
                  isDialog && "sm:col-span-2",
                )}
              >
                <div>
                  <p className="text-sm font-medium">Autres informations</p>
                  <p className="text-xs text-muted-foreground">
                    Infos famille / origines du parent. Tous les enfants liés
                    héritent de ces données. Nationalité et langue restent sur
                    chaque élève.
                  </p>
                </div>
                <RegistrationExtraInfoFields
                  className="space-y-4"
                  studentExtra={emptyStudentExtraInfo()}
                  familyExtra={familyExtra}
                  hideStudent
                  onStudentChange={() => undefined}
                  onFamilyChange={(key, value) =>
                    setFamilyExtra((current) => ({ ...current, [key]: value }))
                  }
                />
              </div>
            ) : null}
            <div className={cn(isDialog && "sm:col-span-2")}>
              <Button type="submit" className="mt-1 w-full sm:w-auto" loading={isLoading}>
                {mode === "create" ? "Enregistrer" : "Mettre à jour"}
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
