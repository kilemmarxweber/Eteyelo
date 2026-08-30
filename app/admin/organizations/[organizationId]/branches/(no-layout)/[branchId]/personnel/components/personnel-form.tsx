"use client";

import { HTMLAttributes, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { MemberPhotoField } from "@/app/admin/organizations/[organizationId]/members/member-photo-field";
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
import { MemberCyclesField } from "@/components/member-cycles-field";
import { isCycleGlobalRole } from "@/lib/auth/cycle-global-roles";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { MAX_IMAGE_UPLOAD_BYTES, uploadFile } from "@/lib/upload-file";
import generateUsername from "@/src/hooks/generateUsername";
import { updatePersonnelSchema, userSchema } from "@/src/interfaces/Personnel";
import { DateOfBirthPicker } from "@/components/date-of-birth-picker";

import { useTranslations } from "next-intl";
import {
  createPersonnelAction,
  updatePersonnelAction,
} from "../personnel.action";
import { getBranchCyclesForFormsAction } from "../../settings/branch-cycles.action";

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
  dateOfBirth: undefined as unknown as Date,
  image: "",
  cycles: [],
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
  const t = useTranslations("users.staff.form");
  const tCommon = useTranslations("common");
  const [cycleOptions, setCycleOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [isMultiCycle, setIsMultiCycle] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initialData?.image?.trim() || null,
  );

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
            : (undefined as unknown as Date),
          image: initialData.image ?? "",
          cycles: initialData.cycles ?? [],
        }
      : emptyValues,
  });

  const selectedOrgRole = form.watch("orgRole");
  const needsCycles =
    isMultiCycle && !isCycleGlobalRole(selectedOrgRole);

  const fullName = [
    form.watch("name"),
    form.watch("postnom"),
    form.watch("prenom"),
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [data, err] = await getBranchCyclesForFormsAction();
      if (cancelled || err || !data) return;
      setCycleOptions(data.cycles);
      setIsMultiCycle(data.isMultiCycle);
      if (!data.isMultiCycle && data.cycles[0] && !form.getValues("cycles")?.length) {
        form.setValue("cycles", [data.cycles[0].value]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form]);

  function handlePickPhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error(t("chooseImage"));
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.error(t("imageTooLarge"));
      return;
    }
    setPhotoPreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setPhotoFile(file);
  }

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

    if (
      isMultiCycle &&
      !isCycleGlobalRole(data.orgRole) &&
      (!data.cycles || data.cycles.length === 0)
    ) {
      setErrorMessage(t("selectCycle"));
      setIsLoading(false);
      return;
    }

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
      dateOfBirth: new Date(data.dateOfBirth),
    };

    try {
      if (mode === "create") {
        const [result, err] = await createPersonnelAction(payload);
        if (err) throw new Error(err.message);
        if (!result?.ok) {
          throw new Error(result?.message || t("createImpossible"));
        }

        toast.success(t("createSuccess"));
        form.reset(emptyValues);
        setPhotoFile(null);
        setPhotoPreview((current) => {
          if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
          return null;
        });
        onCreated?.();
        onPersonnelCreated?.();
      } else {
        const [, err] = await updatePersonnelAction({
          ...payload,
          personnelId: data.personnelId,
        });
        if (err) throw new Error(err.message);

        toast.success(t("updateSuccess"));
        onUpdated?.();
        onPersonnelUpdate?.();
      }

      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tCommon("errorGeneric");
      setErrorMessage(message);
      toast.error(mode === "create" ? t("createFailed") : t("updateFailed"));
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
                  <FormLabel className={labelClass}>{tCommon("person.lastName")}</FormLabel>
                  <FormControl>
                    <Input
                      inputSize="sm"
                      placeholder={tCommon("person.lastName")}
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
                  <FormLabel className={labelClass}>{tCommon("person.postnom")}</FormLabel>
                  <FormControl>
                    <Input
                      inputSize="sm"
                      placeholder={tCommon("person.postnom")}
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
                  <FormLabel className={labelClass}>{tCommon("person.firstName")}</FormLabel>
                  <FormControl>
                    <Input
                      inputSize="sm"
                      placeholder={tCommon("person.firstName")}
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
                  <FormLabel className={labelClass}>{tCommon("person.gender")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className={controlClass}>
                        <SelectValue placeholder={tCommon("person.gender")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent position="popper">
                      <SelectItem value="masculin">{tCommon("person.male")}</SelectItem>
                      <SelectItem value="feminin">{tCommon("person.female")}</SelectItem>
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
                  <FormLabel className={labelClass}>{tCommon("person.birthDate")}</FormLabel>
                  <FormControl>
                    <DateOfBirthPicker
                      value={field.value}
                      onChange={field.onChange}
                      className={controlClass}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="orgRole"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel className={labelClass}>{t("role")}</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      searchable="auto"
                      options={ALL_ORG_ROLE_SLUGS.map((slug) => ({
                        value: slug,
                        label: orgRoleLabel(slug),
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t("chooseRole")}
                      searchPlaceholder={t("searchRole")}
                      emptyMessage={t("noRoleFound")}
                      triggerClassName={controlClass}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {needsCycles ? (
              <div className="sm:col-span-2">
                <MemberCyclesField
                  options={cycleOptions}
                  value={form.watch("cycles") ?? []}
                  onChange={(next) =>
                    form.setValue("cycles", next, { shouldValidate: true })
                  }
                  isMultiCycle={isMultiCycle}
                />
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="telephone"
              render={({ field }) => (
                <FormItem className={fieldClass}>
                  <FormLabel className={labelClass}>{tCommon("person.phone")}</FormLabel>
                  <FormControl>
                    <PhoneInput
                      defaultCountry="CD"
                      placeholder={tCommon("person.phone")}
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
                  <FormLabel className={labelClass}>{tCommon("person.email")}</FormLabel>
                  <FormControl>
                    <Input
                      inputSize="sm"
                      placeholder={tCommon("person.email")}
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
                  <FormLabel className={labelClass}>{tCommon("person.address")}</FormLabel>
                  <FormControl>
                    <Input
                      inputSize="sm"
                      placeholder={tCommon("person.address")}
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
              <MemberPhotoField
                previewUrl={photoPreview}
                onPickFile={handlePickPhoto}
                disabled={isLoading}
                fullName={fullName}
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
                {mode === "create" ? t("saveStaff") : t("updateStaff")}
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
