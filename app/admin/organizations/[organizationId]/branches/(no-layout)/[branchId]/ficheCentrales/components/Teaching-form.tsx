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
import { Button } from "@/components/custom/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { IconSelector, IconCheck } from "@tabler/icons-react";

import { createTeachingAction, updateTeachingAction } from "../teaching.action";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getTeachersAction } from "../../teacher/teacher.action";
import { teachingSchema } from "@/src/interfaces/Teaching";
import { ITeacher } from "@/src/interfaces/Teacher";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { getSchoolYearsAction } from "../../schoolYear/schoolYear.action";
import { ICours } from "@/src/interfaces/Cours";
import { getCoursAction } from "../../cours/cours.action";
import { useSession } from "@/lib/auth-client";

interface EnrollmentUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onEnrollmentAction?: () => void;
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof teachingSchema>;
  classeId?: string;
  mode: "create" | "update";
}

export function EnrollmentUpForm({
  className,
  onEnrollmentAction,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  classeId,
  ...props
}: EnrollmentUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [Teachers, setTeachers] = useState<ITeacher[]>([]);
  const [Cours, setCours] = useState<ICours[]>([]);
  const [SchoolYears, setSchoolYears] = useState<ISchoolYear[]>([]);
  const { data: session } = useSession();
  const branchId = session?.branch?.id ?? session?.session?.activeBranchId;

  const form = useForm<z.infer<typeof teachingSchema>>({
    resolver: zodResolver(teachingSchema),
    defaultValues: initialData || {
      schoolYearId: "",
      teacherId: "",
      classeId: classeId!,
    },
  });

  //FETCH STUDENT

  //FETCH SCHOOLYEAR
  useEffect(() => {
    const fecthSchoolYears = async () => {
      if (!branchId) return;
      const [rawSchoolYears, err] = await getSchoolYearsAction({ branchId });
      if (err) {
        throw err.message;
      }
      setSchoolYears(rawSchoolYears);
    };
    fecthSchoolYears();
    const fecthCours = async () => {
      const [rawCours, err] = await getCoursAction();
      if (err) {
        throw err.message;
      }
      setCours(rawCours);
    };
    fecthCours();
    const fecthTeachers = async () => {
      const [rawTeachers, err] = await getTeachersAction();
      if (err) {
        throw err.message;
      }
      setTeachers(rawTeachers);
    };
    fecthTeachers();
  }, [branchId]);
  async function onSubmit(data: z.infer<typeof teachingSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const [teaching, err] = await createTeachingAction({
          ...data,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Affectation effectuée avec succès");
      } else {
        const [teaching, err] = await updateTeachingAction({
          ...data,
        }); // Action de mise à jour
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Affectation mis à jour avec succès");
      }

      if (mode === "create") {
        onCreated?.();
      } else {
        onUpdated?.();
      }
      onSuccess?.();
      onEnrollmentAction?.();
    } catch (error: any) {
      console.log(error);
      setErrorMessage(error.message ?? "");
      toast.error(
        mode === "create"
          ? "Cet enseignant est déjà assigné à ce cours dans cette classe pour cette année."
          : "Échec de la mise à jour de l'affectation",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <FormField
              control={form.control}
              name="teacherId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Le code de l'enseignant</FormLabel>
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
                            ? Teachers.find(
                                (teacher) => teacher.id === field.value,
                              )?.username
                            : "Entrez le code du teacher "}
                          <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput placeholder="Search teacher..." />
                        <CommandList>
                          <CommandEmpty>No teacher found.</CommandEmpty>
                          <CommandGroup>
                            {Teachers.map((teacher) => (
                              <CommandItem
                                value={teacher.username}
                                key={teacher?.username}
                                onSelect={() => {
                                  form.setValue("teacherId", teacher.id || "");
                                }}
                              >
                                <IconCheck
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    teacher.id === field.value
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {teacher?.username}
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
            <FormField
              control={form.control}
              name="coursId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Le code du cours</FormLabel>
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
                            ? Cours.find((cours) => cours.id === field.value)
                                ?.nameCours
                            : "Entrez le code du cours "}
                          <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput placeholder="Search cours..." />
                        <CommandList>
                          <CommandEmpty>No cours found.</CommandEmpty>
                          <CommandGroup>
                            {Cours.map((cours) => (
                              <CommandItem
                                value={cours.nameCours}
                                key={cours?.nameCours}
                                onSelect={() => {
                                  form.setValue("coursId", cours.id || "");
                                }}
                              >
                                <IconCheck
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    cours.id === field.value
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {cours?.nameCours}
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
            <FormField
              control={form.control}
              name="schoolYearId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>L'année scolaire</FormLabel>
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
                            ? SchoolYears.find(
                                (schoolYear) => schoolYear.id === field.value,
                              )?.nameYear
                            : "Entrez le code du schoolYear "}
                          <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput placeholder="Search schoolYear..." />
                        <CommandList>
                          <CommandEmpty>No schoolYear found.</CommandEmpty>
                          <CommandGroup>
                            {SchoolYears.map((schoolYear) => (
                              <CommandItem
                                value={schoolYear.nameYear}
                                key={schoolYear.nameYear}
                                onSelect={() => {
                                  form.setValue(
                                    "schoolYearId",
                                    schoolYear.id || "",
                                  );
                                }}
                              >
                                <IconCheck
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    schoolYear.id === field.value
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {schoolYear.nameYear}
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
                ? "Enregistrer la teaching"
                : "Mettre à jour de la teaching"}
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

function generateClassename(nom: string, prenom: string): string {
  return `${nom.toUpperCase()}/${prenom.toUpperCase()}`;
}
