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
import { Button } from "@/components/custom/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { IconSelector, IconCheck } from "@tabler/icons-react";

import {
  createTeachingAction,
  updateTeachingAction,
} from "../../teaching.action";
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
import { getTeachersAction } from "../../../teacher/teacher.action";
import { teachingSchema } from "@/src/interfaces/Teaching";
import { ITeacher } from "@/src/interfaces/Teacher";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { getSchoolYearsAction } from "../../../schoolYear/schoolYear.action";
import { ICours } from "@/src/interfaces/Cours";
import { getCoursAction } from "../../../cours/cours.action";
import { useSession } from "@/lib/auth-client";
import { getClassesByIdAction } from "../../../classe/classe.action";
import { resolveCycle, type Cycle } from "@/lib/cycle";
import { CRENEAU_WEEKDAY_OPTIONS } from "@/lib/creneau-working-days";
import { MultiSelect } from "../../../paiement/components/MultiSelect";
import { useTranslations } from "next-intl";

interface EnrollmentUpFormProps extends HTMLAttributes<HTMLDivElement> {
  onSuccess?: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  initialData?: z.infer<typeof teachingSchema>;
  classeId: string;
  mode: "create" | "update";
}

export function EnrollmentUpForm({
  className,
  onSuccess,
  onCreated,
  onUpdated,
  initialData,
  mode,
  classeId,
  ...props
}: EnrollmentUpFormProps) {
  const t = useTranslations("teaching.assignments");
  const tf = useTranslations("teaching.assignments.form");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [Teachers, setTeachers] = useState<ITeacher[]>([]);
  const [classCycle, setClassCycle] = useState<Cycle | null>(null);
  const [Cours, setCours] = useState<ICours[]>([]);
  const [SchoolYears, setSchoolYears] = useState<ISchoolYear[]>([]);
  const { data: session } = useSession();
  const branchId = session?.branch?.id ?? session?.session?.activeBranchId;
  const branchType = session?.branch?.typebranch;
  const currentSchoolYearId =
    SchoolYears.find((schoolYear) => schoolYear.isCurrentYear)?.id ?? "";

  const teachersForCycle = useMemo(() => {
    if (!classCycle) return Teachers;
    const matching: typeof Teachers = [];
    const others: typeof Teachers = [];
    for (const teacher of Teachers) {
      const cycles = (teacher.cycles ?? []) as Cycle[];
      if (cycles.length === 0 || cycles.includes(classCycle)) {
        matching.push(teacher);
      } else {
        others.push(teacher);
      }
    }
    return [...matching, ...others];
  }, [Teachers, classCycle]);

  const form = useForm<z.infer<typeof teachingSchema>>({
    resolver: zodResolver(teachingSchema),
    defaultValues: {
      schoolYearId: initialData?.schoolYearId ?? currentSchoolYearId,
      teacherId: initialData?.teacherId ?? "",
      coursId: initialData?.coursId ?? "",
      classeId: initialData?.classeId ?? classeId ?? "",
      weeklyHours: initialData?.weeklyHours ?? undefined,
      consecutiveSlots: initialData?.consecutiveSlots ?? null,
      preferredDays: initialData?.preferredDays ?? [],
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
      const currentYear = rawSchoolYears.find(
        (schoolYear) => schoolYear.isCurrentYear,
      );
      if (mode === "create" && currentYear && !form.getValues("schoolYearId")) {
        form.setValue("schoolYearId", currentYear.id);
      }
    };
    fecthSchoolYears();
    const fecthCours = async () => {
      const [rawCours, err] = await getCoursAction(
        classeId ? { classeId } : {},
      );
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
    const fetchClasseCycle = async () => {
      const [classes, err] = await getClassesByIdAction({ id: classeId });
      if (err || !classes?.[0]) return;
      setClassCycle(
        resolveCycle(classes[0], { typebranch: branchType }),
      );
    };
    fetchClasseCycle();
  }, [branchId, branchType, classeId]);
  async function onSubmit(data: z.infer<typeof teachingSchema>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (mode === "create") {
        const [teaching, err] = await createTeachingAction({
          ...data,
          classeId: classeId,
        });
        if (err) {
          throw new Error(err.message);
        }
        toast.success(t("assignmentSaved"));
        form.reset({
          schoolYearId: currentSchoolYearId,
          teacherId: "",
          coursId: "",
          classeId,
          weeklyHours: undefined,
          consecutiveSlots: null,
          preferredDays: [],
        });
        onCreated?.();
      } else {
        const [teaching, err] = await updateTeachingAction({
          ...data,
        }); // Action de mise à jour
        if (err) {
          throw new Error(err.message);
        }
        toast.success(t("assignmentUpdated"));
      }

      if (mode === "update") {
        onUpdated?.();
      }
      onSuccess?.();
    } catch (error: any) {
      console.log(error);
      setErrorMessage(error.message ?? "");
      toast.error(
        mode === "create" ? t("assignFailed") : t("assignmentUpdateFailed"),
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
                  <FormLabel>{t("teacherColumn")}</FormLabel>
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
                            ? teachersForCycle.find(
                                (teacher) => teacher.id === field.value,
                              )?.username
                            : tf("selectTeacher")}
                          <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput placeholder={t("searchTeacher")} />
                        <CommandList>
                          <CommandEmpty>{t("noTeacherFound")}</CommandEmpty>
                          <CommandGroup>
                            {teachersForCycle.map((teacher) => (
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
                  <FormLabel>{t("courseColumn")}</FormLabel>
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
                            : tf("selectCourse")}
                          <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput placeholder={t("searchCourse")} />
                        <CommandList>
                          <CommandEmpty>{tf("noCourseFound")}</CommandEmpty>
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
              name="weeklyHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("minutesPerWeekField")} *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={15}
                      max={600}
                      step={15}
                      placeholder="Ex. 135"
                      value={field.value ?? ""}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === ""
                            ? undefined
                            : Number(event.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {tf("weeklyHoursHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="consecutiveSlots"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("consecutiveTitle")}</FormLabel>
                  <Select
                    value={String(field.value ?? 1)}
                    onValueChange={(value) =>
                      field.onChange(value === "1" ? null : Number(value))
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("consecutive1")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">{t("consecutive1")}</SelectItem>
                      <SelectItem value="2">{t("consecutive2")}</SelectItem>
                      <SelectItem value="3">{t("consecutive3")}</SelectItem>
                      <SelectItem value="4">{t("consecutive4")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {tf("consecutiveAutoHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="preferredDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("preferredDaysLabel")}</FormLabel>
                  <FormControl>
                    <MultiSelect
                      options={CRENEAU_WEEKDAY_OPTIONS.map((day) => ({
                        value: day.value,
                        label: day.label,
                      }))}
                      value={field.value ?? []}
                      onValueChange={field.onChange}
                      placeholder={tf("preferredDaysPlaceholder")}
                      searchable={false}
                      maxCount={3}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {tf("preferredDaysHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="schoolYearId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t("schoolYear")}</FormLabel>
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
                            : tf("selectSchoolYear")}
                          <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput placeholder={t("schoolYear")} />
                        <CommandList>
                          <CommandEmpty>{tf("noSchoolYearFound")}</CommandEmpty>
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
            <Button type="submit" className="mt-2" loading={isLoading}>
              {mode === "create" ? tf("createSubmit") : tf("updateSubmit")}
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
