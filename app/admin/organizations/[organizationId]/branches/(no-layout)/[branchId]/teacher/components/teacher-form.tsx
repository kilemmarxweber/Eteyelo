"use client";

import { HTMLAttributes, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { MemberPhotoField } from "@/app/admin/organizations/[organizationId]/members/member-photo-field";
import { Button } from "@/components/custom/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import { useSession } from "@/lib/auth-client";
import { getClassDisplayLabel } from "@/lib/branch-capabilities";
import { cn } from "@/lib/utils";
import { MAX_IMAGE_UPLOAD_BYTES, uploadFile } from "@/lib/upload-file";
import generateUsername from "@/src/hooks/generateUsername";
import { IClasse } from "@/src/interfaces/Classe";
import { ICours } from "@/src/interfaces/Cours";
import { teacherSchema } from "@/src/interfaces/Teacher";

import { getClassesAction } from "../../classe/classe.action";
import { getCoursAction } from "../../cours/cours.action";
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
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [classes, setClasses] = useState<IClasse[]>([]);
  const [courses, setCourses] = useState<ICours[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initialData?.image?.trim() || null,
  );
  const peopleLabels = useBranchPeopleLabels();
  const { data: session } = useSession();
  const classLabel = getClassDisplayLabel(session?.branch?.typebranch);
  const classLabelLower = classLabel.toLowerCase();
  const classOfLabel =
    classLabelLower === "auditoire"
      ? "de l'auditoire"
      : classLabelLower === "groupe"
        ? "du groupe"
        : `de la ${classLabelLower}`;
  const classSelectLabel =
    classLabelLower === "auditoire"
      ? "l'auditoire"
      : classLabelLower === "groupe"
        ? "le groupe"
        : `la ${classLabelLower}`;
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
          estTitulaire: initialData.estTitulaire ?? false,
          classeId: initialData.classeId ?? "",
          coursId: initialData.coursId ?? "",
          image: initialData.image ?? "",
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
          estTitulaire: false,
          classeId: "",
          coursId: "",
          image: "",
        },
  });

  const nom = form.watch("nom");
  const prenom = form.watch("prenom");
  const postnom = form.watch("postnom");
  const estTitulaire = form.watch("estTitulaire");
  const selectedClasseId = form.watch("classeId");
  const fullName = [nom, postnom, prenom].filter(Boolean).join(" ");

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function handlePickPhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image (JPEG, PNG, WebP…).");
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.error("Image trop volumineuse (max. 5 Mo).");
      return;
    }
    setPhotoPreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setPhotoFile(file);
  }

  useEffect(() => {
    if (!nom || !prenom) return;

    const username = generateUsername("Teacher", nom, prenom);
    if (mode === "create" || !form.getValues("username")) {
      form.setValue("username", username);
    }
  }, [form, mode, nom, prenom]);

  useEffect(() => {
    let cancelled = false;

    async function loadClasses() {
      const [rawClasses, classErr] = await getClassesAction();
      if (cancelled) return;
      if (!classErr && rawClasses) {
        setClasses(rawClasses.filter((classe) => classe.statusClasse !== false));
      }
    }

    void loadClasses();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!estTitulaire) {
      setCourses([]);
      return;
    }

    let cancelled = false;

    async function loadCourses() {
      const [rawCourses, courseErr] = await getCoursAction(
        selectedClasseId ? { classeId: selectedClasseId } : {},
      );
      if (cancelled) return;
      if (!courseErr && rawCourses) {
        setCourses(rawCourses);
        const currentCoursId = form.getValues("coursId");
        if (
          currentCoursId &&
          !rawCourses.some((cours) => cours.id === currentCoursId)
        ) {
          form.setValue("coursId", "");
        }
      }
    }

    void loadCourses();

    return () => {
      cancelled = true;
    };
  }, [estTitulaire, selectedClasseId, form]);

  async function onSubmit(data: z.infer<typeof teacherSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    const estTitulaire = Boolean(data.estTitulaire);
    let image = data.image?.trim() || "";
    if (photoFile) {
      const uploaded = await uploadFile(photoFile);
      if (!uploaded.ok) {
        setIsLoading(false);
        setErrorMessage(uploaded.message);
        toast.error(uploaded.message);
        return;
      }
      image = uploaded.url;
    }
    const payload = {
      ...data,
      image,
      dateOfBirth:
        mode === "create"
          ? new Date()
          : data.dateOfBirth
            ? new Date(data.dateOfBirth)
            : new Date(),
      estTitulaire,
      classeId: estTitulaire ? data.classeId : undefined,
      coursId: estTitulaire ? data.coursId : undefined,
    };

    try {
      if (mode === "create") {
        const [result, err] = await createTeacherAction(payload);
        if (err) throw new Error(err.message);
        if (!result?.ok) {
          throw new Error(result?.message || "Creation impossible");
        }

        toast.success(
          estTitulaire
            ? `${peopleLabels.teacher} titulaire créé avec succès`
            : `${peopleLabels.teacher} cree avec succes`,
        );
        onTeacherCreated?.();
      } else {
        const [result, err] = await updateTeacherAction(payload);
        if (err) throw new Error(err.message);
        if (!result?.ok) {
          throw new Error(result?.message || "Mise a jour impossible");
        }

        toast.success(
          estTitulaire
            ? `${peopleLabels.teacher} titulaire mis à jour avec succès`
            : `${peopleLabels.teacher} mis a jour avec succes`,
        );
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
                <FormItem className={cn(fieldClass, "sm:col-span-2")}>
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

            <div className="sm:col-span-2">
              <MemberPhotoField
                previewUrl={photoPreview}
                onPickFile={handlePickPhoto}
                disabled={isLoading}
                fullName={fullName}
              />
            </div>

            <FormField
              control={form.control}
              name="estTitulaire"
              render={({ field }) => (
                <FormItem className="flex items-start gap-2 space-y-0 rounded-md border p-3 sm:col-span-2">
                  <FormControl>
                    <Checkbox
                      checked={Boolean(field.value)}
                      onCheckedChange={(checked) => {
                        const next = Boolean(checked);
                        field.onChange(next);
                        if (!next) {
                          form.setValue("classeId", "");
                          form.setValue("coursId", "");
                        }
                      }}
                    />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="font-normal leading-snug">
                      Titulaire (superviseur) {classOfLabel}
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Cochez si ce {peopleLabels.teacherLower} est le titulaire{" "}
                      {classOfLabel} pour l&apos;année en cours.
                    </p>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {estTitulaire ? (
              <>
                <FormField
                  control={form.control}
                  name="classeId"
                  render={({ field }) => (
                    <FormItem className={fieldClass}>
                      <FormLabel className={labelClass}>{classLabel}</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("coursId", "");
                        }}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger className={controlClass}>
                            <SelectValue
                              placeholder={`Sélectionner ${classSelectLabel}`}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          {classes.map((classe) => (
                            <SelectItem key={classe.id} value={classe.id}>
                              {classe.nameClasse}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="coursId"
                  render={({ field }) => (
                    <FormItem className={fieldClass}>
                      <FormLabel className={labelClass}>
                        Cours principal
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger className={controlClass}>
                            <SelectValue placeholder="Sélectionner le cours" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          {courses.map((cours) => (
                            <SelectItem key={cours.id} value={cours.id}>
                              {cours.nameCours}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedClasseId && courses.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Aucun cours pondéré pour cette classe.
                        </p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : null}

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
                size={isDialog ? "default" : "sm"}
                className={cn(
                  "mt-2 w-full font-medium",
                  isDialog && "h-11 text-base",
                )}
                loading={isLoading}
              >
                {mode === "create"
                  ? `Enregistrer l'${peopleLabels.teacherLower}`
                  : `Mettre à jour l'${peopleLabels.teacherLower}`}
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
