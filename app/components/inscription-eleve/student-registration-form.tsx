"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import {
  Camera,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  ImagePlus,
  Pencil,
  Send,
  Trash2,
  UserPlus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
import { HomeNavbar } from "@/components/home-navbar";
import { RegistrationExtraInfoFields } from "@/components/registration-extra-info-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadFile } from "@/lib/upload-file";
import { generateSlug } from "@/lib/generated-identifiers";
import {
  registerStudentsOnline,
  getPublishedBranchRegistrationInfo,
  getPublicRegistrationAcademicChoices,
} from "./insption.actions";
import type { PublicAcademicChoiceSection } from "./insption.actions";
import { SchoolRegistrationPanel } from "./school-registration-panel";
import {
  formatRegistrationFee,
  type PublicBranchRegistrationInfo,
  type RentreeProgramItem,
} from "@/lib/registration-public-info";
import { LevelSectionOptionFields } from "@/components/level-section-option-fields";
import type { ManagedBranchType } from "@/lib/academic-structure";
import { isPrimaryBranch, requiresOptionForClass, requiresSectionForClass } from "@/lib/class-structure";
import { isCentreFormationBranch, hidesProvenanceEcole } from "@/lib/branch-capabilities";
import { getPeopleLabels } from "@/lib/people-labels";
import {
  getEstablishmentPickerLabel,
  getEstablishmentTypeFilterLabel,
  isPublicRegistrationBranchType,
  PUBLIC_REGISTRATION_BRANCH_TYPES,
  usesBranchAcademicTree,
  getPublicLevelFieldLabels,
} from "@/lib/public-establishment-labels";
import {
  emptyFamilyExtraInfo,
  emptyStudentExtraInfo,
  type FamilyExtraInfo,
  type StudentExtraInfo,
} from "@/lib/registration-extra-info";
import {
  clearPublicRegistrationDraft,
  consumeRegistrationDraftCleared,
  formatDraftSavedAt,
  isMeaningfulPublicDraft,
  markRegistrationDraftCleared,
  readPublicRegistrationDraft,
  REGISTRATION_DRAFT_DEBOUNCE_MS,
  writePublicRegistrationDraft,
  type PublicRegistrationDraftPayload,
} from "@/lib/registration-draft";

const MAX_CHILDREN = 8;

type QueuedStudent = {
  name: string;
  postnom: string;
  prenom: string;
  sexe: "masculin" | "feminin";
  dateOfBirth: string;
  placeOfBirth: string;
  address: string;
  email: string;
  provenanceEcole: string;
  requestedLevel: string;
  requestedSection: string;
  requestedOption: string;
  photo: File | null;
  extra: StudentExtraInfo;
};

type Branch = {
  id: string;
  name: string;
  ville: string | null;
  pays: string | null;
  image: unknown;
  typebranch: ManagedBranchType;
};
type Guardian = {
  name: string;
  postnom: string;
  prenom: string;
  relationshipPreset: string;
  relationshipOther: string;
  sexe: "masculin" | "feminin";
  telephone: string;
  email: string;
  address: string;
  isPrimary: boolean;
};

const STUDENT_EMAIL_DOMAIN = "klambocore.com";
const PRIMARY_MIN_AGE = 5;

const RELATIONSHIP_OPTIONS = [
  { value: "pere", label: "Pere" },
  { value: "mere", label: "Mere" },
  { value: "tuteur", label: "Tuteur" },
  { value: "tutrice", label: "Tutrice" },
  { value: "oncle", label: "Oncle" },
  { value: "tante", label: "Tante" },
  { value: "grand-pere", label: "Grand-pere" },
  { value: "grand-mere", label: "Grand-mere" },
  { value: "frere", label: "Frere" },
  { value: "soeur", label: "Soeur" },
  { value: "autre", label: "Autre" },
] as const;

const emptyGuardian = (isPrimary: boolean): Guardian => ({
  name: "",
  postnom: "",
  prenom: "",
  relationshipPreset: "",
  relationshipOther: "",
  sexe: "masculin",
  telephone: "+243",
  email: "",
  address: "",
  isPrimary,
});

const emptyPublicForm = () => ({
  branchId: "",
  name: "",
  postnom: "",
  prenom: "",
  sexe: "",
  dateOfBirth: "",
  placeOfBirth: "",
  address: "",
  email: "",
  provenanceEcole: "",
  requestedLevel: "",
  requestedSection: "",
  requestedOption: "",
  consentAccepted: false,
});

function resolveRelationship(guardian: Guardian) {
  if (guardian.relationshipPreset === "autre") {
    return guardian.relationshipOther.trim();
  }
  return (
    RELATIONSHIP_OPTIONS.find(
      (option) => option.value === guardian.relationshipPreset,
    )?.label ?? ""
  );
}

function getPlannedRentree(program: RentreeProgramItem[]) {
  if (!program.length) return null;
  const sorted = [...program].sort((a, b) => a.date.localeCompare(b.date));
  const preferred =
    sorted.find((item) =>
      /rentr[eé]e|reprise|ouverture/i.test(`${item.title} ${item.description ?? ""}`),
    ) ?? sorted[0];
  return preferred;
}

function formatRentreeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function previewStudentEmail(prenom: string, name: string) {
  return `${generateSlug(`${prenom}.${name}`, "eleve")}@${STUDENT_EMAIL_DOMAIN}`;
}

function ageFromDate(dateStr: string) {
  const birth = new Date(dateStr);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function maxBirthDateForMinAge(minAge: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - minAge);
  return date.toISOString().slice(0, 10);
}

type RegistrationStepKind = "student" | "guardian" | "level" | "recap";

function resolveRegistrationStepKind(
  step: number,
  skipsGuardian: boolean,
): RegistrationStepKind {
  if (skipsGuardian) {
    if (step === 0) return "student";
    if (step === 1) return "level";
    return "recap";
  }
  if (step === 0) return "student";
  if (step === 1) return "guardian";
  if (step === 2) return "level";
  return "recap";
}

export function StudentRegistrationForm({ branches }: { branches: Branch[] }) {
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [references, setReferences] = useState<string[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [secondGuardian, setSecondGuardian] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [queuedStudents, setQueuedStudents] = useState<QueuedStudent[]>([]);
  const [studentExtra, setStudentExtra] = useState(emptyStudentExtraInfo());
  const [familyExtra, setFamilyExtra] = useState(emptyFamilyExtraInfo());
  const [extraOpen, setExtraOpen] = useState(false);
  const [schoolInfo, setSchoolInfo] =
    useState<PublicBranchRegistrationInfo | null>(null);
  const [schoolInfoLoading, setSchoolInfoLoading] = useState(false);
  const [academicChoices, setAcademicChoices] = useState<{
    sections: PublicAcademicChoiceSection[];
  } | null>(null);
  const [academicChoicesLoading, setAcademicChoicesLoading] = useState(false);
  const [branchTypeFilter, setBranchTypeFilter] = useState<
    ManagedBranchType | ""
  >("");
  const [form, setForm] = useState(emptyPublicForm);
  const [guardians, setGuardians] = useState<Guardian[]>([
    emptyGuardian(true),
    emptyGuardian(false),
  ]);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const draftReadyRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef<PublicRegistrationDraftPayload | null>(null);
  const branchLocked = queuedStudents.length > 0;
  const preview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : ""),
    [photo],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function buildDraftPayload(): PublicRegistrationDraftPayload {
    return {
      step,
      branchTypeFilter,
      secondGuardian,
      form: { ...form },
      guardians: guardians.map((guardian) => ({ ...guardian })),
      studentExtra: { ...studentExtra },
      familyExtra: { ...familyExtra },
      queuedStudents: queuedStudents.map((item) => ({
        ...item,
        photo: null,
        extra: { ...item.extra },
      })),
    };
  }

  function flushDraft() {
    if (!draftReadyRef.current) return;
    const payload = latestDraftRef.current ?? buildDraftPayload();
    if (!isMeaningfulPublicDraft(payload)) {
      clearPublicRegistrationDraft();
      setDraftSavedAt(null);
      return;
    }
    const savedAt = writePublicRegistrationDraft(payload);
    if (savedAt) setDraftSavedAt(savedAt);
  }

  function scheduleDraft() {
    if (!draftReadyRef.current) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      draftTimerRef.current = null;
      flushDraft();
    }, REGISTRATION_DRAFT_DEBOUNCE_MS);
  }

  function resetPublicRegistrationForm() {
    setStep(0);
    setReferences([]);
    setPhoto(null);
    setSecondGuardian(false);
    setCameraOpen(false);
    setQueuedStudents([]);
    setStudentExtra(emptyStudentExtraInfo());
    setFamilyExtra(emptyFamilyExtraInfo());
    setExtraOpen(false);
    setForm(emptyPublicForm());
    setGuardians([emptyGuardian(true), emptyGuardian(false)]);
    setBranchTypeFilter("");
    setDraftSavedAt(null);
    latestDraftRef.current = null;
  }

  function discardDraft() {
    draftReadyRef.current = false;
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    clearPublicRegistrationDraft();
    resetPublicRegistrationForm();
    markRegistrationDraftCleared();
    window.location.reload();
  }

  useEffect(() => {
    if (consumeRegistrationDraftCleared()) {
      toast.message("Brouillon local effacé", {
        description: "Tous les champs ont été réinitialisés.",
      });
    }
    const draft = readPublicRegistrationDraft();
    if (draft?.payload && !isMeaningfulPublicDraft(draft.payload)) {
      clearPublicRegistrationDraft();
    } else if (draft?.payload) {
      const p = draft.payload;
      if (typeof p.step === "number") setStep(Math.max(0, p.step));
      if (typeof p.branchTypeFilter === "string") {
        setBranchTypeFilter(
          (p.branchTypeFilter as ManagedBranchType | "") || "",
        );
      }
      if (typeof p.secondGuardian === "boolean") {
        setSecondGuardian(p.secondGuardian);
      }
      if (p.form && typeof p.form === "object") {
        setForm((current) => ({
          ...current,
          ...(p.form as typeof form),
        }));
      }
      if (Array.isArray(p.guardians) && p.guardians.length > 0) {
        setGuardians(
          p.guardians.map((item, index) => ({
            ...emptyGuardian(index === 0),
            ...(item as Guardian),
          })),
        );
      }
      if (p.studentExtra && typeof p.studentExtra === "object") {
        setStudentExtra({
          ...emptyStudentExtraInfo(),
          ...(p.studentExtra as StudentExtraInfo),
        });
      }
      if (p.familyExtra && typeof p.familyExtra === "object") {
        setFamilyExtra({
          ...emptyFamilyExtraInfo(),
          ...(p.familyExtra as FamilyExtraInfo),
        });
      }
      if (Array.isArray(p.queuedStudents)) {
        setQueuedStudents(
          p.queuedStudents.map((item) => ({
            ...(item as QueuedStudent),
            photo: null,
            extra: {
              ...emptyStudentExtraInfo(),
              ...((item as QueuedStudent).extra ?? {}),
            },
          })),
        );
      }
      setDraftSavedAt(draft.savedAt);
      toast.message("Brouillon local restauré", {
        description: "Saisie récupérée après fermeture ou coupure.",
      });
    }
    draftReadyRef.current = true;
    return () => {
      draftReadyRef.current = false;
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
    // Restauration unique au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    latestDraftRef.current = buildDraftPayload();
    scheduleDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    branchTypeFilter,
    secondGuardian,
    form,
    guardians,
    studentExtra,
    familyExtra,
    queuedStudents,
  ]);

  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") flushDraft();
    }
    function onPageHide() {
      flushDraft();
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!form.branchId) {
      setSchoolInfo(null);
      setAcademicChoices(null);
      return;
    }

    let ignore = false;
    setSchoolInfoLoading(true);
    setAcademicChoicesLoading(true);

    void Promise.all([
      getPublishedBranchRegistrationInfo(form.branchId),
      getPublicRegistrationAcademicChoices(form.branchId),
    ])
      .then(([info, choices]) => {
        if (ignore) return;
        setSchoolInfo(info);
        setAcademicChoices(choices ? { sections: choices.sections } : null);
      })
      .catch(() => {
        if (ignore) return;
        setSchoolInfo(null);
        setAcademicChoices(null);
      })
      .finally(() => {
        if (!ignore) {
          setSchoolInfoLoading(false);
          setAcademicChoicesLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [form.branchId]);

  const availableBranchTypes = useMemo(
    () =>
      PUBLIC_REGISTRATION_BRANCH_TYPES.filter((type) =>
        branches.some((branch) => branch.typebranch === type),
      ),
    [branches],
  );

  const filteredBranches = useMemo(
    () =>
      branchTypeFilter
        ? branches.filter((branch) => branch.typebranch === branchTypeFilter)
        : [],
    [branches, branchTypeFilter],
  );

  const selectedBranch = branches.find((b) => b.id === form.branchId);
  const establishmentLabel = getEstablishmentPickerLabel(
    branchTypeFilter || selectedBranch?.typebranch,
  );
  /** Priorité : branche choisie, sinon filtre type (élève / apprenant / étudiant). */
  const branchType = (selectedBranch?.typebranch ||
    branchTypeFilter ||
    "SECONDAIRE") as ManagedBranchType;
  const peopleLabels = useMemo(
    () => getPeopleLabels(branchType),
    [branchType],
  );
  const isPrimary = isPrimaryBranch(branchType);
  const skipsGuardian = isCentreFormationBranch(branchType);
  const formIntro = useMemo(() => {
    if (!branchTypeFilter && !selectedBranch) {
      return "Choisissez d'abord le type d'établissement, puis remplissez les informations.";
    }
    return skipsGuardian
      ? `Remplissez les informations de ${peopleLabels.studentDefinite}.`
      : `Remplissez les informations de ${peopleLabels.studentDefinite} et du responsable.`;
  }, [
    branchTypeFilter,
    selectedBranch,
    skipsGuardian,
    peopleLabels.studentDefinite,
  ]);
  const hidesProvenance = hidesProvenanceEcole(branchType);
  const usesBranchTree = usesBranchAcademicTree(branchType);
  const branchAcademicTree = academicChoices?.sections.map((section) => ({
    codeSection: section.codeSection,
    nameSection: section.nameSection,
    options: section.options.map((option) => ({
      codeOption: option.codeOption,
      nameOption: option.nameOption,
    })),
  }));
  const totalSteps = skipsGuardian ? 3 : 4;
  const maxStep = totalSteps - 1;
  const stepKind = resolveRegistrationStepKind(step, skipsGuardian);

  useEffect(() => {
    setStep((current) => Math.min(current, maxStep));
  }, [maxStep]);
  const generatedStudentEmail = useMemo(
    () => previewStudentEmail(form.prenom, form.name),
    [form.prenom, form.name],
  );
  const resolvedStudentEmail =
    form.email.trim() || generatedStudentEmail;
  const canAddAnotherStudent = useMemo(() => {
    if (queuedStudents.length + 1 >= MAX_CHILDREN) return false;
    if (
      !branchTypeFilter ||
      !form.branchId ||
      !form.name.trim() ||
      !form.postnom.trim() ||
      !form.prenom.trim() ||
      !form.sexe ||
      !form.dateOfBirth ||
      !form.placeOfBirth.trim() ||
      !form.address.trim()
    ) {
      return false;
    }
    if (isPrimary) {
      const age = ageFromDate(form.dateOfBirth);
      if (age === null || age < PRIMARY_MIN_AGE) return false;
    }
    return true;
  }, [
    queuedStudents.length,
    branchTypeFilter,
    form.branchId,
    form.name,
    form.postnom,
    form.prenom,
    form.sexe,
    form.dateOfBirth,
    form.placeOfBirth,
    form.address,
    isPrimary,
  ]);
  const primaryMaxBirthDate = maxBirthDateForMinAge(PRIMARY_MIN_AGE);

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  function onBranchTypeChange(value: string) {
    if (branchLocked) return;
    if (!isPublicRegistrationBranchType(value)) return;
    setBranchTypeFilter(value);
    setForm((current) => ({
      ...current,
      branchId: "",
      requestedLevel: "",
      requestedSection: "",
      requestedOption: "",
    }));
  }

  function onBranchChange(value: string) {
    if (branchLocked) return;
    setForm((current) => ({
      ...current,
      branchId: value,
      requestedLevel: "",
      requestedSection: "",
      requestedOption: "",
    }));
  }

  const updateGuardian = (index: number, key: keyof Guardian, value: string) =>
    setGuardians((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );

  function prefillPrimaryGuardianFromStudent() {
    setGuardians((current) => {
      const primary = current[0];
      return [
        {
          ...primary,
          name: primary.name || form.name,
          postnom: primary.postnom || form.postnom,
          prenom: primary.prenom || form.prenom,
          address: primary.address || form.address,
        },
        current[1],
      ];
    });
  }

  function resetCurrentStudentFields() {
    setForm((current) => ({
      ...current,
      name: "",
      postnom: "",
      prenom: "",
      sexe: "",
      dateOfBirth: "",
      placeOfBirth: "",
      address: "",
      email: "",
      provenanceEcole: "",
      requestedLevel: "",
      requestedSection: "",
      requestedOption: "",
      consentAccepted: false,
    }));
    setPhoto(null);
    setStudentExtra(emptyStudentExtraInfo());
  }

  function buildCurrentQueuedStudent(options?: {
    requireLevel?: boolean;
  }): QueuedStudent | null {
    const requireLevel = options?.requireLevel ?? true;
    if (
      !form.name ||
      !form.postnom ||
      !form.prenom ||
      !form.sexe ||
      !form.dateOfBirth ||
      !form.placeOfBirth ||
      !form.address
    ) {
      return null;
    }
    if (requireLevel && !form.requestedLevel) {
      return null;
    }
    return {
      name: form.name,
      postnom: form.postnom,
      prenom: form.prenom,
      sexe: form.sexe as "masculin" | "feminin",
      dateOfBirth: form.dateOfBirth,
      placeOfBirth: form.placeOfBirth,
      address: form.address,
      email: form.email.trim(),
      provenanceEcole: form.provenanceEcole,
      requestedLevel: form.requestedLevel,
      requestedSection: form.requestedSection,
      requestedOption: form.requestedOption,
      photo,
      extra: studentExtra,
    };
  }

  function loadStudentIntoForm(entry: QueuedStudent) {
    setForm((current) => ({
      ...current,
      name: entry.name,
      postnom: entry.postnom,
      prenom: entry.prenom,
      sexe: entry.sexe,
      dateOfBirth: entry.dateOfBirth,
      placeOfBirth: entry.placeOfBirth,
      address: entry.address,
      email: entry.email ?? "",
      provenanceEcole: entry.provenanceEcole,
      requestedLevel: entry.requestedLevel,
      requestedSection: entry.requestedSection,
      requestedOption: entry.requestedOption,
    }));
    setPhoto(entry.photo);
    setStudentExtra(entry.extra);
  }

  function validateCurrentIdentity(): boolean {
    if (
      !form.branchId ||
      !form.name ||
      !form.postnom ||
      !form.prenom ||
      !form.sexe ||
      !form.dateOfBirth ||
      !form.placeOfBirth ||
      !form.address
    ) {
      toast.error(
        `Completez les informations obligatoires de ${peopleLabels.studentDefinite}.`,
      );
      return false;
    }
    if (isPrimary) {
      const age = ageFromDate(form.dateOfBirth);
      if (age === null || age < PRIMARY_MIN_AGE) {
        toast.error(
          `Pour le primaire, l'enfant doit avoir au moins ${PRIMARY_MIN_AGE} ans.`,
        );
        return false;
      }
    }
    return true;
  }

  function validateCurrentLevel(): boolean {
    const levelLabels = getPublicLevelFieldLabels(branchType);
    if (!form.requestedLevel) {
      toast.error(`Indiquez ${levelLabels.level.toLowerCase()} souhaite(e).`);
      return false;
    }
    if (
      requiresSectionForClass(branchType, form.requestedLevel) &&
      !form.requestedSection
    ) {
      toast.error(`Choisissez ${levelLabels.section.toLowerCase()}.`);
      return false;
    }
    if (
      requiresOptionForClass(branchType, form.requestedLevel) &&
      !form.requestedOption
    ) {
      toast.error(`Choisissez ${levelLabels.option.toLowerCase()}.`);
      return false;
    }
    return true;
  }

  /** Ajoute l'élève en cours à la liste et ouvre une fiche vide (dès l'étape 1). */
  function queueCurrentAndStartNext(options?: { requireLevel?: boolean }) {
    const requireLevel = options?.requireLevel ?? stepKind !== "student";
    if (!validateCurrentIdentity()) return;
    if (requireLevel && !validateCurrentLevel()) return;

    const current = buildCurrentQueuedStudent({ requireLevel: false });
    if (!current) {
      toast.error("Completez d'abord l'eleve en cours.");
      return;
    }
    if (requireLevel && !current.requestedLevel) {
      toast.error("Indiquez le niveau de cet eleve avant d'en ajouter un autre.");
      return;
    }
    if (queuedStudents.length + 1 >= MAX_CHILDREN) {
      toast.error(`Maximum ${MAX_CHILDREN} eleves par demande.`);
      return;
    }
    setQueuedStudents((list) => [...list, current]);
    resetCurrentStudentFields();
    setStep(0);
    toast.success(
      `${peopleLabels.student} ajoute (${queuedStudents.length + 1}). Saisissez le suivant — l'ecole et le responsable seront partages.`,
    );
  }

  function editQueuedStudent(index: number) {
    const entry = queuedStudents[index];
    if (!entry) return;
    const current = buildCurrentQueuedStudent({ requireLevel: false });
    setQueuedStudents((list) => {
      const without = list.filter((_, i) => i !== index);
      if (
        current &&
        (current.name || current.prenom) &&
        without.length + 1 < MAX_CHILDREN
      ) {
        // Remettre l'élève en cours dans la liste s'il a déjà une identité
        if (current.name && current.postnom && current.prenom) {
          return [...without, current];
        }
      }
      return without;
    });
    loadStudentIntoForm(entry);
    setStep(0);
    toast.message(`Modification de ${entry.prenom} ${entry.name}`);
  }

  function removeQueuedStudent(index: number) {
    setQueuedStudents((list) => list.filter((_, i) => i !== index));
  }

  function validateStep() {
    if (
      stepKind === "student" &&
      (!branchTypeFilter ||
        !form.branchId ||
        !form.name ||
        !form.postnom ||
        !form.prenom ||
        !form.sexe ||
        !form.dateOfBirth ||
        !form.placeOfBirth ||
        !form.address)
    ) {
      toast.error(`Completez les informations obligatoires de ${peopleLabels.studentDefinite}.`);
      return false;
    }
    if (stepKind === "student" && isPrimary) {
      const age = ageFromDate(form.dateOfBirth);
      if (age === null || age < PRIMARY_MIN_AGE) {
        toast.error(
          `Pour le primaire, l'enfant doit avoir au moins ${PRIMARY_MIN_AGE} ans.`,
        );
        return false;
      }
    }
    const primary = guardians[0];
    if (
      stepKind === "guardian" &&
      (!primary.name ||
        !primary.postnom ||
        !primary.prenom ||
        !primary.relationshipPreset ||
        !primary.telephone ||
        !primary.address)
    ) {
      toast.error("Completez le responsable principal.");
      return false;
    }
    if (
      stepKind === "guardian" &&
      primary.relationshipPreset === "autre" &&
      !primary.relationshipOther.trim()
    ) {
      toast.error("Precisez le lien de parente (Autre).");
      return false;
    }
    if (stepKind === "guardian" && secondGuardian) {
      const second = guardians[1];
      if (
        !second.name ||
        !second.postnom ||
        !second.prenom ||
        !second.relationshipPreset ||
        !second.telephone ||
        !second.address
      ) {
        toast.error("Completez le second responsable ou retirez-le.");
        return false;
      }
      if (
        second.relationshipPreset === "autre" &&
        !second.relationshipOther.trim()
      ) {
        toast.error("Precisez le lien de parente du second responsable.");
        return false;
      }
    }
    const levelLabels = getPublicLevelFieldLabels(branchType);
    if (stepKind === "level" && !form.requestedLevel) {
      toast.error(`Indiquez ${levelLabels.level.toLowerCase()} souhaite(e).`);
      return false;
    }
    if (
      stepKind === "level" &&
      requiresSectionForClass(branchType, form.requestedLevel) &&
      !form.requestedSection
    ) {
      toast.error(`Choisissez ${levelLabels.section.toLowerCase()}.`);
      return false;
    }
    if (
      stepKind === "level" &&
      requiresOptionForClass(branchType, form.requestedLevel) &&
      !form.requestedOption
    ) {
      toast.error(`Choisissez ${levelLabels.option.toLowerCase()}.`);
      return false;
    }
    return true;
  }

  function submit() {
    if (!form.consentAccepted)
      return toast.error("Acceptez le traitement des donnees.");

    const current = buildCurrentQueuedStudent({ requireLevel: false });
    if (!current && queuedStudents.length === 0) {
      toast.error("Aucun eleve a envoyer.");
      return;
    }
    if (!current) {
      toast.error("Completez l'eleve en cours ou retirez-le avant l'envoi.");
      return;
    }
    if (!current.requestedLevel.trim()) {
      toast.error(
        `Indiquez le niveau pour ${current.prenom} ${current.name} avant l'envoi.`,
      );
      setStep(skipsGuardian ? 1 : 2);
      return;
    }
    const incompleteQueued = queuedStudents.findIndex(
      (item) => !item.requestedLevel.trim(),
    );
    if (incompleteQueued >= 0) {
      const next = queuedStudents[incompleteQueued]!;
      setQueuedStudents((list) => {
        const without = list.filter((_, i) => i !== incompleteQueued);
        return [...without, current];
      });
      loadStudentIntoForm(next);
      setStep(skipsGuardian ? 1 : 2);
      toast.error(
        `Indiquez le niveau pour ${next.prenom} ${next.name} avant l'envoi.`,
      );
      return;
    }
    if (!skipsGuardian) {
      const primary = guardians[0];
      if (
        !primary.name ||
        !primary.postnom ||
        !primary.prenom ||
        !primary.relationshipPreset ||
        !primary.telephone ||
        !primary.address
      ) {
        toast.error("Completez le responsable principal.");
        return;
      }
    }

    const allStudents = [...queuedStudents, current];

    startTransition(async () => {
      const studentsPayload = [];
      for (const entry of allStudents) {
        let photoUrl = "";
        if (entry.photo) {
          const uploaded = await uploadFile(entry.photo);
          if (!uploaded.ok) {
            toast.error(uploaded.message);
            return;
          }
          photoUrl = uploaded.url;
        }
        studentsPayload.push({
          name: entry.name,
          postnom: entry.postnom,
          prenom: entry.prenom,
          sexe: entry.sexe,
          dateOfBirth: entry.dateOfBirth,
          placeOfBirth: entry.placeOfBirth,
          address: entry.address,
          email:
            entry.email.trim() ||
            previewStudentEmail(entry.prenom, entry.name),
          provenanceEcole: hidesProvenance
            ? undefined
            : entry.provenanceEcole || undefined,
          requestedLevel: entry.requestedLevel,
          requestedSection: entry.requestedSection || undefined,
          requestedOption: entry.requestedOption || undefined,
          photoUrl: photoUrl || undefined,
          extra: entry.extra,
        });
      }

      const guardiansPayload = skipsGuardian
        ? []
        : (secondGuardian ? guardians : [guardians[0]]).map((guardian) => ({
            name: guardian.name,
            postnom: guardian.postnom,
            prenom: guardian.prenom,
            relationship: resolveRelationship(guardian),
            sexe: guardian.sexe,
            telephone: guardian.telephone,
            email: guardian.email,
            address: guardian.address,
            isPrimary: guardian.isPrimary,
          }));

      const result = await registerStudentsOnline({
        branchId: form.branchId,
        students: studentsPayload,
        guardians: guardiansPayload,
        familyExtra: skipsGuardian ? undefined : familyExtra,
        consentAccepted: true,
        termsInfoId: schoolInfo?.id ?? null,
      });
      if (!result.success) {
        toast.error(result.message);
        flushDraft();
        return;
      }
      clearPublicRegistrationDraft();
      setDraftSavedAt(null);
      setReferences(result.references);
      toast.success(result.message);
    });
  }

  if (references.length > 0) {
    const feeLabel = schoolInfo
      ? formatRegistrationFee(
          schoolInfo.registrationFeeAmount,
          schoolInfo.registrationFeeCurrency,
        )
      : null;
    const plannedRentree = schoolInfo
      ? getPlannedRentree(schoolInfo.rentreeProgram)
      : null;
    const needsPhysicalConfirmation =
      isCentreFormationBranch(branchType) || branchType === "UNIVERSITE";
    const confirmationMessage = needsPhysicalConfirmation
      ? `Le ${establishmentLabel.toLowerCase()} doit confirmer la demande avant l'inscription definitive. Passez physiquement pour la confirmation.`
      : "L'ecole doit confirmer la demande avant l'inscription definitive.";

    return (
      <div className="min-h-screen bg-background">
        <HomeNavbar />
        <main className="mx-auto flex max-w-7xl justify-center px-4 py-16 md:py-20">
          <Card className="w-full border-border shadow-sm">
            <CardContent className="flex flex-col items-center space-y-6 p-8 text-center md:p-10">
              <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="size-8" />
              </span>
              <div className="w-full space-y-2">
                <h1 className="text-2xl font-bold text-foreground">
                  {references.length > 1
                    ? "Demandes envoyees"
                    : "Demande envoyee"}
                </h1>
                <p className="text-muted-foreground">
                  Conservez{" "}
                  {references.length > 1
                    ? "ces references"
                    : "cette reference"}{" "}
                  :
                </p>
                <div className="space-y-2">
                  {references.map((ref) => (
                    <p
                      key={ref}
                      className="rounded-xl border border-primary/20 bg-primary/5 p-4 font-mono text-xl font-bold text-primary"
                    >
                      {ref}
                    </p>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {confirmationMessage}
                </p>
              </div>

              {schoolInfo ? (
                <div className="flex w-full flex-col items-center space-y-3">
                  {schoolInfo.registrationFeeRequired ? (
                    <div className="w-full rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
                      <div className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
                        <Wallet className="size-4 shrink-0 text-primary" />
                        <span>
                          {schoolInfo.registrationFeeLabel ||
                            "Frais d'inscription"}
                          {feeLabel ? ` — ${feeLabel}` : ""}
                          {references.length > 1
                            ? ` (par ${peopleLabels.studentLower})`
                            : ""}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {schoolInfo.registrationFeeDueNote ||
                          "A regler aupres de la caisse de l'etablissement avant la confirmation."}
                      </p>
                    </div>
                  ) : null}

                  {plannedRentree ? (
                    <div className="w-full rounded-xl border p-4 text-center">
                      <div className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
                        <CalendarDays className="size-4 shrink-0 text-primary" />
                        Date de rentree prevue
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {formatRentreeDate(plannedRentree.date)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {plannedRentree.title}
                        {plannedRentree.description
                          ? ` · ${plannedRentree.description}`
                          : ""}
                      </p>
                    </div>
                  ) : null}

                  <div className="w-full rounded-xl border bg-muted/20 p-4 text-center">
                    <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium">
                      <FileText className="size-4 shrink-0 text-primary" />
                      {schoolInfo.termsTitle || "Conditions a retenir"}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {schoolInfo.termsContent}
                    </p>
                    {schoolInfo.branchName ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {schoolInfo.branchName}
                        {schoolInfo.schoolYearName
                          ? ` · ${schoolInfo.schoolYearName}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <HomeNavbar />

      <section className="border-b border-primary/10 bg-primary text-primary-foreground shadow-lg shadow-primary/10">
        <div className="mx-auto max-w-7xl px-4 py-8 md:py-10">
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold text-primary-foreground/90">
              <UserPlus className="size-4" />
              Inscription en ligne
            </div>
            {draftSavedAt ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-medium text-primary-foreground/90 hover:bg-primary-foreground/25"
                title="Sauvegarde locale automatique (navigateur). Cliquez pour tout vider et recharger la page."
                onClick={discardDraft}
              >
                Brouillon local · {formatDraftSavedAt(draftSavedAt)}
              </button>
            ) : null}
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
            Demande d&apos;inscription
          </h1>
          <p className="mt-2 max-w-7xl text-sm leading-relaxed text-primary-foreground/90">
            Etape {step + 1} sur {totalSteps} · cette demande ne cree pas encore de compte.
          </p>
          <Progress
            value={((step + 1) / totalSteps) * 100}
            className="mt-4 h-2 bg-primary-foreground/20 [&>div]:bg-primary-foreground"
          />
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-8 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] lg:items-start">
          <Card className="border-border shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg text-foreground">
              Formulaire d&apos;inscription
            </CardTitle>
            <p className="text-sm text-muted-foreground">{formIntro}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {stepKind === "student" && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Type d'etablissement *" wide>
                  <Select
                    value={branchTypeFilter || undefined}
                    onValueChange={onBranchTypeChange}
                    disabled={branchLocked}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ecole, centre ou universite" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBranchTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {getEstablishmentTypeFilterLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={`${establishmentLabel} *`} wide>
                  <Select
                    value={form.branchId}
                    onValueChange={onBranchChange}
                    disabled={!branchTypeFilter || branchLocked}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          branchTypeFilter
                            ? `Choisir ${establishmentLabel.toLowerCase()}`
                            : "Choisissez d'abord le type"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredBranches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name} · {branch.ville || branch.pays || "RDC"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {form.branchId ? (
                  <div className="md:col-span-2 lg:hidden">
                    <SchoolRegistrationPanel
                      info={schoolInfo}
                      loading={schoolInfoLoading}
                      establishmentLabel={establishmentLabel}
                    />
                  </div>
                ) : null}
                <Text
                  label="Nom *"
                  value={form.name}
                  onChange={(v) => update("name", v)}
                />
                <Text
                  label="Postnom (facultatif)"
                  value={form.postnom}
                  onChange={(v) => update("postnom", v)}
                />
                <Text
                  label="Prenom (facultatif)"
                  value={form.prenom}
                  onChange={(v) => update("prenom", v)}
                />
                <Field label="Sexe *">
                  <Select
                    value={form.sexe}
                    onValueChange={(v) => update("sexe", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculin">Masculin</SelectItem>
                      <SelectItem value="feminin">Feminin</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date de naissance *">
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    max={isPrimary ? primaryMaxBirthDate : undefined}
                    onChange={(event) =>
                      update("dateOfBirth", event.target.value)
                    }
                  />
                  {isPrimary ? (
                    <p className="text-xs text-muted-foreground">
                      Primaire : l&apos;enfant doit avoir au moins{" "}
                      {PRIMARY_MIN_AGE} ans.
                    </p>
                  ) : null}
                </Field>
                <Text
                  label="Lieu de naissance *"
                  value={form.placeOfBirth}
                  onChange={(v) => update("placeOfBirth", v)}
                />
                <Text
                  label="Adresse *"
                  value={form.address}
                  onChange={(v) => update("address", v)}
                />
                <Field label="Email (facultatif)">
                  <Input
                    type="email"
                    placeholder={generatedStudentEmail}
                    value={form.email}
                    onChange={(event) => update("email", event.target.value)}
                  />
                  {!form.email.trim() ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Si vide, un email sera genere :{" "}
                      <span className="font-mono">{generatedStudentEmail}</span>
                    </p>
                  ) : null}
                </Field>
                <div className="md:col-span-2 rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Plusieurs {peopleLabels.studentPluralLower} ?
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {canAddAnotherStudent
                          ? "Ajoutez-les des le debut. Vous pourrez modifier chaque fiche avant d'envoyer. L'ecole et le responsable sont partages."
                          : "Completez d'abord tous les champs obligatoires de cet eleve pour pouvoir en ajouter un autre."}
                      </p>
                    </div>
                    {canAddAnotherStudent ? (
                      <Button
                        type="button"
                        variant="default"
                        className="shrink-0"
                        onClick={() =>
                          queueCurrentAndStartNext({ requireLevel: false })
                        }
                      >
                        <UserPlus className="mr-2 size-4" />
                        Ajouter un autre {peopleLabels.studentLower}
                      </Button>
                    ) : null}
                  </div>
                  {queuedStudents.length > 0 ? (
                    <ul className="mt-3 space-y-2 border-t border-primary/15 pt-3">
                      {queuedStudents.map((item, index) => (
                        <li
                          key={`${item.name}-${item.prenom}-${index}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
                        >
                          <span>
                            <span className="font-medium">
                              {index + 1}. {item.prenom} {item.name}{" "}
                              {item.postnom}
                            </span>
                            <span className="text-muted-foreground">
                              {item.requestedLevel
                                ? ` · ${item.requestedLevel}`
                                : " · niveau a completer"}
                            </span>
                          </span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => editQueuedStudent(index)}
                            >
                              <Pencil className="mr-1.5 size-3.5" />
                              Modifier
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-destructive"
                              onClick={() => removeQueuedStudent(index)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            )}
            {stepKind === "guardian" && (
              <div className="space-y-6">
                {guardians
                  .slice(0, secondGuardian ? 2 : 1)
                  .map((guardian, index) => (
                    <div key={index} className="rounded-xl border p-4">
                      <h3 className="mb-4 font-semibold">
                        {index === 0
                          ? "Responsable principal"
                          : "Second responsable"}
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {(
                          [
                            "name",
                            "postnom",
                            "prenom",
                            "telephone",
                            "email",
                            "address",
                          ] as const
                        ).map((key) => (
                          <Text
                            key={key}
                            label={
                              {
                                name: "Nom *",
                                postnom: "Postnom (facultatif)",
                                prenom: "Prenom (facultatif)",
                                telephone: "Telephone *",
                                email: "Email",
                                address: "Adresse *",
                              }[key]
                            }
                            value={guardian[key]}
                            onChange={(v) => updateGuardian(index, key, v)}
                          />
                        ))}
                        <Field label="Lien de parente *">
                          <Select
                            value={guardian.relationshipPreset}
                            onValueChange={(value) =>
                              updateGuardian(index, "relationshipPreset", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir" />
                            </SelectTrigger>
                            <SelectContent>
                              {RELATIONSHIP_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        {guardian.relationshipPreset === "autre" ? (
                          <Text
                            label="Preciser le lien *"
                            value={guardian.relationshipOther}
                            onChange={(v) =>
                              updateGuardian(index, "relationshipOther", v)
                            }
                          />
                        ) : null}
                        <Field label="Sexe *">
                          <Select
                            value={guardian.sexe}
                            onValueChange={(value) =>
                              updateGuardian(index, "sexe", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="masculin">Masculin</SelectItem>
                              <SelectItem value="feminin">Feminin</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    </div>
                  ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSecondGuardian((value) => !value)}
                >
                  <UserPlus className="mr-2 size-4" />
                  {secondGuardian
                    ? "Retirer le second responsable"
                    : "Ajouter un second responsable"}
                </Button>

                <Collapsible open={extraOpen} onOpenChange={setExtraOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-between px-0 hover:bg-transparent"
                    >
                      <span className="text-sm font-medium">
                        Infos complementaires (optionnel)
                      </span>
                      <ChevronDown
                        className={`size-4 transition-transform ${extraOpen ? "rotate-180" : ""}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <p className="mb-3 text-xs text-muted-foreground">
                      Vous pouvez completer plus tard. Le responsable principal
                      ci-dessus reste le pere / tuteur principal.
                    </p>
                    <RegistrationExtraInfoFields
                      studentExtra={studentExtra}
                      familyExtra={familyExtra}
                      onStudentChange={(key, value) =>
                        setStudentExtra((current) => ({
                          ...current,
                          [key]: value,
                        }))
                      }
                      onFamilyChange={(key, value) =>
                        setFamilyExtra((current) => ({
                          ...current,
                          [key]: value,
                        }))
                      }
                    />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
            {stepKind === "level" && (
              <div className="grid gap-4">
                {!form.branchId ? (
                  <p className="text-sm text-muted-foreground">
                    Sélectionnez d&apos;abord un établissement à l&apos;étape 1.
                  </p>
                ) : (
                  <>
                    {usesBranchTree && academicChoicesLoading ? (
                      <p className="text-sm text-muted-foreground">
                        Chargement des programmes et modules...
                      </p>
                    ) : null}
                    {usesBranchTree &&
                    !academicChoicesLoading &&
                    !branchAcademicTree?.length ? (
                      <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                        Ce centre n&apos;a pas encore publie de programmes ou
                        modules. Contactez l&apos;etablissement.
                      </p>
                    ) : null}
                    <LevelSectionOptionFields
                      typebranch={branchType}
                      branchTree={branchAcademicTree}
                      value={{
                        level: form.requestedLevel,
                        sectionName: form.requestedSection,
                        optionName: form.requestedOption,
                      }}
                      onChange={(next) =>
                        setForm((current) => ({
                          ...current,
                          requestedLevel: next.level,
                          requestedSection: next.sectionName,
                          requestedOption: next.optionName,
                        }))
                      }
                    />
                  </>
                )}
                {!hidesProvenance ? (
                  <Text
                    label="Ecole de provenance"
                    value={form.provenanceEcole}
                    onChange={(v) => update("provenanceEcole", v)}
                  />
                ) : null}
                <Field label="Photo facultative" wide>
                  <div className="flex flex-wrap items-center gap-3">
                    {preview ? (
                      <Image
                        src={preview}
                        alt="Apercu"
                        width={80}
                        height={80}
                        unoptimized
                        className="size-20 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex size-20 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
                        <ImagePlus />
                      </div>
                    )}
                    <Label className="cursor-pointer rounded-md border px-3 py-2 text-sm">
                      <ImagePlus className="mr-2 inline size-4" />
                      Parcourir
                      <Input
                        className="hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) =>
                          setPhoto(event.target.files?.[0] ?? null)
                        }
                      />
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCameraOpen(true)}
                    >
                      <Camera className="mr-2 size-4" />
                      Caméra
                    </Button>
                  </div>
                </Field>

                {skipsGuardian ? (
                  <Collapsible open={extraOpen} onOpenChange={setExtraOpen}>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-between px-0 hover:bg-transparent"
                      >
                        <span className="text-sm font-medium">
                          Infos complementaires (optionnel)
                        </span>
                        <ChevronDown
                          className={`size-4 transition-transform ${extraOpen ? "rotate-180" : ""}`}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <RegistrationExtraInfoFields
                        studentExtra={studentExtra}
                        familyExtra={familyExtra}
                        hideFamily
                        onStudentChange={(key, value) =>
                          setStudentExtra((current) => ({
                            ...current,
                            [key]: value,
                          }))
                        }
                        onFamilyChange={(key, value) =>
                          setFamilyExtra((current) => ({
                            ...current,
                            [key]: value,
                          }))
                        }
                      />
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
              </div>
            )}
            {stepKind === "recap" && (
              <div className="space-y-5">
                <div className="space-y-2 rounded-xl border p-4">
                  <p className="text-sm font-semibold">
                    {queuedStudents.length > 0
                      ? `${peopleLabels.studentPlural} de la demande (${queuedStudents.length + 1})`
                      : `Demande pour 1 ${peopleLabels.studentLower}`}
                  </p>
                  <ul className="space-y-2 text-sm">
                    {queuedStudents.map((item, index) => (
                      <li
                        key={`recap-${index}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                      >
                        <span>
                          {index + 1}. {item.prenom} {item.name} {item.postnom}
                          <span className="text-muted-foreground">
                            {item.requestedLevel
                              ? ` · ${item.requestedLevel}`
                              : " · niveau manquant"}
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => editQueuedStudent(index)}
                        >
                          <Pencil className="mr-1.5 size-3.5" />
                          Modifier
                        </Button>
                      </li>
                    ))}
                    <li className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
                      {queuedStudents.length + 1}. {form.prenom} {form.name}{" "}
                      {form.postnom}
                      <span className="text-muted-foreground">
                        {form.requestedLevel
                          ? ` · ${form.requestedLevel}`
                          : " · niveau manquant"}{" "}
                        (en cours)
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="grid gap-3 rounded-xl border border-primary/15 bg-primary/5 p-5 md:grid-cols-2">
                  <p>
                    <b>
                      {queuedStudents.length > 0
                        ? `${peopleLabels.student} en cours`
                        : peopleLabels.student}{" "}
                      :
                    </b>{" "}
                    {form.name} {form.postnom} {form.prenom}
                  </p>
                  <p>
                    <b>Email :</b> {resolvedStudentEmail}
                    {!form.email.trim() ? " (auto)" : ""}
                  </p>
                  <p>
                    <b>Niveau :</b> {form.requestedLevel}
                    {form.requestedSection
                      ? ` · ${form.requestedSection}`
                      : ""}
                    {form.requestedOption
                      ? ` · ${form.requestedOption}`
                      : ""}
                  </p>
                  {!skipsGuardian ? (
                    <p>
                      <b>Responsable :</b> {guardians[0].name}{" "}
                      {guardians[0].postnom}
                    </p>
                  ) : null}
                  <p>
                    <b>Photo :</b> {photo ? "Ajoutee" : "Non ajoutee"}
                  </p>
                </div>
                <Label className="flex items-start gap-3">
                  <Checkbox
                    checked={form.consentAccepted}
                    onCheckedChange={(checked) =>
                      update("consentAccepted", checked === true)
                    }
                  />
                  <span>
                    J&apos;accepte le traitement de ces donnees pour la demande
                    d&apos;inscription
                    {selectedBranch ? ` a ${selectedBranch.name}` : ""}.
                    {schoolInfo
                      ? " J'ai pris connaissance des conditions d'inscription de l'ecole."
                      : ""}
                  </span>
                </Label>
              </div>
            )}
            <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0 || isPending}
                onClick={() => setStep((value) => value - 1)}
              >
                <ChevronLeft className="mr-2 size-4" />
                Precedent
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                {step < maxStep ? (
                  <Button
                    type="button"
                    onClick={() => {
                      if (!validateStep()) return;
                      if (stepKind === "student" && !skipsGuardian) {
                        prefillPrimaryGuardianFromStudent();
                      }
                      if (stepKind === "level") {
                        const incompleteIdx = queuedStudents.findIndex(
                          (item) => !item.requestedLevel.trim(),
                        );
                        if (incompleteIdx >= 0) {
                          if (!validateCurrentLevel()) return;
                          const current = buildCurrentQueuedStudent({
                            requireLevel: true,
                          });
                          if (!current) return;
                          const next = queuedStudents[incompleteIdx]!;
                          setQueuedStudents((list) => {
                            const without = list.filter(
                              (_, i) => i !== incompleteIdx,
                            );
                            return [...without, current];
                          });
                          loadStudentIntoForm(next);
                          toast.message(
                            `Completez le niveau pour ${next.prenom} ${next.name}`,
                          );
                          return;
                        }
                      }
                      setStep((value) => Math.min(value + 1, maxStep));
                    }}
                  >
                    Continuer
                    <ChevronRight className="ml-2 size-4" />
                  </Button>
                ) : (
                  <Button type="button" disabled={isPending} onClick={submit}>
                    <Send className="mr-2 size-4" />
                    {isPending
                      ? "Envoi..."
                      : queuedStudents.length > 0
                        ? `Envoyer ${queuedStudents.length + 1} demandes`
                        : "Envoyer la demande"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-3">
              <p className="text-sm font-medium text-foreground">
                Infos de l&apos;{establishmentLabel.toLowerCase()}
              </p>
              {form.branchId ? (
                <SchoolRegistrationPanel
                  info={schoolInfo}
                  loading={schoolInfoLoading}
                  establishmentLabel={establishmentLabel}
                />
              ) : (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  Selectionnez un type puis un {establishmentLabel.toLowerCase()}{" "}
                  pour voir les conditions, les frais d&apos;inscription et le
                  programme de rentree.
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title="Capture photo"
        onCapture={(file) => {
          setPhoto(file);
        }}
      />
    </div>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-2 ${wide ? "md:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Text({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <Field label={label}>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
