"use client";
import { HTMLAttributes, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
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
  createCoursAction,
  getAtelierCourseLinkOptionsAction,
  updateCoursAction,
} from "../cours.action";
import { coursSchema } from "@/src/interfaces/Cours";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIMARY_DOMAIN_ORDER,
  PRIMARY_DOMAIN_SHORT_LABELS,
} from "@/lib/primary-domains";
import { getBranchPrimaryDomainsAction } from "../../settings/settings.action";
import { getPracticalDomainsAction } from "../../settings/practical-domains.action";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { AtelierLinkOptions } from "@/lib/atelier-course-link-shared";
import {
  ATELIER_LINK_PERIOD_AUTO,
  filterCoursesForSecondaryClass,
} from "@/lib/atelier-course-link-shared";

interface CoursUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof coursSchema>;
  mode: "create" | "update";
  /** Affiche le select domaine (branche primaire uniquement). */
  isPrimary?: boolean;
  /** Association directe vers un cours secondaire (branche atelier). */
  isAtelier?: boolean;
  layout?: "default" | "dialog";
}

export function CoursUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  isPrimary = false,
  isAtelier = false,
  layout = "default",
  ...props
}: CoursUpFormProps) {
  const t = useTranslations("teaching.courses.form");
  const tc = useTranslations("common");
  const isDialog = layout === "dialog";
  const showDomain = isPrimary && !isAtelier;
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [domains, setDomains] = useState<
    Array<{ code: string; shortLabel: string }>
  >(() =>
    PRIMARY_DOMAIN_ORDER.map((code) => ({
      code,
      shortLabel: PRIMARY_DOMAIN_SHORT_LABELS[code],
    })),
  );
  const [atelierLinkOptions, setAtelierLinkOptions] =
    useState<AtelierLinkOptions>({
      courses: [],
      classes: [],
      periodsByBranchId: {},
    });
  const [linkFilterClasseId, setLinkFilterClasseId] = useState<string>("");
  const [practicalDomains, setPracticalDomains] = useState<
    Array<{ id: string; name: string; code: string }>
  >([]);

  useEffect(() => {
    if (!showDomain) return;
    let ignore = false;
    getBranchPrimaryDomainsAction()
      .then((rows) => {
        if (ignore || !rows.length) return;
        setDomains(
          rows.map((d) => ({ code: d.code, shortLabel: d.shortLabel })),
        );
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      ignore = true;
    };
  }, [showDomain]);

  useEffect(() => {
    if (!isAtelier) return;
    let ignore = false;
    getAtelierCourseLinkOptionsAction()
      .then(([rows]) => {
        if (ignore || !rows) return;
        setAtelierLinkOptions(rows);
      })
      .catch(() => {
        /* ignore */
      });
    getPracticalDomainsAction()
      .then(([rows]) => {
        if (ignore || !rows) return;
        setPracticalDomains(
          rows.map((d) => ({ id: d.id, name: d.name, code: d.code })),
        );
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      ignore = true;
    };
  }, [isAtelier]);

  const form = useForm<z.infer<typeof coursSchema>>({
    resolver: zodResolver(coursSchema),
    defaultValues: initialData || {
      nameCours: "",
      codeCours: "",
      description: "",
      primaryDomain: null,
      linkedSecondaryBranchId: null,
      linkedSecondaryCoursId: null,
      linkedTargetPeriodKey: null,
      practicalDomainId: null,
    },
  });

  const linkedCoursId = form.watch("linkedSecondaryCoursId");
  const selectedSecondaryCourse = useMemo(
    () =>
      atelierLinkOptions.courses.find((course) => course.id === linkedCoursId) ??
      null,
    [atelierLinkOptions.courses, linkedCoursId],
  );

  const filteredLinkCourses = useMemo(() => {
    const filterClasse = linkFilterClasseId
      ? atelierLinkOptions.classes.find((c) => c.id === linkFilterClasseId)
      : null;
    if (!filterClasse) return atelierLinkOptions.courses;
    return filterCoursesForSecondaryClass(
      atelierLinkOptions.courses,
      filterClasse,
    );
  }, [
    atelierLinkOptions.classes,
    atelierLinkOptions.courses,
    linkFilterClasseId,
  ]);

  const linkFilterUsesBranchFallback = useMemo(() => {
    if (!linkFilterClasseId) return false;
    const filterClasse = atelierLinkOptions.classes.find(
      (c) => c.id === linkFilterClasseId,
    );
    return Boolean(
      filterClasse &&
        filterClasse.configuredCoursIds.length === 0 &&
        filteredLinkCourses.length > 0,
    );
  }, [
    atelierLinkOptions.classes,
    filteredLinkCourses.length,
    linkFilterClasseId,
  ]);

  useEffect(() => {
    if (!linkedCoursId || !linkFilterClasseId) return;
    const stillVisible = filteredLinkCourses.some(
      (course) => course.id === linkedCoursId,
    );
    if (!stillVisible) {
      form.setValue("linkedSecondaryCoursId", null);
      form.setValue("linkedSecondaryBranchId", null);
      form.setValue("linkedTargetPeriodKey", null);
    }
  }, [filteredLinkCourses, form, linkFilterClasseId, linkedCoursId]);

  async function onSubmit(data: z.infer<typeof coursSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const linkedCourse = isAtelier
        ? atelierLinkOptions.courses.find(
            (course) => course.id === data.linkedSecondaryCoursId,
          )
        : null;

      const payload = {
        ...data,
        primaryDomain: showDomain ? (data.primaryDomain ?? null) : undefined,
        linkedSecondaryBranchId: isAtelier
          ? (linkedCourse?.branchId ?? data.linkedSecondaryBranchId ?? null)
          : undefined,
        linkedSecondaryCoursId: isAtelier
          ? data.linkedSecondaryCoursId ?? null
          : undefined,
        linkedTargetPeriodKey: isAtelier
          ? data.linkedSecondaryCoursId
            ? ATELIER_LINK_PERIOD_AUTO
            : null
          : undefined,
        practicalDomainId: isAtelier
          ? data.practicalDomainId ?? null
          : undefined,
      };

      if (mode === "create") {
        const [, err] = await createCoursAction(payload);
        if (err) {
          throw new Error(err.message);
        }
        toast.success(t("created"));
      } else {
        const [, err] = await updateCoursAction(payload);
        if (err) {
          throw new Error(err.message);
        }
        toast.success(t("updated"));
      }

      if (mode === "create") {
        form.reset({
          nameCours: "",
          codeCours: "",
          description: "",
          primaryDomain: null,
          linkedSecondaryBranchId: null,
          linkedSecondaryCoursId: null,
          linkedTargetPeriodKey: null,
          practicalDomainId: null,
        });
        onCreated?.();
      } else {
        onUpdated?.();
      }
      onSuccess?.();
    } catch (error: any) {
      console.log(error);
      setErrorMessage(error.message ?? "");
      toast.error(
        mode === "create"
          ? error.message || t("createFailed")
          : error.message || t("updateFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }

  const fieldClass = isDialog ? "space-y-0.5" : "space-y-1";
  const labelClass = isDialog
    ? "text-xs font-medium text-muted-foreground"
    : undefined;
  const controlClass = isDialog
    ? "h-9 rounded-md px-3 text-sm font-normal"
    : undefined;

  const domainField = showDomain ? (
    <FormField
      control={form.control}
      name="primaryDomain"
      render={({ field }) => (
        <FormItem className={fieldClass}>
          <FormLabel className={labelClass}>{t("domain")}</FormLabel>
          <Select
            value={field.value ?? "NONE"}
            onValueChange={(value) =>
              field.onChange(value === "NONE" ? null : value)
            }
            disabled={isLoading}
          >
            <FormControl>
              <SelectTrigger className={controlClass}>
                <SelectValue placeholder={t("domainPlaceholder")} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="NONE">{t("unclassified")}</SelectItem>
              {domains.map((domain) => (
                <SelectItem key={domain.code} value={domain.code}>
                  {domain.shortLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isDialog ? (
            <FormDescription>{t("domainDesc")}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  ) : null;

  const atelierLinkFields = isAtelier ? (
    <>
      <FormField
        control={form.control}
        name="practicalDomainId"
        render={({ field }) => (
          <FormItem className={cn(fieldClass, isDialog && "sm:col-span-2")}>
            <FormLabel className={labelClass}>Domaine pratique (TP)</FormLabel>
            <Select
              value={field.value ?? "NONE"}
              onValueChange={(value) =>
                field.onChange(value === "NONE" ? null : value)
              }
              disabled={isLoading}
            >
              <FormControl>
                <SelectTrigger className={controlClass}>
                  <SelectValue placeholder="Aucun TP atelier" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="NONE">Aucun TP atelier</SelectItem>
                {practicalDomains.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id}>
                    {domain.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isDialog ? (
              <FormDescription>
                Si renseigné, le cours entre dans les rotations labo de ce
                domaine.
              </FormDescription>
            ) : null}
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="linkedSecondaryCoursId"
        render={({ field }) => (
          <FormItem className={cn(fieldClass, isDialog && "sm:col-span-2")}>
            <FormLabel className={labelClass}>{t("linkFilterClass")}</FormLabel>
            <FormControl>
              <SearchableSelect
                searchable
                disabled={isLoading}
                value={linkFilterClasseId || "__ALL__"}
                onValueChange={(value) => {
                  setLinkFilterClasseId(value === "__ALL__" ? "" : value);
                }}
                options={[
                  {
                    value: "__ALL__",
                    label: t("linkFilterClassAll"),
                    search: t("linkFilterClassAll"),
                  },
                  ...atelierLinkOptions.classes.map((classe) => ({
                    value: classe.id,
                    label: classe.label,
                    search: classe.label,
                  })),
                ]}
                placeholder={t("linkFilterClassPlaceholder")}
                searchPlaceholder={t("linkFilterClassSearch")}
                emptyMessage={t("linkFilterClassEmpty")}
                triggerClassName={controlClass}
              />
            </FormControl>
            <FormDescription>{t("linkFilterClassDesc")}</FormDescription>

            <FormLabel className={cn(labelClass, "mt-3 block")}>
              {t("linkCourse")}
            </FormLabel>
            <FormControl>
              <SearchableSelect
                searchable
                disabled={isLoading}
                value={field.value ?? "__NONE__"}
                onValueChange={(value) => {
                  if (value === "__NONE__") {
                    field.onChange(null);
                    form.setValue("linkedSecondaryBranchId", null);
                    form.setValue("linkedTargetPeriodKey", null);
                    return;
                  }
                  const course = atelierLinkOptions.courses.find(
                    (item) => item.id === value,
                  );
                  field.onChange(value);
                  form.setValue(
                    "linkedSecondaryBranchId",
                    course?.branchId ?? null,
                  );
                  form.setValue("linkedTargetPeriodKey", null);
                }}
                options={[
                  {
                    value: "__NONE__",
                    label: t("linkNone"),
                    search: t("linkNone"),
                  },
                  ...filteredLinkCourses.map((course) => ({
                    value: course.id,
                    label:
                      course.label ??
                      `${course.nameCours} · ${course.branchName}`,
                    search: `${course.nameCours} ${course.codeCours} ${course.branchName}`,
                  })),
                ]}
                placeholder={t("linkCoursePlaceholder")}
                searchPlaceholder={t("linkCourseSearch")}
                emptyMessage={t("linkCourseEmpty")}
                triggerClassName={controlClass}
              />
            </FormControl>
            <FormDescription>{t("linkDesc")}</FormDescription>
            {atelierLinkOptions.courses.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                {t("linkNoSecondaryCourses")}
              </p>
            ) : linkFilterClasseId && filteredLinkCourses.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                {t("linkNoCoursesForClass")}
              </p>
            ) : linkFilterUsesBranchFallback ? (
              <p className="text-xs text-muted-foreground">
                {t("linkClassBranchFallback")}
              </p>
            ) : null}
            <FormMessage />
          </FormItem>
        )}
      />

      {selectedSecondaryCourse ? (
        <div
          className={cn(
            fieldClass,
            isDialog && "sm:col-span-2",
            "rounded-md border px-3 py-2 text-sm",
          )}
        >
          <p className="font-medium">{t("linkPeriod")}</p>
          <p className="text-muted-foreground">{t("linkPeriodDesc")}</p>
        </div>
      ) : null}
    </>
  ) : null;

  return (
    <div
      className={cn(isDialog ? "grid gap-2" : "grid gap-6", className)}
      {...props}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div
            className={cn(
              "grid",
              isDialog ? "gap-x-4 gap-y-2 sm:grid-cols-2" : "gap-5",
            )}
          >
            <FormField
              control={form.control}
              name="nameCours"
              render={({ field }) => (
                <FormItem
                  className={cn(
                    fieldClass,
                    isDialog && !showDomain && "sm:col-span-2",
                  )}
                >
                  <FormLabel className={labelClass}>{t("name")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        isAtelier
                          ? t("namePlaceholderAtelier")
                          : t("namePlaceholder")
                      }
                      autoFocus
                      className={controlClass}
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isDialog ? domainField : null}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem
                  className={cn(fieldClass, isDialog && "sm:col-span-2")}
                >
                  <FormLabel className={labelClass}>{t("description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("descriptionPlaceholder")}
                      className={cn(
                        "resize-none",
                        isDialog ? "min-h-24" : "min-h-28",
                      )}
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isDialog ? domainField : null}
            {atelierLinkFields}

            {mode === "create" ? (
              <p
                className={cn(
                  "rounded-md border bg-muted/30 text-xs text-muted-foreground",
                  isDialog ? "p-2.5 sm:col-span-2" : "p-3",
                )}
              >
                {tc("codeAutoGenerated")}
              </p>
            ) : null}

            <div className={cn(isDialog && "sm:col-span-2")}>
              <Button
                type="submit"
                size={isDialog ? "default" : undefined}
                className={cn(
                  "mt-2 w-full font-medium",
                  isDialog && "h-11 text-base",
                )}
                loading={isLoading}
              >
                {mode === "create" ? t("createSubmit") : t("updateSubmit")}
              </Button>
            </div>

            {errorMessage ? (
              <p
                className={cn(
                  "mt-2 text-center text-red-500",
                  isDialog && "sm:col-span-2 text-xs",
                )}
              >
                {errorMessage}
              </p>
            ) : null}
          </div>
        </form>
      </Form>
    </div>
  );
}
