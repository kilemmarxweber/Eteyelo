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

import {
  createClassEnrollmentAction,
  updateClassEnrollmentAction,
} from "../../classEnrollment.action";
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
import { classEnrollmentSchema } from "@/src/interfaces/classEnrollment";
import { IStudent } from "@/src/interfaces/Student";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { getStudentsAction } from "../../../student/student.action";
import { getSchoolYearsAction } from "../../../schoolYear/schoolYear.action";
import { useSession } from "@/lib/auth-client";

interface EnrollmentUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onEnrollmentAction?: () => void;
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof classEnrollmentSchema>;
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
  const [Students, setStudents] = useState<IStudent[]>([]);
  const [SchoolYears, setSchoolYears] = useState<ISchoolYear[]>([]);
  const { data: session } = useSession();
  const branchId = session?.branch?.id ?? session?.session?.activeBranchId;
  const form = useForm<z.infer<typeof classEnrollmentSchema>>({
    resolver: zodResolver(classEnrollmentSchema),
    defaultValues: initialData || {
      schoolYearId: "",
      studentId: "",
      classeId: classeId, // 🔥 IMPORTANT
    },
  });

  useEffect(() => {
    form.reset(
      initialData || {
        schoolYearId: "",
        studentId: "",
        classeId: classeId ?? "",
      },
    );
  }, [classeId, form, initialData]);

  //FETCH STUDENT
  useEffect(() => {
    const fecthStudents = async () => {
      const [rawStudents, err] = await getStudentsAction();
      if (err) {
        throw err.message;
      }
      setStudents(rawStudents);
    };
    fecthStudents();
  }, [branchId]);

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
  }, [branchId]);
  async function onSubmit(data: z.infer<typeof classEnrollmentSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        if (!classeId) {
          throw new Error("ClasseId manquant");
        }
        const [classEnrollment, err] = await createClassEnrollmentAction({
          ...data,
          classeId,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Classe créée avec succès");
        form.reset({
          schoolYearId: "",
          studentId: "",
          classeId,
        });
        onCreated?.();
      } else {
        const [classEnrollment, err] = await updateClassEnrollmentAction({
          ...data,
        }); // Action de mise à jour
        if (err) {
          throw new Error(err.message);
        }
        toast.success("Classe mis à jour avec succès");
      }

      if (mode === "update") {
        onUpdated?.();
      }
      onSuccess?.();
      onEnrollmentAction?.();
    } catch (error: any) {
      console.log(error);
      setErrorMessage(error.message ?? "");
      toast.error(
        mode === "create"
          ? "Échec de la création de la classEnrollment"
          : "Échec de la mise à jour de la classEnrollment",
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
              name="studentId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Le code de l'student</FormLabel>
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
                            ? Students.find(
                                (student) => student.id === field.value,
                              )?.username
                            : "Entrez le code du student "}
                          <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput placeholder="Search student..." />
                        <CommandList>
                          <CommandEmpty>No student found.</CommandEmpty>
                          <CommandGroup>
                            {Students.map((student) => (
                              <CommandItem
                                value={student.username}
                                key={student?.username}
                                onSelect={() => {
                                  form.setValue("studentId", student.id || "");
                                }}
                              >
                                <IconCheck
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    student.id === field.value
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {student?.username}
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
                ? "Enregistrer la classEnrollment"
                : "Mettre à jour de la classEnrollment"}
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
