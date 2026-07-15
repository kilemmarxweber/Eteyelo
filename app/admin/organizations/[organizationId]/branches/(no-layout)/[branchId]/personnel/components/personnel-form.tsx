"use client";
import { HTMLAttributes, useState, useEffect } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
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
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";
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

import {
  createPersonnelAction,
  updatePersonnelAction,
} from "../personnel.action";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { IconCalendar } from "@tabler/icons-react";
import { Calendar } from "@/components/ui/calendar";

import { PhoneInput } from "@/components/ui/phone-input";
import generateUsername from "@/src/hooks/generateUsername";
import { updatePersonnelSchema, userSchema } from "@/src/interfaces/Personnel";

interface PersonnelUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onPersonnelCreated?: () => void;
  initialData?: z.infer<typeof userSchema>;
  onPersonnelUpdate?: () => void;
  mode: "create" | "update";
}

export function PersonnelUpForm({
  className,
  onPersonnelCreated,
  onPersonnelUpdate,
  initialData,
  mode,
  ...props
}: PersonnelUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const sexeToUi: Record<string, "masculin" | "feminin"> = {
    M: "masculin",
    F: "feminin",
  };
  //type PersonnelFormValues = z.infer<typeof userSchema>;
  type PersonnelFormValues =
    | z.infer<typeof userSchema>
    | z.infer<typeof updatePersonnelSchema>;

  const schema = mode === "update" ? updatePersonnelSchema : userSchema;

  const form = useForm<PersonnelFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialData
      ? {
          ...initialData,
          sexe: sexeToUi[initialData.sexe], // 👈 conversion DB → UI
        }
      : {
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
        },
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
  }, [form.watch("name"), form.watch("prenom"), mode]);

  async function onSubmit(data: z.infer<typeof userSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const [result, err] = await createPersonnelAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        if (!result?.ok) {
          throw new Error(result?.message || "CrÃ©ation impossible");
        }
        toast.success("Personnel créé avec succès");
      } else {
        const [, err] = await updatePersonnelAction({
          ...data,
          personnelId: data.personnelId,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Personnel mis à jour avec succès");
      }
      if (mode === "create") {
        onPersonnelCreated?.();
      } else {
        onPersonnelUpdate?.();
      }
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

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Le nom du Personnel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="postnom"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Postnom</FormLabel>
                  <FormControl>
                    <Input placeholder="Le postnom du Personnel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prenom"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Prénom</FormLabel>
                  <FormControl>
                    <Input placeholder="le prénom du Personnel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem className="space-y-1  w-1/2">
                    <FormLabel>Date d'affectation</FormLabel>
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
                              new Date(field.value).toLocaleDateString(
                                "fr-FR",
                                {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                },
                              )
                            ) : (
                              <span>Choisir une date</span>
                            )}

                            <IconCalendar className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>

                      <PopoverContent
                        className="w-auto p-0"
                        align="start"
                        side="bottom"
                      >
                        <Calendar
                          mode="single"
                          captionLayout="dropdown"
                          fromYear={1900}
                          toYear={new Date().getFullYear()}
                          selected={
                            field.value ? new Date(field.value) : undefined
                          }
                          onSelect={(date) => {
                            field.onChange(date);
                          }}
                        />
                      </PopoverContent>
                    </Popover>

                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="orgRole"
                render={({ field }) => (
                  <FormItem className="space-y-1  w-1/2">
                    <FormLabel>Rôle</FormLabel>

                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={pending}
                    >
                      <FormControl>
                        <SelectTrigger className="h-11 sm:h-10">
                          <SelectValue placeholder="Choisir un rôle" />
                        </SelectTrigger>
                      </FormControl>

                      <SelectContent>
                        {ALL_ORG_ROLE_SLUGS.map((slug) => (
                          <SelectItem key={slug} value={slug}>
                            {orgRoleLabel(slug)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Téléphone </FormLabel>
                    <FormControl>
                      <PhoneInput
                        defaultCountry="CD"
                        placeholder="Téléphone"
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
                  <FormItem className="space-y-1 w-1/2">
                    <FormLabel>Sexe</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez le sexe" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem key={"masculin"} value={"masculin"}>
                          Masculin
                        </SelectItem>
                        <SelectItem key={"feminin"} value={"feminin"}>
                          Féminin
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>E-mail </FormLabel>
                  <FormControl>
                    <Input placeholder="le Email du Personnel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Input placeholder="l'adresse du Personnel" {...field} />
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
                        placeholder="votre code sera generé automatiquement"
                        {...field}
                        disabled
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="personnelId"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Code d'acces</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="votre code sera generé automatiquement"
                        {...field}
                        disabled
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" className="mt-2" loading={isLoading}>
              {mode === "create"
                ? "Enregistrer l'utilisateur"
                : "Mettre à jour l'utilisateur"}
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
