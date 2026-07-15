"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import {
  IconBooks,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconUserOff,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";
import {
  getTeachingWorkspaceAction,
  removeQuickAssignmentsAction,
  saveQuickAssignmentsAction,
} from "./teaching.action";

type Workspace = NonNullable<
  Awaited<ReturnType<typeof getTeachingWorkspaceAction>>[0]
>;
const PAGE_SIZE = 8;

export default function TeachingWorkspacePage() {
  const [data, setData] = useState<Workspace | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classSearch, setClassSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [bulkTeacherId, setBulkTeacherId] = useState("");
  const [savingCourseId, setSavingCourseId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(
    () =>
      startTransition(async () => {
        const [result, error] = await getTeachingWorkspaceAction();
        if (error || !result) {
          toast.error(error?.message ?? "Chargement impossible");
          return;
        }
        setData(result);
        setSelectedClassId(result.classes[0]?.id ?? "");
      }),
    [],
  );

  const visibleCourseIds = useMemo(
    () => new Set((data?.courses ?? []).map((course) => course.id)),
    [data?.courses],
  );
  const currentTeachings = useMemo(
    () =>
      (data?.teachings ?? []).filter(
        (item) =>
          item.classeId === selectedClassId &&
          item.schoolYearId === data?.schoolYear?.id &&
          item.statusTeaching !== false &&
          visibleCourseIds.has(item.coursId),
      ),
    [data, selectedClassId, visibleCourseIds],
  );
  const assignmentMap = useMemo(
    () => new Map(currentTeachings.map((item) => [item.coursId, item])),
    [currentTeachings],
  );
  const assignedCount = assignmentMap.size;
  const unassignedCount = Math.max(
    0,
    (data?.courses.length ?? 0) - assignedCount,
  );
  const filteredClasses = useMemo(
    () =>
      (data?.classes ?? []).filter((item) =>
        `${item.codeClasse} ${item.nameClasse} ${item.option?.nameOption ?? ""}`
          .toLowerCase()
          .includes(classSearch.toLowerCase()),
      ),
    [classSearch, data],
  );
  const paginatedClasses = filteredClasses.slice(
    page * PAGE_SIZE,
    page * PAGE_SIZE + PAGE_SIZE,
  );
  const rows = useMemo(
    () =>
      (data?.courses ?? []).filter((course) => {
        const assignment = assignmentMap.get(course.id);
        return (
          `${course.codeCours} ${course.nameCours}`
            .toLowerCase()
            .includes(courseSearch.toLowerCase()) &&
          (teacherFilter === "all" || assignment?.teacherId === teacherFilter) &&
          (assignmentFilter === "all" ||
            (assignmentFilter === "assigned" ? !!assignment : !assignment))
        );
      }),
    [assignmentFilter, assignmentMap, courseSearch, data, teacherFilter],
  );
  const selectedAssignedCourses = selectedCourses.filter((id) =>
    assignmentMap.has(id),
  );
  const totalUnassigned = (data?.classes ?? []).reduce((sum, classe) => {
    const assignedCourseIds = new Set(
      data?.teachings
        .filter(
          (item) =>
            item.classeId === classe.id &&
            item.schoolYearId === data.schoolYear?.id &&
            item.statusTeaching !== false &&
            visibleCourseIds.has(item.coursId),
        )
        .map((item) => item.coursId),
    );
    return (
      sum + Math.max(0, (data?.courses.length ?? 0) - assignedCourseIds.size)
    );
  }, 0);

  function applyAssignments(courseIds: string[], teacherId: string) {
    if (!data || !selectedClassId || !teacherId || !courseIds.length) return;
    const previous = data.teachings;
    const tempRows = courseIds.map((coursId) => ({
      id: `temp-${coursId}`,
      classeId: selectedClassId,
      coursId,
      teacherId,
      schoolYearId: data.schoolYear?.id ?? "",
      statusTeaching: true,
      titulaire: false,
      updatedAt: new Date(),
    }));
    setData((current) =>
      current
        ? {
            ...current,
            teachings: [
              ...current.teachings.filter(
                (item) =>
                  !(
                    item.classeId === selectedClassId &&
                    courseIds.includes(item.coursId) &&
                    item.schoolYearId === current.schoolYear?.id
                  ),
              ),
              ...tempRows,
            ],
          }
        : current,
    );
    setSavingCourseId(courseIds.length === 1 ? courseIds[0] : "bulk");
    startTransition(async () => {
      const [saved, error] = await saveQuickAssignmentsAction({
        classeId: selectedClassId,
        coursIds: courseIds,
        teacherId,
      });
      setSavingCourseId(null);
      if (error || !saved) {
        setData((current) =>
          current ? { ...current, teachings: previous } : current,
        );
        toast.error(error?.message ?? "Affectation impossible");
        return;
      }
      setData((current) =>
        current
          ? {
              ...current,
              teachings: [
                ...current.teachings.filter(
                  (item) => !tempRows.some((temp) => temp.id === item.id),
                ),
                ...saved,
              ],
            }
          : current,
      );
      setSelectedCourses([]);
      setBulkTeacherId("");
      toast.success(
        courseIds.length > 1
          ? `${courseIds.length} cours affectés`
          : "Cours affecté",
      );
    });
  }

  function removeAssignments(courseIds: string[]) {
    if (!data || !selectedClassId || !courseIds.length) return;
    const previous = data.teachings;
    setData((current) =>
      current
        ? {
            ...current,
            teachings: current.teachings.map((item) =>
              item.classeId === selectedClassId &&
              courseIds.includes(item.coursId) &&
              item.schoolYearId === current.schoolYear?.id &&
              item.statusTeaching !== false
                ? { ...item, statusTeaching: false }
                : item,
            ),
          }
        : current,
    );
    setSavingCourseId(courseIds.length === 1 ? courseIds[0] : "bulk");
    startTransition(async () => {
      const [result, error] = await removeQuickAssignmentsAction({
        classeId: selectedClassId,
        coursIds: courseIds,
      });
      setSavingCourseId(null);
      if (error || !result) {
        setData((current) =>
          current ? { ...current, teachings: previous } : current,
        );
        toast.error(error?.message ?? "Retrait impossible");
        return;
      }
      setSelectedCourses([]);
      toast.success(
        result.removed > 1
          ? `${result.removed} cours retirés de l'enseignant`
          : "Cours retiré de l'enseignant",
      );
    });
  }

  if (!data)
    return (
      <Layout>
        <LayoutBody>
          <Skeleton className="h-[70vh] w-full" />
        </LayoutBody>
      </Layout>
    );
  const selectedClass = data.classes.find(
    (item) => item.id === selectedClassId,
  );

  return (
    <Layout fadedBelow fixedHeight>
      <LayoutBody className="flex min-h-0 flex-col space-y-5" fixedHeight>
        <PageHeader
          title="Affectation des cours"
          description={`Année scolaire : ${data.schoolYear?.nameYear ?? "non configurée"}`}
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              Enseignement
            </Badge>
          }
          actions={
            <Button
              variant="outline"
              onClick={() => setAssignmentFilter("unassigned")}
            >
              <IconUserOff className="mr-2 size-4" />
              Sans enseignant ({totalUnassigned})
            </Button>
          }
        />
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="flex min-h-0 flex-col overflow-hidden">
            <div className="border-b p-3">
              <h2 className="font-semibold">Classes</h2>
              <div className="relative mt-2">
                <IconSearch className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  value={classSearch}
                  onChange={(e) => {
                    setClassSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Rechercher..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {paginatedClasses.map((classe) => {
                const count = new Set(
                  data.teachings
                    .filter(
                      (item) =>
                        item.classeId === classe.id &&
                        item.schoolYearId === data.schoolYear?.id &&
                        item.statusTeaching !== false &&
                        visibleCourseIds.has(item.coursId),
                    )
                    .map((item) => item.coursId),
                ).size;
                return (
                  <button
                    key={classe.id}
                    onClick={() => {
                      setSelectedClassId(classe.id);
                      setSelectedCourses([]);
                    }}
                    className={`mb-1 w-full rounded-lg border p-3 text-left transition ${selectedClassId === classe.id ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{classe.nameClasse}</span>
                      <Badge
                        variant={
                          count === data.courses.length ? "success" : "warning"
                        }
                      >
                        {count}/{data.courses.length}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {classe.option?.section?.nameSection} ·{" "}
                      {classe.option?.nameOption}
                    </p>
                  </button>
                );
              })}
              {!paginatedClasses.length && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  Aucune classe
                </p>
              )}
            </div>
            <div className="flex items-center justify-between border-t p-2">
              <Button
                size="icon"
                variant="ghost"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                <IconChevronLeft className="size-4" />
              </Button>
              <span className="text-xs">
                Page {page + 1}/
                {Math.max(1, Math.ceil(filteredClasses.length / PAGE_SIZE))}
              </span>
              <Button
                size="icon"
                variant="ghost"
                disabled={(page + 1) * PAGE_SIZE >= filteredClasses.length}
                onClick={() => setPage((value) => value + 1)}
              >
                <IconChevronRight className="size-4" />
              </Button>
            </div>
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden">
            <div className="border-b p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selectedClass?.nameClasse ?? "Sélectionnez une classe"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {assignedCount} cours affecté(s) · {unassignedCount} sans
                    enseignant
                  </p>
                </div>
                {selectedCourses.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <TeacherPicker
                      teachers={data.teachers}
                      value={bulkTeacherId}
                      onChange={setBulkTeacherId}
                      placeholder="Enseignant pour le lot"
                      className="w-56"
                    />
                    <Button
                      disabled={!bulkTeacherId || savingCourseId === "bulk"}
                      onClick={() =>
                        applyAssignments(selectedCourses, bulkTeacherId)
                      }
                    >
                      Affecter ({selectedCourses.length})
                    </Button>
                    {selectedAssignedCourses.length > 0 && (
                      <Button
                        variant="outline"
                        disabled={savingCourseId === "bulk"}
                        onClick={() =>
                          removeAssignments(selectedAssignedCourses)
                        }
                      >
                        <IconX className="mr-2 size-4" />
                        Retirer ({selectedAssignedCourses.length})
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <div className="relative">
                  <IconSearch className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder="Cours..."
                    className="pl-9"
                  />
                </div>
                <TeacherPicker
                  teachers={data.teachers}
                  value={teacherFilter}
                  onChange={setTeacherFilter}
                  placeholder="Tous les enseignants"
                  allowAll
                  className="w-full"
                />
                <Select
                  value={assignmentFilter}
                  onValueChange={setAssignmentFilter}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les cours</SelectItem>
                    <SelectItem value="assigned">Affectés</SelectItem>
                    <SelectItem value="unassigned">Non affectés</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead className="sticky top-0 bg-background text-left shadow-sm">
                  <tr>
                    <th className="p-3">
                      <Checkbox
                        checked={
                          rows.length > 0 &&
                          rows.every((row) => selectedCourses.includes(row.id))
                        }
                        onCheckedChange={(checked) =>
                          setSelectedCourses(
                            checked ? rows.map((row) => row.id) : [],
                          )
                        }
                      />
                    </th>
                    <th className="p-3">Cours</th>
                    <th className="p-3">Enseignant</th>
                    <th className="p-3">État</th>
                    <th className="p-3 w-[1%]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((course) => {
                    const assignment = assignmentMap.get(course.id);
                    const teacher = data.teachers.find(
                      (item) => item.id === assignment?.teacherId,
                    );
                    const isSaving = savingCourseId === course.id;
                    return (
                      <tr key={course.id} className="border-t">
                        <td className="p-3">
                          <Checkbox
                            checked={selectedCourses.includes(course.id)}
                            onCheckedChange={(checked) =>
                              setSelectedCourses((current) =>
                                checked
                                  ? [...new Set([...current, course.id])]
                                  : current.filter((id) => id !== course.id),
                              )
                            }
                          />
                        </td>
                        <td className="p-3">
                          <p className="font-medium">{course.nameCours}</p>
                          <p className="text-xs text-muted-foreground">
                            {course.codeCours}
                          </p>
                        </td>
                        <td className="p-3">
                          <TeacherPicker
                            teachers={data.teachers}
                            value={assignment?.teacherId ?? ""}
                            onChange={(teacherId) => {
                              if (!teacherId) {
                                if (assignment) removeAssignments([course.id]);
                                return;
                              }
                              applyAssignments([course.id], teacherId);
                            }}
                            disabled={isSaving}
                            placeholder="Affecter un enseignant"
                            allowClear={Boolean(assignment)}
                            className="w-64"
                          />
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={assignment ? "success" : "warning"}
                            icon={
                              assignment ? (
                                <IconCheck size={13} />
                              ) : (
                                <IconUserOff size={13} />
                              )
                            }
                          >
                            {assignment
                              ? (teacher?.name ?? "Affecté")
                              : "Non affecté"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {assignment ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={isSaving || pending}
                              onClick={() => removeAssignments([course.id])}
                            >
                              <IconX className="mr-1 size-4" />
                              Retirer
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!rows.length && (
                <div className="p-10 text-center text-muted-foreground">
                  <IconBooks className="mx-auto mb-2 size-8" />
                  Aucun cours correspondant
                </div>
              )}
            </div>
          </Card>
        </div>
      </LayoutBody>
    </Layout>
  );
}

function TeacherPicker({
  teachers,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  allowAll,
  allowClear,
}: {
  teachers: Array<{ id: string; name: string }>;
  value: string;
  onChange: (teacherId: string) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  allowAll?: boolean;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = teachers.find((teacher) => teacher.id === value);
  const displayValue =
    allowAll && value === "all"
      ? "Tous les enseignants"
      : selected?.name;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-between font-normal",
            !selected && !(allowAll && value === "all") && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{displayValue ?? placeholder}</span>
          <IconChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un enseignant..." />
          <CommandList className="max-h-64">
            <CommandEmpty>Aucun enseignant trouvé.</CommandEmpty>
            <CommandGroup
              heading={`${teachers.length} enseignant${teachers.length > 1 ? "s" : ""}`}
            >
              {allowAll && (
                <CommandItem
                  value="tous les enseignants"
                  onSelect={() => {
                    onChange("all");
                    setOpen(false);
                  }}
                >
                  <IconCheck
                    className={cn(
                      "mr-2 size-4",
                      value === "all" ? "opacity-100" : "opacity-0",
                    )}
                  />
                  Tous les enseignants
                </CommandItem>
              )}
              {allowClear && (
                <CommandItem
                  value="retirer affectation"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <IconX className="mr-2 size-4 text-destructive" />
                  <span className="text-destructive">Retirer l&apos;affectation</span>
                </CommandItem>
              )}
              {teachers.map((teacher) => (
                <CommandItem
                  key={teacher.id}
                  value={`${teacher.name} ${teacher.id}`}
                  onSelect={() => {
                    onChange(teacher.id);
                    setOpen(false);
                  }}
                >
                  <IconCheck
                    className={cn(
                      "mr-2 size-4",
                      teacher.id === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{teacher.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
