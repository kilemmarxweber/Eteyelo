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
import { useTheme } from "next-themes";
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

function getCreateDefaultValues() {
  const academicYear = getAcademicYearForDate();

  return {
    nameYear: academicYear.nameYear,
    startYear: academicYear.startYear,
    endYear: academicYear.endYear,
    isCurrentYear: false,
  };
}

interface SchoolYearUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof schoolYearSchema>;
  mode: "create" | "update";
  branchId: string;
}

export function SchoolYearUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  branchId,
  ...props
}: SchoolYearUpFormProps) {
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

      const [_, err] = result;

      if (err) {
        throw new Error(err.message);
      }

      toast.success(
        mode === "create"
          ? "Année scolaire créée"
          : "Année scolaire mise à jour",
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

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
      });
    }
  }, [initialData, branchId, form]);
  useEffect(() => setMounted(true), []);

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <FormField
              control={form.control}
              name="nameYear"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Nom de la schoolYear</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Le nom de l'année scolaire"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startYear"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Date de debut</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value ? (
                            !field.value ? (
                              "Choisis une date"
                            ) : (
                              new Date(field.value).toLocaleDateString(
                                "fr-FR",
                                {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                },
                              )
                            )
                          ) : (
                            <span>Choisis une date</span>
                          )}
                          <IconCalendar className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        // Fix: Change the type of the `locale` prop from `string` to `Locale`.
                        toYear={new Date().getFullYear() + 1}
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
            <FormField
              control={form.control}
              name="endYear"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Date de fin</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value ? (
                            !field.value ? (
                              "Choisis une date"
                            ) : (
                              new Date(field.value).toLocaleDateString(
                                "fr-FR",
                                {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                },
                              )
                            )
                          ) : (
                            <span>Choisis une date</span>
                          )}
                          <IconCalendar className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        // Fix: Change the type of the `locale` prop from `string` to `Locale`.
                        toYear={new Date().getFullYear() + 1}
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

            <Button className="mt-2" loading={isLoading}>
              {mode === "create"
                ? "Enregistrer la schoolYear"
                : "Mettre à jour de la schoolYear"}
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

function generateSchoolYearname(nom: string, prenom: string): string {
  return `${nom.toUpperCase()}/${prenom.toUpperCase()}`;
}
