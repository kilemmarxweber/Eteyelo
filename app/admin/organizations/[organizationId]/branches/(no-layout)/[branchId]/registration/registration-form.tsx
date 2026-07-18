"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCamera,
  IconCheck,
  IconPhotoPlus,
  IconSchool,
  IconSearch,
  IconUser,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  createRegistrationFlowAction,
  createNextParallelForRegistrationAction,
  createCreneauForRegistrationAction,
  findParentForRegistrationAction,
  findStudentHistoryAction,
  getRegistrationOptionsAction,
  getRegistrationRequestForPrefillAction,
  suggestNextClassAction,
} from "./registration.action";
import { generateSlug } from "@/lib/generated-identifiers";
import { matchesClassForLevel } from "@/lib/class-enrollment/match-class-for-level";
import {
  getClassLevelLabel,
  requiresOptionForClass,
} from "@/lib/class-structure";
import {
  getClassDisplayLabel,
  getClassDisplayLabelPlural,
} from "@/lib/branch-capabilities";
import { getSchoolYearDisplayLabel, getSchoolYearDisplayLabelLower } from "@/lib/university-lmd";
import { getPeopleLabels } from "@/lib/people-labels";
import {
  REGISTRATION_PREFILL_EVENT,
  type PrefillEventDetail,
} from "@/lib/prefill-events";
import { uploadFile } from "@/lib/upload-file";
import {
  defaultCreneauValues,
  type CreneauFormValues,
} from "@/src/interfaces/creneau";

type Person = {
  username: string;
  name: string;
  postnom: string;
  prenom: string;
  email: string;
  telephone: string;
  sexe: "masculin" | "feminin";
  address: string;
  dateOfBirth: string;
};
type StudentForm = Person & {
  category: "NORMAL" | "ORPHAN" | "VIP" | "SPONSORED" | "GROUPE";
  provenanceEcole: string;
  observation: string;
  placeOfBirth: string;
};
type ParentForm = Person & { discountPercentage: number };

const emptyPerson: Person = {
  username: "",
  name: "",
  postnom: "",
  prenom: "",
  email: "",
  telephone: "+243",
  sexe: "masculin",
  address: "",
  dateOfBirth: "",
};
const emptyStudent: StudentForm = {
  ...emptyPerson,
  category: "NORMAL",
  provenanceEcole: "",
  observation: "",
  placeOfBirth: "",
};
const emptyParent: ParentForm = { ...emptyPerson, discountPercentage: 0 };

function userOf(item: any) {
  return item.branchMember?.member?.user;
}

function previewStudentEmail(prenom: string, name: string) {
  return `${generateSlug(`${prenom}.${name}`, "eleve")}@klambocore.com`;
}

function previewParentUsername(prenom: string, name: string) {
  return `parent.${generateSlug(`${prenom}.${name}`, "parent")}`;
}

const emptyCreneau = (): CreneauFormValues => ({ ...defaultCreneauValues });

function requiresOptionForLevel(
  typebranch: string | undefined,
  level: string,
) {
  return requiresOptionForClass(typebranch, level);
}

function isStudentStepReady(
  studentMode: "existing" | "new",
  studentId: string,
  student: StudentForm,
) {
  if (studentMode === "existing") return Boolean(studentId);
  return Boolean(
    student.name &&
    student.postnom &&
    student.prenom &&
    student.dateOfBirth &&
    student.address,
  );
}

function isParentStepReady(
  parentMode: "existing" | "new",
  parentId: string,
  parent: ParentForm,
) {
  if (parentMode === "existing") return Boolean(parentId);
  return Boolean(
    parent.name &&
    parent.postnom &&
    parent.prenom &&
    parent.email &&
    parent.address,
  );
}

function previewStudentCode(
  branchName: string,
  studentName: string,
  sequence: number,
) {
  const initials = branchName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 4);
  const now = new Date();
  const dayMonth = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `${initials || "ETB"}-${dayMonth}${studentName.trim().charAt(0).toUpperCase() || "X"}${sequence}`;
}

export function RegistrationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRequestId = searchParams.get("requestId") ?? "";
  const [requestId, setRequestId] = useState("");
  const [requestReference, setRequestReference] = useState("");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [options, setOptions] = useState<any>({
    schoolYears: [],
    classes: [],
    options: [],
    levels: [],
    creneaux: [],
  });
  const [studentMode, setStudentMode] = useState<"existing" | "new">("new");
  const [studentId, setStudentId] = useState("");
  const [student, setStudent] = useState<StudentForm>(emptyStudent);
  const [parentMode, setParentMode] = useState<"existing" | "new">("new");
  const [parentId, setParentId] = useState("");
  const [parent, setParent] = useState<ParentForm>(emptyParent);
  const [studentQuery, setStudentQuery] = useState("");
  const [parentQuery, setParentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [parentResults, setParentResults] = useState<any[]>([]);
  const [historyOutcome, setHistoryOutcome] = useState<
    "new" | "passed" | "failed" | "returning"
  >("new");
  const [schoolYearId, setSchoolYearId] = useState("");
  const [level, setLevel] = useState("");
  const [optionId, setOptionId] = useState("");
  const [creneauId, setCreneauId] = useState("");
  const [classCapacity, setClassCapacity] = useState("30");
  const [creneauForm, setCreneauForm] =
    useState<CreneauFormValues>(emptyCreneau());
  const [creatingClass, setCreatingClass] = useState(false);
  const [creatingCreneau, setCreatingCreneau] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const photoPreview = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : photoUrl),
    [photoFile, photoUrl],
  );
  const peopleLabels = useMemo(
    () => getPeopleLabels(options.typebranch),
    [options.typebranch],
  );
  const classLabel = useMemo(
    () => getClassDisplayLabel(options.typebranch),
    [options.typebranch],
  );
  const classLabelPlural = useMemo(
    () => getClassDisplayLabelPlural(options.typebranch),
    [options.typebranch],
  );
  const classLabelLower = classLabel.toLowerCase();
  const classLabelPluralLower = classLabelPlural.toLowerCase();
  const schoolYearLabel = useMemo(
    () => getSchoolYearDisplayLabel(options.typebranch),
    [options.typebranch],
  );
  const schoolYearLabelLower = useMemo(
    () => getSchoolYearDisplayLabelLower(options.typebranch),
    [options.typebranch],
  );
  const registrationSteps = useMemo(
    () => [
      { label: peopleLabels.student, icon: IconUser },
      { label: "Parent", icon: IconUsers },
      { label: classLabel, icon: IconSchool },
      { label: "Confirmation", icon: IconCheck },
    ],
    [classLabel, peopleLabels.student],
  );
  const historyLabels = useMemo(
    () => ({
      new: `Nouvel ${peopleLabels.studentLower}`,
      passed: "Réussi — niveau supérieur",
      failed: "Échoué — même niveau",
      returning: "Retour après absence",
    }),
    [peopleLabels.studentLower],
  );
  useEffect(
    () => () => {
      if (photoFile && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    },
    [photoFile, photoPreview],
  );

  useEffect(() => {
    void loadRegistrationOptions(true);
  }, []);

  async function applyPrefillFromRequest(requestId: string) {
    const [request, error] = await getRegistrationRequestForPrefillAction({
      requestId,
    });
    if (error || !request) {
      toast.error(error?.message ?? "Impossible de charger la demande.");
      return;
    }
    const guardian =
      request.guardians.find((item) => item.isPrimary) ?? request.guardians[0];
    setRequestId(request.id);
    setRequestReference(request.reference);
    setStudentMode("new");
    setStudent({
      ...emptyStudent,
      ...request.student,
      dateOfBirth: request.student.dateOfBirth.slice(0, 10),
      email: request.student.email ?? "",
      telephone: request.student.telephone ?? "+243",
      provenanceEcole: request.student.provenanceEcole ?? "",
    });
    if (guardian) {
      setParentMode("new");
      setParent({
        ...emptyParent,
        name: guardian.name,
        postnom: guardian.postnom,
        prenom: guardian.prenom,
        sexe: guardian.sexe,
        telephone: guardian.telephone,
        email: guardian.email ?? "",
        address: guardian.address,
      });
    }
    setLevel(request.requestedLevel);
    setOptionId(request.optionId);
    if (request.schoolYearId) setSchoolYearId(request.schoolYearId);
    setPhotoFile(null);
    setPhotoUrl(request.photoUrl ?? "");
    setStep(0);
    toast.success(`Demande ${request.reference} chargée pour examen.`);
    if (request.guardians.length > 1) {
      toast.info(
        "Le second responsable reste conserve dans la demande pour verification.",
      );
    }
  }

  useEffect(() => {
    if (!requestedRequestId) return;
    void applyPrefillFromRequest(requestedRequestId);
  }, [requestedRequestId]);

  useEffect(() => {
    function onPrefillEvent(event: Event) {
      const detail = (event as CustomEvent<PrefillEventDetail>).detail;
      if (!detail?.id) return;
      void applyPrefillFromRequest(detail.id);
    }
    window.addEventListener(REGISTRATION_PREFILL_EVENT, onPrefillEvent);
    return () => {
      window.removeEventListener(REGISTRATION_PREFILL_EVENT, onPrefillEvent);
    };
  }, []);

  async function loadRegistrationOptions(setDefaultYear = false) {
    const [data, error] = await getRegistrationOptionsAction();
    setLoadingOptions(false);
    if (error) return toast.error(error.message);
    setOptions(data);
    if (setDefaultYear) {
      setSchoolYearId(
        data.schoolYears.find((year: any) => year.isCurrentYear)?.id ??
          data.schoolYears[0]?.id ??
          "",
      );
    }
  }

  const selectedClasses = useMemo(() => {
    const optionName = options.options.find(
      (item: any) => item.id === optionId,
    )?.nameOption;
    return options.classes.filter((classe: any) =>
      matchesClassForLevel(classe, {
        typebranch: options.typebranch,
        level,
        optionId: options.allowsOption ? optionId || null : null,
        optionName,
      }),
    );
  }, [
    level,
    optionId,
    options.classes,
    options.options,
    options.typebranch,
    options.allowsOption,
  ]);
  const generatedStudentCode = useMemo(
    () =>
      previewStudentCode(
        options.branchName ?? "",
        student.name,
        (options.annualStudentCounts?.[schoolYearId] ?? 0) + 1,
      ),
    [
      options.branchName,
      options.annualStudentCounts,
      schoolYearId,
      student.name,
    ],
  );
  const generatedStudentEmail = useMemo(
    () => previewStudentEmail(student.prenom, student.name),
    [student.prenom, student.name],
  );
  const generatedParentUsername = useMemo(
    () => previewParentUsername(parent.prenom, parent.name),
    [parent.prenom, parent.name],
  );
  const classStats = useMemo(
    () =>
      selectedClasses.map((classe: any) => {
        const occupied = classe.classEnrollment.filter(
          (item: any) => item.schoolYearId === schoolYearId,
        ).length;
        const hasCapacity =
          classe.capacity !== null &&
          classe.capacity !== undefined &&
          classe.capacity > 0;
        const full = hasCapacity && occupied >= classe.capacity;
        const available = hasCapacity && !full;
        return { ...classe, occupied, hasCapacity, full, available };
      }),
    [selectedClasses, schoolYearId],
  );
  const predictedClass = useMemo(
    () =>
      [...classStats]
        .sort((left, right) =>
          (left.parallel ?? "").localeCompare(right.parallel ?? "", "fr", {
            numeric: true,
            sensitivity: "base",
          }),
        )
        .find((classe) => classe.available) ?? null,
    [classStats],
  );
  const classesNeedingCapacity = useMemo(
    () => classStats.some((classe: { hasCapacity: boolean }) => !classe.hasCapacity),
    [classStats],
  );
  const allClassesFull = useMemo(
    () =>
      classStats.length > 0 &&
      classStats.every(
        (classe: { full: boolean; hasCapacity: boolean }) =>
          classe.hasCapacity && classe.full,
      ),
    [classStats],
  );
  const needsClassAction = Boolean(level) && !predictedClass;
  const selectedStudent = useMemo(
    () => studentResults.find((item) => item.id === studentId),
    [studentResults, studentId],
  );
  const selectedParent = useMemo(
    () => parentResults.find((item) => item.id === parentId),
    [parentResults, parentId],
  );
  const hasCreneaux = (options.creneaux?.length ?? 0) > 0;

  useEffect(() => {
    if (!needsClassAction) return;
    const fromExisting = classStats.find(
      (classe: { capacity: number | null }) =>
        classe.capacity != null && classe.capacity > 0,
    )?.capacity;
    if (fromExisting) setClassCapacity(String(fromExisting));
  }, [needsClassAction, classStats]);

  function resetForm() {
    setStep(0);
    setStudentMode("new");
    setStudentId("");
    setStudent(emptyStudent);
    setParentMode("new");
    setParentId("");
    setParent(emptyParent);
    setPhotoFile(null);
    setPhotoUrl("");
    setCameraOpen(false);
    setStudentQuery("");
    setParentQuery("");
    setStudentResults([]);
    setParentResults([]);
    setHistoryOutcome("new");
    setLevel("");
    setOptionId("");
    setCreneauId("");
    setClassCapacity("30");
    setCreneauForm(emptyCreneau());
    setRequestId("");
    setRequestReference("");
  }

  async function searchStudents() {
    const [data, error] = await findStudentHistoryAction({
      query: studentQuery,
    });
    if (error) toast.error(error.message);
    else setStudentResults(data);
  }
  async function searchParents() {
    const [data, error] = await findParentForRegistrationAction({
      query: parentQuery,
    });
    if (error) toast.error(error.message);
    else setParentResults(data);
  }
  function chooseStudent(item: any) {
    setStudentId(item.id);
    const last = item.classEnrollment?.[0];
    if (last?.classe?.level) {
      setLevel(last.classe.level);
      setOptionId(last.classe.optionId ?? "");
    }
  }
  async function applyHistory(outcome: "passed" | "failed" | "returning") {
    setHistoryOutcome(outcome);
    if (!studentId || outcome === "returning") return;
    const [suggestion, error] = await suggestNextClassAction({
      studentId,
      outcome,
    });
    if (error) toast.error(error.message);
    else {
      setLevel(suggestion.level);
      setOptionId(suggestion.optionId ?? "");
      toast.success(suggestion.reason);
    }
  }
  function updatePerson<T>(
    current: T,
    setter: (value: T) => void,
    key: string,
    value: unknown,
  ) {
    setter({ ...current, [key]: value });
  }
  function goNext() {
    if (step === 0 && studentMode === "existing" && !studentId)
      return toast.error(`Sélectionnez un ${peopleLabels.studentLower}.`);
    if (
      step === 0 &&
      studentMode === "new" &&
      !isStudentStepReady(studentMode, studentId, student)
    )
      return toast.error(
        `Complétez toutes les informations obligatoires de l'${peopleLabels.studentLower}.`,
      );
    if (step === 1 && parentMode === "existing" && !parentId)
      return toast.error("Sélectionnez un parent.");
    if (
      step === 1 &&
      parentMode === "new" &&
      !isParentStepReady(parentMode, parentId, parent)
    )
      return toast.error(
        "Complétez toutes les informations obligatoires du parent.",
      );
    if (step === 2) {
      if (!schoolYearId || !level)
        return toast.error(
          `Choisissez l'${schoolYearLabelLower} et l'${classLabelLower} demandé(e).`,
        );
      if (requiresOptionForLevel(options.typebranch, level) && !optionId) {
        return toast.error("Choisissez une option pour ce niveau.");
      }
      if (selectedClasses.length === 0)
        return toast.error(
          `Aucun ${classLabelLower} n'est configuré pour ce niveau. Créez le premier ${classLabelLower}.`,
        );
      if (classesNeedingCapacity)
        return toast.error(
          `Définissez la capacité de l'${classLabelLower} avant de continuer.`,
        );
      if (allClassesFull || !predictedClass)
        return toast.error(
          "Toutes les parallèles sont pleines. Créez la prochaine parallèle avant de continuer.",
        );
    }
    setStep((current) => current + 1);
  }
  function goPrevious() {
    setStep((current) => Math.max(0, current - 1));
  }
  function advanceAfterLastOptional(expectedStep: number, ready: boolean) {
    if (!ready || loading || step !== expectedStep) return;
    window.setTimeout(() => {
      setStep((current) => (current === expectedStep ? current + 1 : current));
    }, 0);
  }
  async function submit() {
    setLoading(true);
    let resolvedPhotoUrl = photoUrl;
    if (studentMode === "new" && photoFile) {
      const uploaded = await uploadFile(photoFile);
      if (!uploaded.ok) {
        setLoading(false);
        return toast.error(uploaded.message);
      }
      resolvedPhotoUrl = uploaded.url;
      setPhotoUrl(uploaded.url);
      setPhotoFile(null);
    }
    const [result, error] = await createRegistrationFlowAction({
      requestId: requestId || undefined,
      schoolYearId,
      level,
      optionId: options.allowsOption ? optionId || undefined : undefined,
      studentMode,
      studentId: studentId || undefined,
      student:
        studentMode === "new"
          ? {
              ...student,
              username: generatedStudentCode,
              email: generatedStudentEmail,
              dateOfBirth: new Date(student.dateOfBirth),
            }
          : undefined,
      parentMode,
      parentId: parentId || undefined,
      parent:
        parentMode === "new"
          ? {
              ...parent,
              username: generatedParentUsername,
              dateOfBirth: parent.dateOfBirth
                ? new Date(parent.dateOfBirth)
                : undefined,
            }
          : undefined,
      historyOutcome,
      photoUrl: studentMode === "new" ? resolvedPhotoUrl || undefined : undefined,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(`Inscription confirmée dans ${result.classeName}`);
    router.refresh();
    if (requestId) router.replace(window.location.pathname);
    resetForm();
    void loadRegistrationOptions(true);
  }

  function clearStudentPhoto() {
    setPhotoFile(null);
    setPhotoUrl("");
  }

  function applyStudentPhoto(file: File | null) {
    if (!file) {
      clearStudentPhoto();
      return;
    }
    setPhotoFile(file);
    setPhotoUrl("");
  }

  async function createCreneau() {
    if (
      !creneauForm.nameCreneau ||
      !creneauForm.startTime ||
      !creneauForm.endTime ||
      !creneauForm.recreationHour
    ) {
      return toast.error("Complétez toutes les informations de la vacation.");
    }
    setCreatingCreneau(true);
    const [creneau, error] =
      await createCreneauForRegistrationAction(creneauForm);
    setCreatingCreneau(false);
    if (error) return toast.error(error.message);
    toast.success(`Vacation ${creneau.nameCreneau} créée.`);
    setCreneauId(creneau.id);
    setCreneauForm(emptyCreneau());
    await loadRegistrationOptions();
  }

  async function createNextParallel() {
    if (!level || !schoolYearId)
      return toast.error(
        `Choisissez d'abord l'${schoolYearLabelLower} et l'${classLabelLower} demandé(e).`,
      );
    if (requiresOptionForLevel(options.typebranch, level) && !optionId) {
      return toast.error("Choisissez une option pour ce niveau.");
    }
    if (!creneauId)
      return toast.error(
        `Sélectionnez une vacation pour créer l'${classLabelLower}.`,
      );
    const capacity = Number(classCapacity);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      return toast.error(
        `Indiquez une capacité valide pour l'${classLabelLower}.`,
      );
    }
    setCreatingClass(true);
    const [classe, error] = await createNextParallelForRegistrationAction({
      schoolYearId,
      level,
      optionId: options.allowsOption ? optionId || undefined : undefined,
      creneauId,
      capacity,
    });
    setCreatingClass(false);
    if (error) return toast.error(error.message);
    const parallelLabel = classe.parallel
      ? ` (parallèle ${classe.parallel})`
      : "";
    toast.success(
      `${classe.nameClasse}${parallelLabel} — capacité ${classe.capacity} ${peopleLabels.studentPluralLower}.`,
    );
    await loadRegistrationOptions();
  }

  function renderClassCreationPanel(
    title: string,
    description: string,
    buttonLabel: string,
  ) {
    return (
      <div className="mt-4 space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm">{description}</p>
        </div>
        {!hasCreneaux ? (
          <div className="space-y-4 rounded-lg border bg-background p-4 text-foreground">
            <p className="font-medium">
              Aucune vacation disponible — créez-en une
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nom de la vacation *">
                <Input
                  value={creneauForm.nameCreneau}
                  onChange={(event) =>
                    setCreneauForm((current) => ({
                      ...current,
                      nameCreneau: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Début *">
                <Input
                  type="time"
                  value={creneauForm.startTime}
                  onChange={(event) =>
                    setCreneauForm((current) => ({
                      ...current,
                      startTime: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Fin *">
                <Input
                  type="time"
                  value={creneauForm.endTime}
                  onChange={(event) =>
                    setCreneauForm((current) => ({
                      ...current,
                      endTime: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Heure de récréation *">
                <Input
                  type="time"
                  value={creneauForm.recreationHour}
                  onChange={(event) =>
                    setCreneauForm((current) => ({
                      ...current,
                      recreationHour: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Durée cours (min)">
                <Input
                  type="number"
                  min={1}
                  value={creneauForm.durationCourse}
                  onChange={(event) =>
                    setCreneauForm((current) => ({
                      ...current,
                      durationCourse:
                        Number(event.target.value) ||
                        defaultCreneauValues.durationCourse,
                    }))
                  }
                />
              </Field>
              <Field label="Durée récréation (min)">
                <Input
                  type="number"
                  min={1}
                  value={creneauForm.recreationDuration}
                  onChange={(event) =>
                    setCreneauForm((current) => ({
                      ...current,
                      recreationDuration:
                        Number(event.target.value) ||
                        defaultCreneauValues.recreationDuration,
                    }))
                  }
                />
              </Field>
            </div>
            <Button disabled={creatingCreneau} onClick={createCreneau}>
              {creatingCreneau ? "Création…" : "Créer la vacation"}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Vacation *">
              <Select
                value={creneauId || "none"}
                onValueChange={(value) =>
                  setCreneauId(value === "none" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une vacation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sélectionner…</SelectItem>
                  {options.creneaux.map((item: any) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nameCreneau}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={`Capacité de l'${classLabelLower} *`}>
              <Input
                type="number"
                min={1}
                value={classCapacity}
                onChange={(event) => setClassCapacity(event.target.value)}
              />
            </Field>
          </div>
        )}
        {hasCreneaux && (
          <Button
            disabled={creatingClass || !creneauId}
            onClick={createNextParallel}
          >
            {creatingClass ? "Création…" : buttonLabel}
          </Button>
        )}
      </div>
    );
  }

  function renderPersonFields(
    value: StudentForm | ParentForm,
    setter: (value: any) => void,
    studentFields = false,
  ) {
    return (
      <div className="space-y-6">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {studentFields ? (
            <Field label="Matricule élève (automatique)">
              <Input
                disabled
                className="bg-muted font-mono text-foreground opacity-100"
                value={generatedStudentCode}
              />
            </Field>
          ) : (
            <Field label="Code d'accès (automatique)">
              <Input
                disabled
                className="bg-muted font-mono text-foreground opacity-100"
                value={generatedParentUsername}
              />
            </Field>
          )}
          <Field label="Nom *">
            <Input
              value={value.name}
              onChange={(event) =>
                updatePerson(value, setter, "name", event.target.value)
              }
            />
          </Field>
          <Field label="Postnom *">
            <Input
              value={value.postnom}
              onChange={(event) =>
                updatePerson(value, setter, "postnom", event.target.value)
              }
            />
          </Field>
          <Field label="Prénom *">
            <Input
              value={value.prenom}
              onChange={(event) =>
                updatePerson(value, setter, "prenom", event.target.value)
              }
            />
          </Field>
          {studentFields ? (
            <>
              <Field label="Date de naissance *">
                <Input
                  type="date"
                  value={value.dateOfBirth}
                  onChange={(event) =>
                    updatePerson(
                      value,
                      setter,
                      "dateOfBirth",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Lieu de naissance (facultatif)">
                <Input
                  value={(value as StudentForm).placeOfBirth}
                  onChange={(event) =>
                    updatePerson(
                      value,
                      setter,
                      "placeOfBirth",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Email élève (automatique)">
                <Input
                  disabled
                  className="bg-muted font-mono text-foreground opacity-100"
                  value={generatedStudentEmail}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Adresse *">
                <Input
                  value={value.address}
                  onChange={(event) =>
                    updatePerson(value, setter, "address", event.target.value)
                  }
                />
              </Field>
              <Field label="Téléphone *">
                <Input
                  value={value.telephone}
                  onChange={(event) =>
                    updatePerson(value, setter, "telephone", event.target.value)
                  }
                />
              </Field>
              <Field label="Email *">
                <Input
                  type="email"
                  value={value.email}
                  onChange={(event) =>
                    updatePerson(value, setter, "email", event.target.value)
                  }
                />
              </Field>
            </>
          )}
          <Field label="Sexe *">
            <Select
              value={value.sexe}
              onValueChange={(next) =>
                updatePerson(value, setter, "sexe", next)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="masculin">Masculin</SelectItem>
                <SelectItem value="feminin">Féminin</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {studentFields ? (
            <Field label="Adresse complète *" className="xl:col-span-1">
              <Input
                value={value.address}
                onChange={(event) =>
                  updatePerson(value, setter, "address", event.target.value)
                }
              />
            </Field>
          ) : null}
        </div>
        {studentFields && (
          <>
            <Separator />
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Catégorie">
                <Select
                  value={(value as StudentForm).category}
                  onValueChange={(next) =>
                    updatePerson(value, setter, "category", next)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["NORMAL", "ORPHAN", "VIP", "SPONSORED", "GROUPE"].map(
                      (item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="École de provenance (facultatif)">
                <Input
                  value={(value as StudentForm).provenanceEcole}
                  onChange={(event) =>
                    updatePerson(
                      value,
                      setter,
                      "provenanceEcole",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Observation (facultatif)" className="md:col-span-2">
                <Textarea
                  value={(value as StudentForm).observation}
                  onChange={(event) =>
                    updatePerson(
                      value,
                      setter,
                      "observation",
                      event.target.value,
                    )
                  }
                  onBlur={() =>
                    advanceAfterLastOptional(
                      0,
                      isStudentStepReady(studentMode, studentId, student),
                    )
                  }
                  rows={4}
                />
              </Field>
              <Field label="Photo élève (facultatif)" className="md:col-span-2">
                <div className="flex flex-wrap items-center gap-3">
                  {photoPreview ? (
                    <Image
                      src={photoPreview}
                      alt="Aperçu photo élève"
                      width={80}
                      height={80}
                      unoptimized
                      className="size-20 rounded-lg border object-cover"
                    />
                  ) : (
                    <div className="flex size-20 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-muted-foreground">
                      <IconPhotoPlus className="h-6 w-6" />
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="inline-flex h-9 cursor-pointer items-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                      <IconPhotoPlus className="mr-2 h-4 w-4" />
                      Parcourir
                      <Input
                        className="hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) =>
                          applyStudentPhoto(event.target.files?.[0] ?? null)
                        }
                      />
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCameraOpen(true)}
                    >
                      <IconCamera className="mr-2 h-4 w-4" />
                      Caméra
                    </Button>
                    {photoPreview ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={clearStudentPhoto}
                      >
                        <IconX className="mr-2 h-4 w-4" />
                        Retirer
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Parcourir un fichier ou capturer directement avec la caméra.
                </p>
              </Field>
            </div>
          </>
        )}
        {!studentFields && (
          <>
            <Separator />
            <Field label="Remise familiale en % (facultatif)">
              <Input
                className="max-w-[20%]"
                type="number"
                min={0}
                max={100}
                value={(value as ParentForm).discountPercentage}
                onChange={(event) =>
                  updatePerson(
                    value,
                    setter,
                    "discountPercentage",
                    Number(event.target.value),
                  )
                }
                onBlur={() =>
                  advanceAfterLastOptional(
                    1,
                    isParentStepReady(parentMode, parentId, parent),
                  )
                }
              />
            </Field>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid min-h-[calc(100vh-12rem)] gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      {requestReference ? (
        <Alert className="xl:col-span-2">
          <IconCheck className="h-4 w-4" />
          <AlertTitle>Demande confirmee : {requestReference}</AlertTitle>
          <AlertDescription>
            Verifiez et completez les donnees avant l'inscription definitive.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card className="h-fit xl:sticky xl:top-4">
        <CardHeader>
          <CardTitle>Progression</CardTitle>
          <CardDescription>
            Un dossier complet en quatre étapes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Progress value={((step + 1) / registrationSteps.length) * 100} />
          {registrationSteps.map(({ label, icon: Icon }, index) => (
            <div
              key={label}
              className={`flex items-center gap-3 rounded-lg border p-3 ${index === step ? "border-primary bg-primary/5" : ""}`}
            >
              <div
                className={`rounded-full p-2 ${index <= step ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                <Icon size={17} />
              </div>
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  Étape {index + 1}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="flex min-h-[650px] flex-col">
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{registrationSteps[step].label}</CardTitle>
              <CardDescription className="mt-1">
                {step === 2
                  ? `Choisissez l'${classLabelLower} demandé(e) ; la parallèle sera attribuée selon les places disponibles.`
                  : "Les champs marqués d'un astérisque sont obligatoires."}
              </CardDescription>
            </div>
            <Badge variant="secondary">
              {step + 1} / {registrationSteps.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-6 p-6 lg:p-8">
          {step === 0 && (
            <>
              <RadioGroup
                className="grid gap-3 sm:grid-cols-2"
                value={studentMode}
                onValueChange={(value) => {
                  setStudentMode(value as any);
                  setHistoryOutcome(value === "new" ? "new" : "returning");
                }}
              >
                <ModeChoice
                  id="student-new"
                  value="new"
                  title={`Nouvel ${peopleLabels.studentLower}`}
                  description="Créer son compte et son dossier scolaire."
                />
                <ModeChoice
                  id="student-existing"
                  value="existing"
                  title={`Ancien ${peopleLabels.studentLower}`}
                  description="Retrouver son historique et le réinscrire."
                />
              </RadioGroup>
              <Separator />
              {studentMode === "new" ? (
                renderPersonFields(student, setStudent, true)
              ) : (
                <SearchPanel
                  query={studentQuery}
                  setQuery={setStudentQuery}
                  onSearch={searchStudents}
                  placeholder={`Nom, email ou téléphone de l'${peopleLabels.studentLower}`}
                >
                  {studentResults.map((item) => {
                    const user = userOf(item);
                    const last = item.classEnrollment?.[0];
                    return (
                      <ResultButton
                        key={item.id}
                        selected={studentId === item.id}
                        onClick={() => chooseStudent(item)}
                        title={`${user?.name ?? ""} ${user?.postnom ?? ""} ${user?.prenom ?? ""}`}
                        subtitle={
                          last
                            ? `Dernière ${classLabelLower} : ${last.classe?.nameClasse} — ${last.schoolYear.nameYear}`
                            : "Aucune inscription précédente"
                        }
                      />
                    );
                  })}
                  {studentId && (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <Label className="mb-3 block">
                        {`Situation de l'${peopleLabels.studentLower}`}
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={
                            historyOutcome === "passed" ? "default" : "outline"
                          }
                          onClick={() => applyHistory("passed")}
                        >
                          Réussi
                        </Button>
                        <Button
                          variant={
                            historyOutcome === "failed" ? "default" : "outline"
                          }
                          onClick={() => applyHistory("failed")}
                        >
                          Échoué
                        </Button>
                        <Button
                          variant={
                            historyOutcome === "returning"
                              ? "default"
                              : "outline"
                          }
                          onClick={() => applyHistory("returning")}
                        >
                          Retour après absence
                        </Button>
                      </div>
                    </div>
                  )}
                </SearchPanel>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <RadioGroup
                className="grid gap-3 sm:grid-cols-2"
                value={parentMode}
                onValueChange={(value) => setParentMode(value as any)}
              >
                <ModeChoice
                  id="parent-new"
                  value="new"
                  title="Nouveau parent / tuteur"
                  description="Créer le compte du responsable."
                />
                <ModeChoice
                  id="parent-existing"
                  value="existing"
                  title="Parent existant"
                  description={`Lier l'${peopleLabels.studentLower} à un responsable connu.`}
                />
              </RadioGroup>
              <Separator />
              {parentMode === "new" ? (
                renderPersonFields(parent, setParent)
              ) : (
                <SearchPanel
                  query={parentQuery}
                  setQuery={setParentQuery}
                  onSearch={searchParents}
                  placeholder="Nom, email ou téléphone du parent"
                >
                  {parentResults.map((item) => {
                    const user = userOf(item);
                    return (
                      <ResultButton
                        key={item.id}
                        selected={parentId === item.id}
                        onClick={() => setParentId(item.id)}
                        title={`${user?.name ?? ""} ${user?.postnom ?? ""} ${user?.prenom ?? ""}`}
                        subtitle={`${user?.telephone ?? "Sans téléphone"} — ${user?.email ?? "Sans email"}`}
                      />
                    );
                  })}
                </SearchPanel>
              )}
            </>
          )}
          {step === 2 && (
            <div className="space-y-6">
              {loadingOptions ? (
                <p className="text-muted-foreground">{`Chargement des ${classLabelPluralLower}…`}</p>
              ) : (
                <>
                  <div
                    className={`grid gap-5 ${options.allowsOption ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
                  >
                    <Field label={`${schoolYearLabel} *`}>
                      <Select
                        value={schoolYearId}
                        onValueChange={setSchoolYearId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir l'année" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.schoolYears.map((year: any) => (
                            <SelectItem key={year.id} value={year.id}>
                              {year.nameYear}
                              {year.isCurrentYear ? " — actuelle" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={`${classLabel} / niveau demandé *`}>
                      <Select
                        value={level}
                        onValueChange={(value) => {
                          setLevel(value);
                          setOptionId("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Choisir l'${classLabelLower}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {options.levels.map((item: string) => (
                            <SelectItem key={item} value={item}>
                              {getClassLevelLabel(options.typebranch, item)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {options.allowsOption ? (
                      <Field
                        label={
                          requiresOptionForLevel(options.typebranch, level)
                            ? "Option *"
                            : "Option"
                        }
                      >
                        <Select
                          value={
                            optionId ||
                            (requiresOptionForLevel(options.typebranch, level)
                              ? undefined
                              : "none")
                          }
                          onValueChange={(value) =>
                            setOptionId(value === "none" ? "" : value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir l'option" />
                          </SelectTrigger>
                          <SelectContent>
                            {!requiresOptionForLevel(
                              options.typebranch,
                              level,
                            ) ? (
                              <SelectItem value="none">Aucune option</SelectItem>
                            ) : null}
                            {options.options.map((item: any) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.nameOption}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    ) : (
                      <>
                        <Field label="Section">
                          <Input
                            disabled
                            className="bg-muted text-foreground opacity-100"
                            value={
                              options.primaryStructure?.section?.nameSection ??
                              "Primaire"
                            }
                          />
                        </Field>
                        <Field label="Option de pondération">
                          <Input
                            disabled
                            className="bg-muted text-foreground opacity-100"
                            value={
                              options.primaryStructure?.option?.nameOption ??
                              "Primaire"
                            }
                          />
                        </Field>
                      </>
                    )}
                  </div>
                  <Alert>
                    <IconSchool className="h-4 w-4" />
                    <AlertTitle>Affectation automatique</AlertTitle>
                    <AlertDescription>
                      {`Le premier ${classLabelLower} est créé sans lettre. Lorsqu'il est plein, il devient A et le nouveau ${classLabelLower} devient B, puis C, etc.`}
                    </AlertDescription>
                  </Alert>
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold">Parallèles existantes</h3>
                      <Badge variant="outline">
                        {selectedClasses.length} {classLabelLower}(s)
                      </Badge>
                    </div>
                    {!level ? (
                      <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                        {`Sélectionnez un ${classLabelLower} pour voir les parallèles.`}
                      </p>
                    ) : requiresOptionForLevel(options.typebranch, level) &&
                      !optionId ? (
                      <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                        {`Choisissez une option pour afficher les ${classLabelPluralLower} et leur capacité.`}
                      </p>
                    ) : (
                      <>
                        {classStats.length > 0 ? (
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {classStats.map((classe: any) => (
                              <div
                                key={classe.id}
                                className="rounded-lg border p-4"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <b>{classe.nameClasse}</b>
                                    {classe.parallel ? (
                                      <p className="text-xs text-muted-foreground">
                                        Parallèle {classe.parallel}
                                      </p>
                                    ) : null}
                                  </div>
                                  <Badge
                                    variant={
                                      classe.available
                                        ? "secondary"
                                        : classe.hasCapacity
                                          ? "destructive"
                                          : "outline"
                                    }
                                  >
                                    {classe.available
                                      ? "Disponible"
                                      : classe.hasCapacity
                                        ? "Pleine"
                                        : "Capacité manquante"}
                                  </Badge>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">
                                  {classe.hasCapacity
                                    ? `${classe.occupied} / ${classe.capacity} places`
                                    : `${classe.occupied} inscription(s) — capacité non définie`}
                                </p>
                                {classe.hasCapacity ? (
                                  <Progress
                                    className="mt-3"
                                    value={Math.min(
                                      100,
                                      (classe.occupied / classe.capacity) * 100,
                                    )}
                                  />
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {needsClassAction
                          ? renderClassCreationPanel(
                              selectedClasses.length === 0
                                ? `Aucun ${classLabelLower} configuré pour ce niveau`
                                : classesNeedingCapacity
                                  ? "Capacité à définir"
                                  : "Toutes les parallèles sont pleines",
                              selectedClasses.length === 0
                                ? `Créez le premier ${classLabelLower} avec une vacation et une capacité.`
                                : classesNeedingCapacity
                                  ? `Les ${classLabelPluralLower} catalogue n'ont pas encore de capacité. Définissez-la pour pouvoir inscrire.`
                                  : `Créez la prochaine parallèle (A → B → C…). Le ${classLabelLower} simple plein devient A.`,
                              selectedClasses.length === 0
                                ? `Créer l'${classLabelLower}`
                                : classesNeedingCapacity
                                  ? "Définir la capacité"
                                  : "Créer la prochaine parallèle",
                            )
                          : null}

                        {predictedClass ? (
                          <Alert className="mt-4">
                            <IconCheck className="h-4 w-4" />
                            <AlertTitle>Affectation prévue</AlertTitle>
                            <AlertDescription>
                              {`L'${peopleLabels.studentLower} sera inscrit dans `}
                              <strong>{predictedClass.nameClasse}</strong> (
                              {predictedClass.occupied + 1} /{" "}
                              {predictedClass.capacity} places).
                            </AlertDescription>
                          </Alert>
                        ) : null}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-6">
              <Alert>
                <IconCheck className="h-4 w-4" />
                <AlertTitle>Dossier prêt à être enregistré</AlertTitle>
                <AlertDescription>
                  Vérifiez les informations importantes avant la création
                  définitive.
                </AlertDescription>
              </Alert>
              <div className="grid gap-4 md:grid-cols-2">
                <Summary
                  title={peopleLabels.student}
                  lines={
                    studentMode === "new"
                      ? [
                          `${student.name} ${student.postnom} ${student.prenom}`,
                          `Matricule : ${generatedStudentCode}`,
                          `Email : ${generatedStudentEmail}`,
                          `Catégorie : ${student.category}`,
                          student.provenanceEcole
                            ? `Provenance : ${student.provenanceEcole}`
                            : "Sans école de provenance",
                          photoPreview ? "Photo : ajoutée" : "Photo : non ajoutée",
                        ]
                      : [
                          `${userOf(selectedStudent)?.name ?? ""} ${userOf(selectedStudent)?.postnom ?? ""} ${userOf(selectedStudent)?.prenom ?? ""}`.trim() ||
                            `${peopleLabels.student} existant`,
                          `Situation : ${historyLabels[historyOutcome]}`,
                          selectedStudent?.classEnrollment?.[0]?.classe
                            ?.nameClasse
                            ? `Dernière ${classLabelLower} : ${selectedStudent.classEnrollment[0].classe.nameClasse}`
                            : "Aucune inscription précédente",
                        ]
                  }
                />
                <Summary
                  title="Parent / tuteur"
                  lines={
                    parentMode === "new"
                      ? [
                          `${parent.name} ${parent.postnom} ${parent.prenom}`,
                          `Code d'accès : ${generatedParentUsername}`,
                          `Téléphone : ${parent.telephone}`,
                          `Email : ${parent.email}`,
                          parent.discountPercentage
                            ? `Remise : ${parent.discountPercentage}%`
                            : "Sans remise",
                        ]
                      : [
                          `${userOf(selectedParent)?.name ?? ""} ${userOf(selectedParent)?.postnom ?? ""} ${userOf(selectedParent)?.prenom ?? ""}`.trim() ||
                            "Parent existant",
                          userOf(selectedParent)?.telephone
                            ? `Téléphone : ${userOf(selectedParent)?.telephone}`
                            : "Sans téléphone",
                          userOf(selectedParent)?.email
                            ? `Email : ${userOf(selectedParent)?.email}`
                            : "Sans email",
                        ]
                  }
                />
                <Summary
                  title="Scolarité"
                  lines={[
                    options.schoolYears.find(
                      (item: any) => item.id === schoolYearId,
                    )?.nameYear ?? "Année non choisie",
                    `Niveau demandé : ${level}`,
                    ...(options.allowsOption
                      ? [
                          options.options.find(
                            (item: any) => item.id === optionId,
                          )?.nameOption
                            ? `Option : ${options.options.find((item: any) => item.id === optionId)?.nameOption}`
                            : "Sans option",
                        ]
                      : []),
                  ]}
                />
                <Summary
                  title="Affectation"
                  lines={[
                    predictedClass
                      ? `Parallèle : ${predictedClass.nameClasse}`
                      : "Aucune place disponible",
                    predictedClass
                      ? `Places : ${predictedClass.occupied + 1} / ${predictedClass.capacity}`
                      : classesNeedingCapacity
                        ? `Définissez d'abord la capacité de l'${classLabelLower}`
                        : "Créez une parallèle avant de confirmer",
                    "Inscription protégée contre les doublons",
                  ]}
                />
              </div>
            </div>
          )}
        </CardContent>
        <div className="flex items-center justify-between border-t p-6">
          <Button
            variant="outline"
            disabled={step === 0 || loading}
            onClick={goPrevious}
          >
            <IconArrowLeft className="mr-2 h-4 w-4" />
            Précédent
          </Button>
          {step < 3 ? (
            <Button onClick={goNext}>
              Continuer
              <IconArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button disabled={loading} onClick={submit}>
              {loading ? "Enregistrement…" : "Confirmer l'inscription"}
            </Button>
          )}
        </div>
      </Card>
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title="Capture photo"
        onCapture={(file) => {
          applyStudentPhoto(file);
        }}
      />
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function ModeChoice({
  id,
  value,
  title,
  description,
}: {
  id: string;
  value: string;
  title: string;
  description: string;
}) {
  return (
    <Label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted/40"
    >
      <RadioGroupItem id={id} value={value} className="mt-1" />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm font-normal text-muted-foreground">
          {description}
        </span>
      </span>
    </Label>
  );
}
function SearchPanel({
  query,
  setQuery,
  onSearch,
  placeholder,
  children,
}: {
  query: string;
  setQuery: (value: string) => void;
  onSearch: () => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch();
          }}
          placeholder={placeholder}
        />
        <Button onClick={onSearch}>
          <IconSearch className="mr-2 h-4 w-4" />
          Rechercher
        </Button>
      </div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}
function ResultButton({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : ""}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {selected && <IconCheck className="text-primary" />}
      </div>
    </button>
  );
}
function Summary({ title, lines }: { title: string; lines: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </CardContent>
    </Card>
  );
}
