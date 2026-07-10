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
import { IconSelector, IconCheck } from "@tabler/icons-react";

import { createStudentAction, updateStudentAction } from "../student.action";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { IconCalendar } from "@tabler/icons-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getParentsAction } from "../../parent/parent.action";
import { IParent } from "@/src/interfaces/Parent";
import { studentSchema } from "@/src/interfaces/Student";
import generateUsername from "@/src/hooks/generateUsername";

type StudentFormValues = z.infer<typeof studentSchema>;
type StudentInitialData = Partial<StudentFormValues>;

interface StudentUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onStudentUpdate?: () => void;
  initialData?: StudentInitialData;
  onStudentCreate?: () => void;
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  mode: "create" | "update";
}
//export type StudentCategory = "NORMAL" | "ORPHAN" | "VIP";
export const StudentCategory = {
  NORMAL: "NORMAL",
  ORPHAN: "ORPHAN",
  VIP: "VIP",
  SPONSORED: "SPONSORED",
  GROUPE: "GROUPE",
} as const;

export type StudentCategory =
  (typeof StudentCategory)[keyof typeof StudentCategory];
export function StudentUpForm({
  className,
  onStudentCreate,
  onStudentUpdate,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  ...props
}: StudentUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [Parents, setParents] = useState<IParent[]>([]);
  const sexeToUi: Record<string, "masculin" | "feminin"> = {
    M: "masculin",
    F: "feminin",
    masculin: "masculin",
    feminin: "feminin",
  };
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      username: initialData?.username ?? "",
      name: initialData?.name ?? "",
      prenom: initialData?.prenom ?? "",
      postnom: initialData?.postnom ?? "",
      sexe: initialData?.sexe ? (sexeToUi[initialData.sexe] ?? "") : "",
      dateOfBirth: initialData?.dateOfBirth ?? new Date(),
      parentId: initialData?.parentId ?? "",
      address: initialData?.address ?? "",
      category: initialData?.category ?? StudentCategory.NORMAL,
      telephone: initialData?.telephone ?? "+243000000000",
      email: initialData?.email ?? "",
      memberId: initialData?.memberId,
      studentId: initialData?.studentId,
      orgRole: initialData?.orgRole,
    },
  });

  useEffect(() => {
    const fecthParents = async () => {
      const [rawParents, err] = await getParentsAction();
      if (err) {
        throw err.message;
      }
      setParents(rawParents);
    };
    fecthParents();
  }, []);

  useEffect(() => {
    const nom = form.getValues("name");
    const prenom = form.getValues("prenom");

    if (nom && prenom) {
      const username = generateUsername("Student", nom, prenom);
      if (mode === "create" /* || mode === "update" */) {
        form.setValue("username", username);
      } else if (!form.getValues("username")) {
        form.setValue("username", username);
      }
    }
  }, [form.watch("name"), form.watch("prenom"), mode]);

  async function onSubmit(data: StudentFormValues) {
    setIsLoading(true);
    setErrorMessage("");
    try {
      if (mode === "create") {
        const [result, err] = await createStudentAction({
          ...data,
        });
        if (err) throw new Error(err.message);
        if (!result?.ok) throw new Error(result?.message);

        toast.success("Élève créé avec succès");
        form.reset({
          username: "",
          name: "",
          prenom: "",
          postnom: "",
          sexe: "",
          dateOfBirth: new Date(),
          parentId: "",
          address: "",
          category: StudentCategory.NORMAL,
          telephone: "+243000000000",
          email: "",
        });
        onCreated?.();
        onStudentCreate?.();
      } else {
        const [result, err] = await updateStudentAction({
          ...data,
        });
        if (err) throw new Error(err.message);
        if (!result?.ok) throw new Error(result?.message);

        toast.success("Élève mis à jour avec succès");
        onUpdated?.();
        onStudentUpdate?.();
      }

      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Une erreur est survenue";
      setErrorMessage(message);
      toast.error(
        mode === "create"
          ? "Échec de la création de l'élève"
          : "Échec de la mise à jour de l'élève",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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
                    <Input placeholder="Le nom de l'élève" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* POSTNOM */}
            <FormField
              control={form.control}
              name="postnom"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Postnom</FormLabel>
                  <FormControl>
                    <Input placeholder="Le postnom de l'élève" {...field} />
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
                    <Input placeholder="le prénom de l'élève" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sexe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sexe</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
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
            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de naissance</FormLabel>
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
              name="address"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Input placeholder="Adresse de l'élève" {...field} />
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
                        placeholder="Votre Code d'acces"
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
                name="telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+243812345678"
                        value={field.value ?? "+243000000000"}
                        onChange={(e) => {
                          let value = e.target.value;

                          // garder seulement chiffres
                          const digits = value.replace(/\D/g, "");

                          // retirer 243 si présent au début
                          const clean = digits.startsWith("243")
                            ? digits.slice(3)
                            : digits;

                          // construire format final
                          field.onChange("+243" + clean);
                        }}
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
                name="category"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Category</FormLabel>

                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir une catégorie" />
                        </SelectTrigger>
                      </FormControl>

                      <SelectContent>
                        <SelectItem value={StudentCategory.NORMAL}>
                          NORMAL
                        </SelectItem>
                        <SelectItem value={StudentCategory.ORPHAN}>
                          ORPHAN
                        </SelectItem>
                        <SelectItem value={StudentCategory.VIP}>VIP</SelectItem>
                        <SelectItem value={StudentCategory.SPONSORED}>
                          SPONSORED
                        </SelectItem>
                        <SelectItem value={StudentCategory.GROUPE}>
                          GROUPE
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
              name="parentId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Le code du parent</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "justify-between",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value
                            ? (() => {
                                const parent = Parents.find(
                                  (parent) => parent.id === field.value,
                                );

                                return parent
                                  ? `${parent.nom} ${parent.postnom} ${parent.prenom}`
                                  : "";
                              })()
                            : "Entrez le code du parent"}
                          <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput placeholder="Search parent..." />
                        <CommandList>
                          <CommandEmpty>No parent found.</CommandEmpty>
                          <CommandGroup>
                            {Parents.map((parent) => (
                              <CommandItem
                                value={parent.nom}
                                key={parent.id}
                                onSelect={() => {
                                  form.setValue("parentId", parent.id || "");
                                }}
                              >
                                <IconCheck
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    parent.id === field.value
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {`${parent.nom} ${parent.postnom} ${parent.prenom}`}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button className="mt-2" loading={isLoading}>
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
