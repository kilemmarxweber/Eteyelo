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
  createSchoolYearAction,
  updateSchoolYearAction,
} from "../schoolYear.action";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { schoolYearSchema } from "@/src/interfaces/SchoolYear";
import { IconCalendar } from "@tabler/icons-react";
import { getAcademicYearForDate } from "@/lib/academic-year";
import { useSchoolYearLabels } from "@/hooks/use-school-year-labels";

function getCreateDefaultValues() {
  const academicYear = getAcademicYearForDate();

  return {
    nameYear: academicYear.nameYear,
    startYear: academicYear.startYear,
    endYear: academicYear.endYear,
    isCurrentYear: false,
  };
}

function formatDateFr(value: Date | string | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

interface SchoolYearUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof schoolYearSchema>;
  mode: "create" | "update";
  branchId: string;
  layout?: "default" | "dialog";
}

export function SchoolYearUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  branchId,
  layout = "default",
  ...props
}: SchoolYearUpFormProps) {
  const isDialog = layout === "dialog";
  const { label, labelLower } = useSchoolYearLabels();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<z.infer<typeof schoolYearSchema>>({
    resolver: zodResolver(schoolYearSchema) as any,
    defaultValues: getCreateDefaultValues(),
  });

  async function onSubmit(data: z.infer<typeof schoolYearSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      let result;

      if (mode === "create") {
        result = await createSchoolYearAction({
          nameYear: data.nameYear,
          startYear: data.startYear,
          endYear: data.endYear,
          isCurrentYear: data.isCurrentYear,
        });
      } else {
        if (!initialData?.id) {
          throw new Error("ID manquant pour update");
        }

        result = await updateSchoolYearAction({
          id: initialData.id,
          nameYear: data.nameYear,
          startYear: data.startYear,
          endYear: data.endYear,
          isCurrentYear: data.isCurrentYear,
        });
      }

      const [, err] = result;

      if (err) {
        throw new Error(err.message);
      }

      toast.success(
        mode === "create" ? `${label} créée` : `${label} mise à jour`,
      );

      if (mode === "create") {
        form.reset(getCreateDefaultValues());
        onCreated?.();
      } else {
        onUpdated?.();
      }
      onSuccess?.();
    } catch (error: any) {
      setErrorMessage(error.message);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
      });
    }
  }, [initialData, branchId, form]);

  const fieldClass = isDialog ? "space-y-0.5" : "space-y-1";
  const labelClass = isDialog
    ? "text-xs font-medium text-muted-foreground"
    : undefined;
  const dateButtonClass = cn(
    "w-full justify-start pl-3 text-left font-normal",
    isDialog && "h-9",
  );

  function DateField({
    name,
    labelText,
  }: {
    name: "startYear" | "endYear";
    labelText: string;
  }) {
    return (
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem className={fieldClass}>
            <FormLabel className={labelClass}>{labelText}</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      dateButtonClass,
                      !field.value && "text-muted-foreground",
                    )}
                  >
                    {formatDateFr(field.value) ?? (
                      <span>Choisir une date</span>
                    )}
                    <IconCalendar className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  toYear={new Date().getFullYear() + 3}
                  fromYear={new Date().getFullYear() - 10}
                  mode="single"
                  captionLayout="dropdown"
                  selected={field.value}
                  onSelect={field.onChange}
                  disabled={(date: Date) => {
                    const currentYear = new Date().getFullYear();
                    return (
                      date.getFullYear() > currentYear + 3 ||
                      date < new Date("1900-01-01")
                    );
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

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
              isDialog ? "gap-x-4 gap-y-2 sm:grid-cols-2" : "gap-2",
            )}
          >
            <FormField
              control={form.control}
              name="nameYear"
              render={({ field }) => (
                <FormItem
                  className={cn(fieldClass, isDialog && "sm:col-span-2")}
                >
                  <FormLabel className={labelClass}>
                    Nom de l&apos;{labelLower}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={`Ex. 2025-2026`}
                      className={
                        isDialog
                          ? "h-9 rounded-md px-3 text-sm font-normal"
                          : undefined
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DateField name="startYear" labelText="Date de début" />
            <DateField name="endYear" labelText="Date de fin" />

            {mode === "create" && isDialog ? (
              <p className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground sm:col-span-2">
                Les dates sont préremplies selon l&apos;année académique en
                cours. Vous pouvez les ajuster avant d&apos;enregistrer.
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
                {mode === "create"
                  ? `Enregistrer l'${labelLower}`
                  : `Mettre à jour l'${labelLower}`}
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
