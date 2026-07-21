"use client";
import { HTMLAttributes, useState, useEffect, useMemo } from "react";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { IconCalendar } from "@tabler/icons-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createStudentAction, updateStudentAction } from "../student.action";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import { hidesParentManagement } from "@/lib/branch-capabilities";
import { useSession } from "@/lib/auth-client";
import { getParentsAction } from "../../parent/parent.action";
import { IParent } from "@/src/interfaces/Parent";
import { studentSchema } from "@/src/interfaces/Student";
import generateUsername from "@/src/hooks/generateUsername";

const studentFormSchemaBase = studentSchema.extend({
  parentId: z.string().optional(),
});

type StudentFormValues = z.infer<typeof studentFormSchemaBase>;
type StudentInitialData = Partial<StudentFormValues>;

interface StudentUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onStudentUpdate?: () => void;
  initialData?: StudentInitialData;
  onStudentCreate?: () => void;
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  mode: "create" | "update";
  layout?: "default" | "dialog";
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
  layout = "default",
  ...props
}: StudentUpFormProps) {
  const isDialog = layout === "dialog";
  const fieldClass = isDialog ? "space-y-0.5" : "space-y-1";
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const peopleLabels = useBranchPeopleLabels();
  const { data: session } = useSession();
  const hidesParent = hidesParentManagement(session?.branch?.typebranch);
  const formSchema = useMemo(
    () =>
      hidesParent && mode === "create"
        ? studentFormSchemaBase
        : studentFormSchemaBase.refine((data) => Boolean(data.parentId?.trim()), {
            path: ["parentId"],
            message: "Veuillez selectionner un parent",
          }),
    [hidesParent, mode],
  );
  const [Parents, setParents] = useState<IParent[]>([]);
  const sexeToUi: Record<string, "masculin" | "feminin"> = {
    M: "masculin",
    F: "feminin",
    masculin: "masculin",
    feminin: "feminin",
  };
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: initialData?.username ?? "",
      name: initialData?.name ?? "",
      prenom: initialData?.prenom ?? "",
      postnom: initialData?.postnom ?? "",
      sexe: initialData?.sexe ? (sexeToUi[initialData.sexe] ?? "") : "",
      dateOfBirth: initialData?.dateOfBirth ?? new Date(),
      placeOfBirth: initialData?.placeOfBirth ?? "",
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
    if (hidesParent && mode === "create") return;
    const fecthParents = async () => {
      const [rawParents, err] = await getParentsAction();
      if (err) {
        throw err.message;
      }
      setParents(rawParents);
    };
    fecthParents();
  }, [hidesParent, mode]);

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
          parentId: data.parentId ?? "",
        });
        if (err) throw new Error(err.message);
        if (!result?.ok) throw new Error(result?.message);

        toast.success(`${peopleLabels.student} créé avec succès`);
        form.reset({
          username: "",
          name: "",
          prenom: "",
          postnom: "",
          sexe: "",
          dateOfBirth: new Date(),
          placeOfBirth: "",
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
          parentId: data.parentId ?? "",
        });
        if (err) throw new Error(err.message);
        if (!result?.ok) throw new Error(result?.message);

        toast.success(`${peopleLabels.student} mis à jour avec succès`);
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
          ? `Échec de la création de l'${peopleLabels.studentLower}`
          : `Échec de la mise à jour de l'${peopleLabels.studentLower}`,
      );
    } finally {
      setIsLoading(false);
    }
  }

  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className={cn("grid gap-4", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div
            className={cn(
              "grid gap-2.5",
              isDialog ? "sm:grid-cols-2" : "grid-cols-1",
            )}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder={peopleLabels.namePlaceholder} {...field} />
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
                    <Input placeholder={peopleLabels.postnomPlaceholder} {...field} />
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
                    <Input placeholder={peopleLabels.prenomPlaceholder} {...field} />
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
              name="placeOfBirth"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel>Lieu de naissance (facultatif)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ville ou territoire" {...field} />
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
                    <PopoverContent className="w-auto p-0" align="start">
                      {mounted ? (
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
                      ) : null}
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
                <FormItem className={cn(fieldClass, isDialog && "sm:col-span-2")}>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Input placeholder={peopleLabels.addressPlaceholder} {...field} />
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
            {!hidesParent || mode === "update" ? (
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem className={cn(fieldClass, isDialog && "sm:col-span-2")}>
                  <FormLabel>Parent</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      searchable
                      options={Parents.map((parent) => ({
                        value: parent.id ?? "",
                        label: [parent.nom, parent.postnom, parent.prenom]
                          .filter(Boolean)
                          .join(" "),
                        search: [
                          parent.nom,
                          parent.postnom,
                          parent.prenom,
                          parent.username,
                          parent.telephone,
                        ]
                          .filter(Boolean)
                          .join(" "),
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Sélectionner un parent"
                      searchPlaceholder="Rechercher un parent…"
                      emptyMessage="Aucun parent trouvé."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            ) : null}

            <div className={cn(isDialog && "sm:col-span-2")}>
              <Button type="submit" className="mt-1 w-full sm:w-auto" loading={isLoading}>
                {mode === "create"
                  ? peopleLabels.saveLabel
                  : peopleLabels.updateLabel}
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
