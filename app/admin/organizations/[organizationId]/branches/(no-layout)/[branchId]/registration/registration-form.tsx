"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { writePaiementBootstrap } from "@/lib/paiement-bootstrap";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconArrowRight,
  IconAlertTriangle,
  IconBabyCarriage,
  IconBackpack,
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
import { SearchCombobox } from "@/components/ui/search-combobox";
import { Textarea } from "@/components/ui/textarea";
import {
  createRegistrationFlowAction,
  createNextParallelForRegistrationAction,
  createCreneauForRegistrationAction,
  findParentForRegistrationAction,
  findStudentHistoryAction,
  getRegistrationOptionsAction,
  getRegistrationRequestForPrefillAction,
  getActiveFraisForDiscountPreviewAction,
  suggestNextClassAction,
  updateRegistrationClassCapacityAction,
} from "./registration.action";
import { generateSlug } from "@/lib/generated-identifiers";
import { cn } from "@/lib/utils";
import { matchesClassForLevel } from "@/lib/class-enrollment/match-class-for-level";
import {
  getClassLevelLabel,
  getClassLevelsForBranch,
  requiresOptionForClass,
  requiresSectionForClass,
  isCtebLevel,
  isHumanitesLevel,
  allowsOptionForBranch,
} from "@/lib/class-structure";
import { cycleLabel, isCycle, getBranchCycles, type Cycle } from "@/lib/cycle";
import {
  CTEB_SECTION_CODE,
  findCtebOption,
  findCtebSection,
  isCtebOption,
  isCtebSection,
} from "@/lib/class-catalog";
import {
  ANGOLA_CICLO1_SECTION_CODE,
  isAngolaFirstCycleLevel,
  isAngolaNucleoComumOption,
  isAngolaSecondarySystem,
  angolaRequiresArea,
} from "@/lib/angola-secondary-structure";
import {
  getClassDisplayLabel,
  getClassDisplayLabelPlural,
  hidesParentManagement,
  hidesProvenanceEcole,
  isUniversiteBranch,
} from "@/lib/branch-capabilities";
import { getPeopleVariant } from "@/lib/people-variant";
import {
  REGISTRATION_PREFILL_EVENT,
  type PrefillEventDetail,
} from "@/lib/prefill-events";
import { uploadFile } from "@/lib/upload-file";
import {
  emptyFamilyExtraInfo,
  emptyStudentExtraInfo,
  type FamilyExtraInfo,
  type StudentExtraInfo,
} from "@/lib/registration-extra-info";
import {
  clearAdminRegistrationDraft,
  consumeRegistrationDraftCleared,
  formatDraftSavedAt,
  isMeaningfulAdminDraft,
  markRegistrationDraftCleared,
  readAdminRegistrationDraft,
  REGISTRATION_DRAFT_DEBOUNCE_MS,
  writeAdminRegistrationDraft,
  type AdminRegistrationDraftPayload,
} from "@/lib/registration-draft";
import { RegistrationExtraInfoSheet } from "@/components/registration-extra-info-sheet";
import {
  defaultCreneauValues,
  type CreneauFormValues,
} from "@/src/interfaces/creneau";
import {
  CRENEAU_WEEKDAY_OPTIONS,
  normalizeCreneauWorkingDays,
} from "@/lib/creneau-working-days";
import { Checkbox } from "@/components/ui/checkbox";
import { computeScopedDiscountAmount } from "@/lib/payment-discount";

type RegistrationStepKey = "student" | "parent" | "class" | "confirm";

/** Accents alignés sur les cartes récap (sky / amber / emerald / teal). */
const stepTone: Record<
  RegistrationStepKey,
  {
    currentCard: string;
    idleCard: string;
    currentIcon: string;
    formHeader: string;
    badge: string;
    fields: string;
  }
> = {
  student: {
    currentCard:
      "scale-[1.02] border-sky-400 bg-sky-100/90 shadow-sm ring-1 ring-sky-300/60 dark:border-sky-500 dark:bg-sky-950/50 dark:ring-sky-700/50",
    idleCard:
      "border-sky-200/70 bg-sky-50/40 opacity-90 dark:border-sky-900/50 dark:bg-sky-950/20",
    currentIcon: "bg-sky-600 text-white",
    formHeader:
      "border-sky-100/80 bg-gradient-to-r from-sky-50/60 via-transparent to-transparent dark:border-sky-900/30 dark:from-sky-950/20",
    badge:
      "border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100",
    fields:
      "[&_input:not([type=file]):not([type=hidden])]:border-sky-300 [&_input:not([type=file]):not([type=hidden])]:hover:border-sky-400 [&_input:not([type=file]):not([type=hidden])]:focus-visible:border-sky-500 [&_input:not([type=file]):not([type=hidden])]:focus-visible:ring-sky-300/40 dark:[&_input:not([type=file]):not([type=hidden])]:border-sky-700 dark:[&_input:not([type=file]):not([type=hidden])]:hover:border-sky-500 dark:[&_input:not([type=file]):not([type=hidden])]:focus-visible:border-sky-400 [&_textarea]:border-sky-300 [&_textarea]:hover:border-sky-400 [&_textarea]:focus-visible:border-sky-500 [&_textarea]:focus-visible:ring-sky-300/40 dark:[&_textarea]:border-sky-700 dark:[&_textarea]:hover:border-sky-500 dark:[&_textarea]:focus-visible:border-sky-400 [&_[role=combobox]]:border-sky-300 [&_[role=combobox]]:hover:border-sky-400 [&_[role=combobox]]:focus:border-sky-500 [&_[role=combobox]]:focus:ring-sky-300/40 dark:[&_[role=combobox]]:border-sky-700 dark:[&_[role=combobox]]:hover:border-sky-500 dark:[&_[role=combobox]]:focus:border-sky-400",
  },
  parent: {
    currentCard:
      "scale-[1.02] border-amber-400 bg-amber-100/90 shadow-sm ring-1 ring-amber-300/60 dark:border-amber-500 dark:bg-amber-950/50 dark:ring-amber-700/50",
    idleCard:
      "border-amber-200/70 bg-amber-50/40 opacity-90 dark:border-amber-900/50 dark:bg-amber-950/20",
    currentIcon: "bg-amber-600 text-white",
    formHeader:
      "border-amber-100/80 bg-gradient-to-r from-amber-50/60 via-transparent to-transparent dark:border-amber-900/30 dark:from-amber-950/20",
    badge:
      "border-amber-200 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
    fields:
      "[&_input:not([type=file]):not([type=hidden])]:border-amber-300 [&_input:not([type=file]):not([type=hidden])]:hover:border-amber-400 [&_input:not([type=file]):not([type=hidden])]:focus-visible:border-amber-500 [&_input:not([type=file]):not([type=hidden])]:focus-visible:ring-amber-300/40 dark:[&_input:not([type=file]):not([type=hidden])]:border-amber-700 dark:[&_input:not([type=file]):not([type=hidden])]:hover:border-amber-500 dark:[&_input:not([type=file]):not([type=hidden])]:focus-visible:border-amber-400 [&_textarea]:border-amber-300 [&_textarea]:hover:border-amber-400 [&_textarea]:focus-visible:border-amber-500 [&_textarea]:focus-visible:ring-amber-300/40 dark:[&_textarea]:border-amber-700 dark:[&_textarea]:hover:border-amber-500 dark:[&_textarea]:focus-visible:border-amber-400 [&_[role=combobox]]:border-amber-300 [&_[role=combobox]]:hover:border-amber-400 [&_[role=combobox]]:focus:border-amber-500 [&_[role=combobox]]:focus:ring-amber-300/40 dark:[&_[role=combobox]]:border-amber-700 dark:[&_[role=combobox]]:hover:border-amber-500 dark:[&_[role=combobox]]:focus:border-amber-400",
  },
  class: {
    currentCard:
      "scale-[1.02] border-emerald-400 bg-emerald-100/90 shadow-sm ring-1 ring-emerald-300/60 dark:border-emerald-500 dark:bg-emerald-950/50 dark:ring-emerald-700/50",
    idleCard:
      "border-emerald-200/70 bg-emerald-50/40 opacity-90 dark:border-emerald-900/50 dark:bg-emerald-950/20",
    currentIcon: "bg-emerald-600 text-white",
    formHeader:
      "border-emerald-100/80 bg-gradient-to-r from-emerald-50/60 via-transparent to-transparent dark:border-emerald-900/30 dark:from-emerald-950/20",
    badge:
      "border-emerald-200 bg-emerald-100 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
    fields:
      "[&_input:not([type=file]):not([type=hidden])]:border-emerald-300 [&_input:not([type=file]):not([type=hidden])]:hover:border-emerald-400 [&_input:not([type=file]):not([type=hidden])]:focus-visible:border-emerald-500 [&_input:not([type=file]):not([type=hidden])]:focus-visible:ring-emerald-300/40 dark:[&_input:not([type=file]):not([type=hidden])]:border-emerald-700 dark:[&_input:not([type=file]):not([type=hidden])]:hover:border-emerald-500 dark:[&_input:not([type=file]):not([type=hidden])]:focus-visible:border-emerald-400 [&_textarea]:border-emerald-300 [&_textarea]:hover:border-emerald-400 [&_textarea]:focus-visible:border-emerald-500 [&_textarea]:focus-visible:ring-emerald-300/40 dark:[&_textarea]:border-emerald-700 dark:[&_textarea]:hover:border-emerald-500 dark:[&_textarea]:focus-visible:border-emerald-400 [&_[role=combobox]]:border-emerald-300 [&_[role=combobox]]:hover:border-emerald-400 [&_[role=combobox]]:focus:border-emerald-500 [&_[role=combobox]]:focus:ring-emerald-300/40 dark:[&_[role=combobox]]:border-emerald-700 dark:[&_[role=combobox]]:hover:border-emerald-500 dark:[&_[role=combobox]]:focus:border-emerald-400",
  },
  confirm: {
    currentCard:
      "scale-[1.02] border-teal-400 bg-teal-100/90 shadow-sm ring-1 ring-teal-300/60 dark:border-teal-500 dark:bg-teal-950/50 dark:ring-teal-700/50",
    idleCard:
      "border-teal-200/70 bg-teal-50/40 opacity-90 dark:border-teal-900/50 dark:bg-teal-950/20",
    currentIcon: "bg-teal-600 text-white",
    formHeader:
      "border-teal-100/80 bg-gradient-to-r from-teal-50/60 via-transparent to-transparent dark:border-teal-900/30 dark:from-teal-950/20",
    badge:
      "border-teal-200 bg-teal-100 text-teal-950 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-100",
    fields:
      "[&_input:not([type=file]):not([type=hidden])]:border-teal-300 [&_input:not([type=file]):not([type=hidden])]:hover:border-teal-400 [&_input:not([type=file]):not([type=hidden])]:focus-visible:border-teal-500 [&_input:not([type=file]):not([type=hidden])]:focus-visible:ring-teal-300/40 dark:[&_input:not([type=file]):not([type=hidden])]:border-teal-700 dark:[&_input:not([type=file]):not([type=hidden])]:hover:border-teal-500 dark:[&_input:not([type=file]):not([type=hidden])]:focus-visible:border-teal-400 [&_textarea]:border-teal-300 [&_textarea]:hover:border-teal-400 [&_textarea]:focus-visible:border-teal-500 [&_textarea]:focus-visible:ring-teal-300/40 dark:[&_textarea]:border-teal-700 dark:[&_textarea]:hover:border-teal-500 dark:[&_textarea]:focus-visible:border-teal-400 [&_[role=combobox]]:border-teal-300 [&_[role=combobox]]:hover:border-teal-400 [&_[role=combobox]]:focus:border-teal-500 [&_[role=combobox]]:focus:ring-teal-300/40 dark:[&_[role=combobox]]:border-teal-700 dark:[&_[role=combobox]]:hover:border-teal-500 dark:[&_[role=combobox]]:focus:border-teal-400",
  },
};

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
type ParentForm = Person & {
  discountPercentage: number;
  discountTypeFraisId: string;
  profession: string;
};

const emptyPerson: Person = {
  username: "",
  name: "",
  postnom: "",
  prenom: "",
  email: "",
  telephone: "",
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
const emptyParent: ParentForm = {
  ...emptyPerson,
  discountPercentage: 0,
  discountTypeFraisId: "",
  profession: "",
};

function userOf(item?: any) {
  if (item == null) return undefined;
  return item.branchMember?.member?.user;
}

function stubPersonItem(
  id: string,
  person: {
    name?: string;
    postnom?: string;
    prenom?: string;
    email?: string;
    telephone?: string;
    profession?: string;
  },
) {
  return {
    id,
    profession: person.profession ?? "",
    branchMember: {
      member: {
        user: {
          name: person.name ?? "",
          postnom: person.postnom ?? "",
          prenom: person.prenom ?? "",
          email: person.email ?? "",
          telephone: person.telephone ?? "",
        },
      },
    },
  };
}

function personDisplayName(
  user?: { name?: string | null; postnom?: string | null; prenom?: string | null } | null,
  fallback?: { name?: string; postnom?: string; prenom?: string },
) {
  return `${user?.name ?? fallback?.name ?? ""} ${user?.postnom ?? fallback?.postnom ?? ""} ${user?.prenom ?? fallback?.prenom ?? ""}`.trim();
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
  educationSystem?: string,
) {
  if (isCtebLevel(level)) return false;
  if (
    isAngolaSecondarySystem(typebranch, educationSystem) &&
    isAngolaFirstCycleLevel(level)
  ) {
    return false;
  }
  return requiresOptionForClass(typebranch, level, educationSystem);
}

function isStudentStepReady(
  studentMode: "existing" | "new",
  studentId: string,
  student: StudentForm,
) {
  if (studentMode === "existing") return Boolean(studentId);
  return Boolean(
    student.name &&
    student.dateOfBirth,
  );
}

function isParentStepReady(
  parentMode: "existing" | "new",
  parentId: string,
  parent: ParentForm,
) {
  if (parentMode === "existing") return Boolean(parentId);
  return Boolean(parent.name && parent.address);
}

function formatDiscountAmount(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function previewParentEmail(prenom: string, name: string) {
  return `${generateSlug(`${prenom}.${name}`, "parent")}@klambocore.com`;
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

export function RegistrationForm({
  initialRequestId = "",
}: {
  initialRequestId?: string;
}) {
  const tReg = useTranslations("registration");
  const tPeopleAll = useTranslations("people");
  const router = useRouter();
  const params = useParams<{ organizationId: string; branchId: string }>();
  const organizationId = params.organizationId ?? "";
  const branchId = params.branchId ?? "";
  const requestedRequestId = initialRequestId;
  const [requestId, setRequestId] = useState("");
  const [requestReference, setRequestReference] = useState("");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [options, setOptions] = useState<any>({
    schoolYears: [],
    classes: [],
    options: [],
    sections: [],
    levels: [],
    creneaux: [],
    typeFrais: [],
    cycles: [] as Cycle[],
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
  const parentNameSearchTimerRef = useRef<number | null>(null);
  const studentIdRef = useRef(studentId);
  const parentIdRef = useRef(parentId);
  studentIdRef.current = studentId;
  parentIdRef.current = parentId;
  const [historyOutcome, setHistoryOutcome] = useState<
    "new" | "passed" | "failed" | "returning"
  >("new");
  const [feeDebtMessage, setFeeDebtMessage] = useState("");
  const [schoolYearId, setSchoolYearId] = useState("");
  const [academicCycle, setAcademicCycle] = useState("");
  const [level, setLevel] = useState("");
  const [sectionId, setSectionId] = useState("");
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
  const [studentExtra, setStudentExtra] = useState<StudentExtraInfo>(
    emptyStudentExtraInfo(),
  );
  const [familyExtra, setFamilyExtra] = useState<FamilyExtraInfo>(
    emptyFamilyExtraInfo(),
  );
  const [extraSheetOpen, setExtraSheetOpen] = useState(false);
  const [siblingParentHint, setSiblingParentHint] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [classFrais, setClassFrais] = useState<
    Array<{
      id: string;
      nameFrais: string;
      montant: number;
      typeFraisId: string | null;
    }>
  >([]);
  const draftReadyRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef<AdminRegistrationDraftPayload | null>(null);
  const photoPreview = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : photoUrl),
    [photoFile, photoUrl],
  );

  function buildAdminDraftPayload(): AdminRegistrationDraftPayload {
    return {
      step,
      studentMode,
      studentId,
      student: { ...student },
      parentMode,
      parentId,
      parent: { ...parent },
      studentExtra: { ...studentExtra },
      familyExtra: { ...familyExtra },
      historyOutcome,
      schoolYearId,
      cycle: academicCycle,
      level,
      sectionId,
      optionId,
      creneauId,
      photoUrl,
    };
  }

  function flushAdminDraft() {
    if (!draftReadyRef.current || !branchId || requestedRequestId) return;
    const payload = latestDraftRef.current ?? buildAdminDraftPayload();
    if (!isMeaningfulAdminDraft(payload)) {
      clearAdminRegistrationDraft(branchId);
      setDraftSavedAt(null);
      return;
    }
    const savedAt = writeAdminRegistrationDraft(branchId, payload);
    if (savedAt) setDraftSavedAt(savedAt);
  }

  function scheduleAdminDraft() {
    if (!draftReadyRef.current || !branchId || requestedRequestId) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      draftTimerRef.current = null;
      flushAdminDraft();
    }, REGISTRATION_DRAFT_DEBOUNCE_MS);
  }

  function resetAdminRegistrationForm() {
    setRequestId("");
    setRequestReference("");
    setStep(0);
    setStudentMode("new");
    setStudentId("");
    setStudent(emptyStudent);
    setParentMode("new");
    setParentId("");
    setParent(emptyParent);
    setStudentQuery("");
    setParentQuery("");
    setStudentResults([]);
    setParentResults([]);
    setHistoryOutcome("new");
    setFeeDebtMessage("");
    setSchoolYearId("");
    setAcademicCycle("");
    setLevel("");
    setSectionId("");
    setOptionId("");
    setCreneauId("");
    setClassCapacity("30");
    setCreneauForm(emptyCreneau());
    setPhotoFile(null);
    setPhotoUrl("");
    setCameraOpen(false);
    setStudentExtra(emptyStudentExtraInfo());
    setFamilyExtra(emptyFamilyExtraInfo());
    setExtraSheetOpen(false);
    setSiblingParentHint("");
    setDraftSavedAt(null);
    latestDraftRef.current = null;
  }

  function stopAndClearAdminDraft() {
    draftReadyRef.current = false;
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    latestDraftRef.current = null;
    if (branchId) clearAdminRegistrationDraft(branchId);
    setDraftSavedAt(null);
  }

  function discardAdminDraft() {
    if (!branchId) return;
    stopAndClearAdminDraft();
    resetAdminRegistrationForm();
    markRegistrationDraftCleared();
    window.location.reload();
  }

  useEffect(() => {
    if (consumeRegistrationDraftCleared()) {
      toast.message("Brouillon local effacé", {
        description: "Tous les champs ont été réinitialisés.",
      });
    }
    if (!branchId || requestedRequestId) {
      draftReadyRef.current = true;
      return;
    }
    const draft = readAdminRegistrationDraft(branchId);
    if (draft?.payload && !isMeaningfulAdminDraft(draft.payload)) {
      clearAdminRegistrationDraft(branchId);
    } else if (draft?.payload) {
      const p = draft.payload;
      if (typeof p.step === "number") setStep(Math.max(0, p.step));
      if (p.studentMode === "existing" || p.studentMode === "new") {
        setStudentMode(p.studentMode);
      }
      if (typeof p.studentId === "string") setStudentId(p.studentId);
      if (p.student && typeof p.student === "object") {
        setStudent({ ...emptyStudent, ...(p.student as StudentForm) });
      }
      if (p.parentMode === "existing" || p.parentMode === "new") {
        setParentMode(p.parentMode);
      }
      if (typeof p.parentId === "string") setParentId(p.parentId);
      if (p.parent && typeof p.parent === "object") {
        setParent({ ...emptyParent, ...(p.parent as ParentForm) });
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
      if (
        p.historyOutcome === "new" ||
        p.historyOutcome === "passed" ||
        p.historyOutcome === "failed" ||
        p.historyOutcome === "returning"
      ) {
        setHistoryOutcome(p.historyOutcome);
      }
      if (typeof p.schoolYearId === "string") setSchoolYearId(p.schoolYearId);
      if (typeof p.cycle === "string") setAcademicCycle(p.cycle);
      if (typeof p.level === "string") setLevel(p.level);
      if (typeof p.sectionId === "string") setSectionId(p.sectionId);
      if (typeof p.optionId === "string") setOptionId(p.optionId);
      if (typeof p.creneauId === "string") setCreneauId(p.creneauId);
      if (typeof p.photoUrl === "string") setPhotoUrl(p.photoUrl);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, requestedRequestId]);

  useEffect(() => {
    latestDraftRef.current = buildAdminDraftPayload();
    scheduleAdminDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    studentMode,
    studentId,
    student,
    parentMode,
    parentId,
    parent,
    studentExtra,
    familyExtra,
    historyOutcome,
    schoolYearId,
    academicCycle,
    level,
    sectionId,
    optionId,
    creneauId,
    photoUrl,
    branchId,
  ]);

  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") flushAdminDraft();
    }
    function onPageHide() {
      flushAdminDraft();
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const peopleVariant = getPeopleVariant(options.typebranch);
  const peopleLabels = useMemo(() => {
    const tp = (key: string) => {
      const full = `${peopleVariant}.${key}`;
      return tPeopleAll.has(full as never)
        ? tPeopleAll(full as "school.student")
        : key;
    };
    return {
      student: tp("student"),
      studentPlural: tp("studentPlural"),
      studentLower: tp("studentLower"),
      studentPluralLower: tp("studentPluralLower"),
      teacher: tp("teacher"),
      photoOptionalLabel: tp("photoOptional"),
      photoPreviewAlt: tp("photoPreview"),
      studentNew: tp("studentNew"),
      studentExisting: tp("studentExisting"),
      searchStudent: tp("searchStudent"),
      situation: tp("situation"),
    };
  }, [peopleVariant, tPeopleAll]);
  const rawClass = getClassDisplayLabel(options.typebranch);
  const rawClassPlural = getClassDisplayLabelPlural(options.typebranch);
  const classLabelKey = `classLabels.${rawClass}`;
  const classLabelPluralKey = `classLabelsPlural.${rawClassPlural}`;
  const classLabel = tReg.has(classLabelKey)
    ? tReg(classLabelKey)
    : rawClass;
  const classLabelPlural = tReg.has(classLabelPluralKey)
    ? tReg(classLabelPluralKey)
    : rawClassPlural;
  const classLabelLower = classLabel.toLowerCase();
  const classLabelPluralLower = classLabelPlural.toLowerCase();
  const schoolYearLabel = isUniversiteBranch(options.typebranch)
    ? tReg("academicYear")
    : tReg("schoolYear");
  const schoolYearLabelLower = schoolYearLabel.toLowerCase();
  const hidesParent = hidesParentManagement(options.typebranch);
  const hidesProvenance = hidesProvenanceEcole(options.typebranch);
  const branchCycles: Cycle[] = useMemo(() => {
    const fromBranch = getBranchCycles({
      typebranch: options.typebranch,
      cycles: Array.isArray(options.cycles) ? options.cycles : undefined,
    });
    if (fromBranch.length > 1) return fromBranch;
    const fromClasses = [
      ...new Set(
        ((options.classes ?? []) as Array<{ cycle?: unknown }>)
          .map((classe) => classe.cycle)
          .filter(isCycle),
      ),
    ];
    if (fromClasses.length > 1) {
      return getBranchCycles({
        typebranch: options.typebranch,
        cycles: fromClasses,
      });
    }
    return fromBranch;
  }, [options.classes, options.cycles, options.typebranch]);
  const isMultiCycle = branchCycles.length > 1;
  const structureType = isCycle(academicCycle)
    ? academicCycle
    : !isMultiCycle
      ? (branchCycles[0] ?? "")
      : "";
  const allowsOption = Boolean(structureType) && allowsOptionForBranch(structureType);
  const classLevels = structureType
    ? [...getClassLevelsForBranch(structureType, options.educationSystem)]
    : [];
  const registrationStepKeys = useMemo<RegistrationStepKey[]>(
    () =>
      hidesParent
        ? ["student", "class", "confirm"]
        : ["student", "parent", "class", "confirm"],
    [hidesParent],
  );
  const registrationSteps = useMemo(
    () =>
      registrationStepKeys.map((key) => {
        switch (key) {
          case "student":
            return { label: peopleLabels.student, icon: IconUser };
          case "parent":
            return { label: tReg("steps.parent"), icon: IconUsers };
          case "class":
            return { label: classLabel, icon: IconSchool };
          case "confirm":
            return { label: tReg("steps.confirm"), icon: IconCheck };
        }
      }),
    [registrationStepKeys, peopleLabels.student, classLabel, tReg],
  );
  const currentStepKey = registrationStepKeys[step] ?? "student";
  const currentTone = stepTone[currentStepKey];
  const lastStepIndex = registrationStepKeys.length - 1;
  const studentStepIndex = registrationStepKeys.indexOf("student");
  const historyLabels = useMemo(
    () => ({
      new: tReg("history.new", { student: peopleLabels.studentLower }),
      passed: tReg("history.passed"),
      failed: tReg("history.failed"),
      returning: tReg("history.returning"),
    }),
    [peopleLabels.studentLower, tReg],
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
    setStudentExtra(request.studentExtra ?? emptyStudentExtraInfo());
    setFamilyExtra(request.familyExtra ?? emptyFamilyExtraInfo());
    setStudent({
      ...emptyStudent,
      ...request.student,
      dateOfBirth: request.student.dateOfBirth.slice(0, 10),
      email: request.student.email ?? "",
      telephone: request.student.telephone ?? "+243",
      provenanceEcole: request.student.provenanceEcole ?? "",
    });
    const matched =
      request.matchedExistingParent ?? request.existingSiblingParent ?? null;
    if (matched?.parentId) {
      setParentMode("existing");
      setParentId(matched.parentId);
      setParentQuery(
        matched.email?.trim() ||
          matched.telephone?.trim() ||
          matched.parentLabel ||
          "",
      );
      setParentResults([
        {
          id: matched.parentId,
          profession: matched.profession,
          branchMember: {
            member: {
              user: {
                name: matched.name || matched.parentLabel,
                postnom: matched.postnom || "",
                prenom: matched.prenom || "",
                email: matched.email || "",
                telephone: matched.telephone || "",
              },
            },
          },
        },
      ]);
      const reasonLabel =
        matched.matchReason === "email"
          ? "email"
          : matched.matchReason === "telephone"
            ? "téléphone"
            : "fratrie";
      setSiblingParentHint(
        `Parent existant détecté (${reasonLabel}) : ${matched.parentLabel || "responsable"}. Sélection automatique — vous pouvez changer via la recherche.`,
      );
      setParent({
        ...emptyParent,
        name: matched.name || "",
        postnom: matched.postnom || "",
        prenom: matched.prenom || "",
        email: matched.email || "",
        telephone: matched.telephone || "",
        address: matched.address || "",
        profession: matched.profession ?? "",
      });
    } else if (guardian) {
      setParentMode("new");
      setParentId("");
      setParentQuery("");
      setParentResults([]);
      setSiblingParentHint("");
      setParent({
        ...emptyParent,
        name: guardian.name,
        postnom: guardian.postnom || "",
        prenom: guardian.prenom || "",
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

  const angolaSecondary = isAngolaSecondarySystem(
    structureType,
    options.educationSystem,
  );
  const angolaNucleoLevel =
    angolaSecondary && isAngolaFirstCycleLevel(level);
  const angolaAreaLevel = angolaSecondary && angolaRequiresArea(level);

  const sectionsForLevel = useMemo(() => {
    const sections = (options.sections ?? []).filter(
      (section: { cycle?: string | null }) =>
        !section.cycle || !structureType || section.cycle === structureType,
    );
    if (structureType !== "SECONDAIRE" || !level) return sections;
    if (angolaNucleoLevel) {
      return sections.filter(
        (section: { codeSection: string }) =>
          section.codeSection === ANGOLA_CICLO1_SECTION_CODE,
      );
    }
    if (angolaAreaLevel) {
      return sections.filter(
        (section: { codeSection: string }) =>
          section.codeSection !== ANGOLA_CICLO1_SECTION_CODE,
      );
    }
    if (isCtebLevel(level)) {
      return sections.filter((section: { codeSection: string; nameSection?: string }) =>
        isCtebSection(section),
      );
    }
    if (isHumanitesLevel(level)) {
      return sections.filter(
        (section: { codeSection: string }) =>
          section.codeSection !== CTEB_SECTION_CODE,
      );
    }
    return sections;
  }, [
    angolaAreaLevel,
    angolaNucleoLevel,
    level,
    options.sections,
    structureType,
  ]);

  const optionsForSection = useMemo(() => {
    const branchOptions = (options.options ?? []).filter(
      (item: { cycle?: string | null }) =>
        !item.cycle || !structureType || item.cycle === structureType,
    );
    if (structureType !== "SECONDAIRE") return branchOptions;
    if (isCtebLevel(level)) {
      const ctebOptions = branchOptions.filter((item: {
        codeOption?: string;
        nameOption?: string;
        sectionId?: string | null;
      }) => isCtebOption(item));
      if (!sectionId) return ctebOptions;
      const inLockedSection = ctebOptions.filter(
        (item: { sectionId?: string | null }) => item.sectionId === sectionId,
      );
      return inLockedSection.length > 0 ? inLockedSection : ctebOptions;
    }
    if (!sectionId) return [];
    const inSection = branchOptions.filter(
      (item: { sectionId?: string | null }) => item.sectionId === sectionId,
    );
    if (angolaNucleoLevel) {
      return inSection.filter((item: { codeOption?: string; nameOption?: string }) =>
        isAngolaNucleoComumOption(item),
      );
    }
    return inSection;
  }, [angolaNucleoLevel, level, options.options, sectionId, structureType]);

  const secondaryHumanitesLevel =
    structureType === "SECONDAIRE" &&
    requiresSectionForClass(
      structureType,
      level,
      options.educationSystem,
    ) &&
    !angolaNucleoLevel;

  const optionChoices = useMemo(() => {
    if (structureType !== "SECONDAIRE") {
      return (options.options ?? []) as Array<{ id: string; nameOption: string }>;
    }
    if (secondaryHumanitesLevel || isCtebLevel(level) || angolaNucleoLevel) {
      return optionsForSection;
    }
    return (options.options ?? []).filter(
      (item: { cycle?: string | null }) =>
        !item.cycle || !structureType || item.cycle === structureType,
    );
  }, [
    angolaNucleoLevel,
    level,
    options.options,
    optionsForSection,
    secondaryHumanitesLevel,
    structureType,
  ]);
  const optionSelectValue = optionChoices.some(
    (item: { id: string }) => item.id === optionId,
  )
    ? optionId
    : undefined;

  useEffect(() => {
    if (academicCycle || isMultiCycle || !options.typebranch) return;
    if (branchCycles.length === 1) {
      setAcademicCycle(branchCycles[0]);
    }
  }, [
    academicCycle,
    branchCycles,
    isMultiCycle,
    options.typebranch,
  ]);

  useEffect(() => {
    if (!isCtebLevel(level) && !angolaNucleoLevel) return;

    const lockedSection = findCtebSection(options.sections ?? [])
      ?? findCtebSection(options.sections ?? [], "SECONDAIRE");
    const lockedOption = findCtebOption(options.options ?? [])
      ?? findCtebOption(options.options ?? [], "SECONDAIRE");
    const nucleoSection = (options.sections ?? []).find(
      (section: { codeSection: string; id: string; cycle?: string | null }) =>
        section.codeSection === ANGOLA_CICLO1_SECTION_CODE,
    );
    const nucleoOption = (options.options ?? []).find(
      (item: {
        codeOption?: string;
        nameOption?: string;
        id: string;
        sectionId?: string | null;
      }) => isAngolaNucleoComumOption(item),
    );

    const section = angolaNucleoLevel ? nucleoSection : lockedSection;
    const option = angolaNucleoLevel ? nucleoOption : lockedOption;
    const nextSectionId = section?.id ?? option?.sectionId ?? "";
    if (nextSectionId && sectionId !== nextSectionId) {
      setSectionId(nextSectionId);
    }
    if (option && optionId !== option.id) {
      setOptionId(option.id);
    }
  }, [
    angolaNucleoLevel,
    level,
    optionId,
    options.options,
    options.sections,
    sectionId,
    structureType,
  ]);

  useEffect(() => {
    if (
      structureType !== "SECONDAIRE" ||
      !level ||
      isCtebLevel(level) ||
      angolaNucleoLevel
    ) {
      return;
    }
    if (
      sectionId &&
      !sectionsForLevel.some((section: { id: string }) => section.id === sectionId)
    ) {
      setSectionId("");
      setOptionId("");
    }
  }, [angolaNucleoLevel, level, sectionId, sectionsForLevel, structureType]);

  const selectedClasses = useMemo(() => {
    const optionName = (options.options ?? []).find(
      (item: any) => item.id === optionId,
    )?.nameOption;
    return (options.classes ?? []).filter((classe: any) =>
      matchesClassForLevel(classe, {
        typebranch: structureType || options.typebranch,
        educationSystem: options.educationSystem,
        level,
        optionId: allowsOption ? optionId || null : null,
        optionName,
        cycle: structureType || undefined,
      }),
    );
  }, [
    allowsOption,
    level,
    optionId,
    options.classes,
    options.options,
    options.typebranch,
    options.educationSystem,
    structureType,
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
  const generatedParentEmail = useMemo(
    () => previewParentEmail(parent.prenom, parent.name),
    [parent.prenom, parent.name],
  );
  const resolvedParentEmail = parent.email.trim() || generatedParentEmail;
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
  const selectedStudent = useMemo(() => {
    if (!studentId) return null;
    return (
      studentResults.find((item) => item?.id === studentId) ??
      stubPersonItem(studentId, student)
    );
  }, [studentResults, studentId, student]);
  const selectedParent = useMemo(() => {
    if (!parentId) return null;
    return (
      parentResults.find((item) => item?.id === parentId) ??
      stubPersonItem(parentId, parent)
    );
  }, [parentResults, parentId, parent]);
  const hasCreneaux = (options.creneaux?.length ?? 0) > 0;
  const discountClassId = predictedClass?.id ?? selectedClasses[0]?.id ?? "";
  const showDiscountFields = !hidesParent && parentMode === "new";
  const discountEligibleTotal = useMemo(() => {
    if (parent.discountPercentage <= 0) return 0;
    return classFrais.reduce((sum, item) => {
      if (!parent.discountTypeFraisId) return sum;
      if (item.typeFraisId !== parent.discountTypeFraisId) return sum;
      return sum + Math.max(item.montant || 0, 0);
    }, 0);
  }, [classFrais, parent.discountPercentage, parent.discountTypeFraisId]);
  const discountAmount = useMemo(
    () =>
      computeScopedDiscountAmount(
        classFrais.map((item) => ({
          base: item.montant,
          typeFraisId: item.typeFraisId,
        })),
        {
          percentage: parent.discountPercentage,
          typeFraisId: parent.discountTypeFraisId || null,
          typeFraisName: null,
        },
      ),
    [classFrais, parent.discountPercentage, parent.discountTypeFraisId],
  );

  useEffect(() => {
    if (!showDiscountFields || !discountClassId || !schoolYearId) {
      setClassFrais([]);
      return;
    }
    let cancelled = false;
    void getActiveFraisForDiscountPreviewAction({
      classeId: discountClassId,
      schoolYearId,
    }).then(([data, error]) => {
      if (cancelled) return;
      if (error || !data) {
        setClassFrais([]);
        return;
      }
      setClassFrais(data);
    });
    return () => {
      cancelled = true;
    };
  }, [discountClassId, schoolYearId, showDiscountFields]);

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
    setStudentExtra(emptyStudentExtraInfo());
    setFamilyExtra(emptyFamilyExtraInfo());
    setExtraSheetOpen(false);
    setSiblingParentHint("");
    setStudentQuery("");
    setParentQuery("");
    setStudentResults([]);
    setParentResults([]);
    setHistoryOutcome("new");
    setFeeDebtMessage("");
    setAcademicCycle("");
    setLevel("");
    setSectionId("");
    setOptionId("");
    setCreneauId("");
    setClassCapacity("30");
    setCreneauForm(emptyCreneau());
    setClassFrais([]);
    setRequestId("");
    setRequestReference("");
  }

  const searchStudents = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setStudentResults((prev) =>
        studentIdRef.current
          ? prev.filter((item) => item?.id === studentIdRef.current)
          : [],
      );
      return;
    }
    const [data, error] = await findStudentHistoryAction({ query: trimmed });
    if (error) toast.error(error.message);
    else setStudentResults(data ?? []);
  }, []);

  const searchParents = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setParentResults((prev) =>
        parentIdRef.current
          ? prev.filter((item) => item?.id === parentIdRef.current)
          : [],
      );
      return;
    }
    const [data, error] = await findParentForRegistrationAction({
      query: trimmed,
    });
    if (error) toast.error(error.message);
    else setParentResults(data ?? []);
  }, []);

  const parentNameOptions = useMemo(
    () =>
      parentResults.map((item) => {
        const user = userOf(item);
        const fullName =
          `${user?.name ?? ""} ${user?.postnom ?? ""} ${user?.prenom ?? ""}`.trim() ||
          "Parent";
        return {
          value: item.id as string,
          label: fullName,
          search: [
            user?.name,
            user?.postnom,
            user?.prenom,
            user?.email,
            user?.telephone,
          ]
            .filter(Boolean)
            .join(" "),
        };
      }),
    [parentResults],
  );

  function scheduleParentNameSearch(query: string) {
    if (parentNameSearchTimerRef.current != null) {
      window.clearTimeout(parentNameSearchTimerRef.current);
    }
    parentNameSearchTimerRef.current = window.setTimeout(() => {
      void searchParents(query);
    }, 300);
  }

  function selectExistingParentFromNameSearch(parentItemId: string) {
    const item = parentResults.find((entry) => entry.id === parentItemId);
    if (!item) return;
    const user = userOf(item);
    const searchText =
      user?.name?.trim() ||
      `${user?.name ?? ""} ${user?.postnom ?? ""} ${user?.prenom ?? ""}`.trim() ||
      user?.email?.trim() ||
      user?.telephone?.trim() ||
      "";

    setParentMode("existing");
    setParentId("");
    setParentQuery(searchText);
    setParentResults((prev) => {
      if (prev.some((entry) => entry.id === item.id)) return prev;
      return [item, ...prev];
    });
    setSiblingParentHint("");
    toast.message("Cliquez sur le parent dans la liste pour le confirmer.");
  }
  function chooseStudent(item: any) {
    setStudentId(item.id);
    setHistoryOutcome("returning");
    setFeeDebtMessage("");
    setLevel("");
    setSectionId("");
    setOptionId("");

    const user = userOf(item);
    if (user) {
      setStudent((current) => ({
        ...current,
        name: user.name ?? "",
        postnom: user.postnom ?? "",
        prenom: user.prenom ?? "",
        email: user.email ?? "",
        telephone: user.telephone ?? "+243",
      }));
    }

    const currentYearId =
      options.schoolYears.find((year: any) => year.isCurrentYear)?.id ??
      options.schoolYears[0]?.id ??
      "";
    if (currentYearId) setSchoolYearId(currentYearId);

    if (!hidesParent && item.parent?.id) {
      const parentUser = item.parent.branchMember?.member?.user;
      setParentMode("existing");
      setParentId(item.parent.id);
      setParentQuery(
        parentUser?.email?.trim() ||
          parentUser?.telephone?.trim() ||
          `${parentUser?.name ?? ""} ${parentUser?.prenom ?? ""}`.trim() ||
          "",
      );
      setParentResults([item.parent]);
      setSiblingParentHint(
        `Parent déjà lié à cet ${peopleLabels.studentLower} : ${
          `${parentUser?.name ?? ""} ${parentUser?.postnom ?? ""} ${parentUser?.prenom ?? ""}`.trim() ||
          "responsable"
        }. Sélection automatique — réinscription (changement de ${classLabelLower} / ${schoolYearLabelLower}).`,
      );
      setParent({
        ...emptyParent,
        name: parentUser?.name || "",
        postnom: parentUser?.postnom || "",
        prenom: parentUser?.prenom || "",
        email: parentUser?.email || "",
        telephone: parentUser?.telephone || "",
        address: parentUser?.address || "",
        sexe:
          parentUser?.sexe === "F" || parentUser?.sexe === "feminin"
            ? "feminin"
            : "masculin",
        profession: item.parent.profession ?? "",
      });
      toast.success("Parent chargé automatiquement.");
    } else if (!hidesParent) {
      setParentMode("new");
      setParentId("");
      setParentQuery("");
      setParentResults([]);
      setSiblingParentHint("");
      setParent(emptyParent);
      toast.message("Aucun parent lié — sélectionnez ou créez un parent.");
    }
  }

  function ensureCurrentSchoolYear() {
    const currentYearId =
      options.schoolYears.find((year: any) => year.isCurrentYear)?.id ??
      options.schoolYears[0]?.id ??
      "";
    if (currentYearId) setSchoolYearId(currentYearId);
  }

  function applySuggestedClass(suggestion: {
    level: string;
    optionId?: string | null;
    sectionId?: string | null;
    cycle?: string | null;
  }) {
    if (suggestion.cycle) setAcademicCycle(suggestion.cycle);
    setLevel(suggestion.level);
    const nextOptionId = suggestion.optionId ?? "";
    setOptionId(nextOptionId);
    const fromSuggestion = suggestion.sectionId ?? "";
    const fromOptions =
      options.options?.find((item: any) => item.id === nextOptionId)
        ?.sectionId ?? "";
    setSectionId(fromSuggestion || fromOptions || "");
  }

  async function applyHistory(outcome: "passed" | "failed" | "returning") {
    ensureCurrentSchoolYear();

    if (!studentId) {
      return toast.error(`Sélectionnez d'abord un ${peopleLabels.studentLower}.`);
    }

    if (outcome === "returning") {
      setFeeDebtMessage("");
      setHistoryOutcome(outcome);
      setLevel("");
      setSectionId("");
      setOptionId("");
      toast.message(
        `Choisissez manuellement le niveau de retour pour l'${schoolYearLabelLower} actuelle.`,
      );
      return;
    }

    const [suggestion, error] = await suggestNextClassAction({
      studentId,
      outcome,
    });
    if (error) {
      if (outcome === "passed") {
        setFeeDebtMessage(error.message);
        setHistoryOutcome("new");
        setLevel("");
        setSectionId("");
        setOptionId("");
      }
      toast.error(error.message);
      return;
    }

    setFeeDebtMessage("");
    setHistoryOutcome(outcome);
    applySuggestedClass(suggestion);
    toast.success(suggestion.reason);
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
    if (feeDebtMessage) {
      return toast.error(feeDebtMessage);
    }
    if (currentStepKey === "student" && studentMode === "existing" && !studentId)
      return toast.error(`Sélectionnez un ${peopleLabels.studentLower}.`);
    if (
      currentStepKey === "student" &&
      studentMode === "new" &&
      !isStudentStepReady(studentMode, studentId, student)
    )
      return toast.error(
        `Complétez toutes les informations obligatoires de l'${peopleLabels.studentLower}.`,
      );
    if (currentStepKey === "parent" && parentMode === "existing" && !parentId)
      return toast.error("Sélectionnez un parent.");
    if (
      currentStepKey === "parent" &&
      parentMode === "new" &&
      !isParentStepReady(parentMode, parentId, parent)
    )
      return toast.error(
        "Complétez toutes les informations obligatoires du parent.",
      );
    if (currentStepKey === "class") {
      if (isMultiCycle && !academicCycle) {
        return toast.error(tReg("chooseCycleHint"));
      }
      if (!schoolYearId || !level)
        return toast.error(
          tReg("chooseClassHint", { classLabel }),
        );
      if (requiresSectionForClass(structureType, level, options.educationSystem) && !sectionId) {
        return toast.error("Choisissez une section (filière) pour ce niveau.");
      }
      if (requiresOptionForLevel(structureType, level, options.educationSystem) && !optionId) {
        return toast.error("Choisissez une option pour ce niveau.");
      }
      if (selectedClasses.length === 0)
        return toast.error(
          `Aucune ${classLabelLower} n'est configurée pour ce niveau. Créez la première ${classLabelLower}.`,
        );
      if (classesNeedingCapacity)
        return toast.error(
          `Définissez la capacité de l'${classLabelLower} avant de continuer.`,
        );
      if (allClassesFull || !predictedClass)
        return toast.error(
          "Toutes les parallèles sont pleines. Créez la prochaine parallèle avant de continuer.",
        );
      if (
        !hidesParent &&
        parentMode === "new" &&
        parent.discountPercentage > 0 &&
        !parent.discountTypeFraisId
      ) {
        return toast.error(
          "Choisissez le type de frais concerné par la remise.",
        );
      }
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
      cycle: isCycle(academicCycle) ? academicCycle : undefined,
      level,
      optionId: allowsOption ? optionId || undefined : undefined,
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
      parentMode: hidesParent ? "existing" : parentMode,
      parentId: hidesParent ? undefined : parentId || undefined,
      parent:
        hidesParent || parentMode !== "new"
          ? undefined
          : {
              ...parent,
              username: generatedParentUsername,
              dateOfBirth: parent.dateOfBirth
                ? new Date(parent.dateOfBirth)
                : undefined,
            },
      studentExtra,
      familyExtra: hidesParent ? undefined : familyExtra,
      historyOutcome,
      photoUrl: studentMode === "new" ? resolvedPhotoUrl || undefined : undefined,
    });
    setLoading(false);
    if (error) {
      flushAdminDraft();
      return toast.error(error.message);
    }
    stopAndClearAdminDraft();
    toast.success(`Inscription confirmée dans ${result.classeName}`);

    const childUser =
      studentMode === "new" ? student : userOf(selectedStudent);
    const searchName =
      (typeof result.studentSearchName === "string"
        ? result.studentSearchName.trim()
        : "") ||
      [childUser?.name, childUser?.postnom, childUser?.prenom]
        .map((part) => (typeof part === "string" ? part.trim() : ""))
        .filter(Boolean)
        .join(" ") ||
      [parent.name, parent.postnom, parent.prenom]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" ");

    if (organizationId && branchId) {
      const params = new URLSearchParams();
      if (searchName.length >= 2) params.set("q", searchName);
      if (result.enrollmentId) {
        params.set("enrollmentId", String(result.enrollmentId));
      }
      writePaiementBootstrap(branchId, {
        q: searchName,
        enrollmentId: result.enrollmentId ?? "",
      });
      const query = params.toString();
      router.replace(
        `/admin/organizations/${organizationId}/branches/${branchId}/paiement${query ? `?${query}` : ""}`,
      );
      return;
    }

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
    if (!(creneauForm.workingDays?.length > 0)) {
      return toast.error("Sélectionnez au moins un jour ouvrable.");
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

  async function saveClassCapacity(classeId: string, capacityValue: string) {
    const capacity = Number(capacityValue);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      return toast.error(
        `Indiquez une capacité valide pour l'${classLabelLower}.`,
      );
    }
    const [, error] = await updateRegistrationClassCapacityAction({
      classeId,
      capacity,
      schoolYearId: schoolYearId || undefined,
    });
    if (error) return toast.error(error.message);
    toast.success(tReg("capacitySaved"));
    setOptions((current: any) => ({
      ...current,
      classes: (current.classes ?? []).map((classe: any) =>
        classe.id === classeId ? { ...classe, capacity } : classe,
      ),
    }));
  }

  async function createNextParallel() {
    if (!level || !schoolYearId)
      return toast.error(
        `Choisissez d'abord l'${schoolYearLabelLower} et l'${classLabelLower} demandé(e).`,
      );
    if (predictedClass) {
      toast.success(
        `${predictedClass.nameClasse} a encore des places. L'élève y sera inscrit.`,
      );
      return;
    }
    if (requiresSectionForClass(structureType, level, options.educationSystem) && !sectionId) {
      return toast.error("Choisissez une section (filière) pour ce niveau.");
    }
    if (requiresOptionForLevel(structureType, level, options.educationSystem) && !optionId) {
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
      cycle: isCycle(academicCycle) ? academicCycle : undefined,
      optionId: allowsOption ? optionId || undefined : undefined,
      creneauId,
      capacity,
    });
    setCreatingClass(false);
    if (error) {
      if (/places disponibles|classe libre/i.test(error.message)) {
        toast.success(
          predictedClass
            ? `${predictedClass.nameClasse} a encore des places. L'élève y sera inscrit.`
            : "Une classe a encore des places. L'élève y sera inscrit.",
        );
        await loadRegistrationOptions();
        return;
      }
      return toast.error(error.message);
    }
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
              <Field label={tReg("fields.vacationNameRequired")}>
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
              <Field label={tReg("fields.startRequired")} keepLabel>
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
              <Field label={tReg("fields.endRequired")} keepLabel>
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
              <Field label={tReg("fields.breakTimeRequired")} keepLabel>
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
              <Field label={tReg("fields.courseDuration")}>
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
              <Field label={tReg("fields.breakDuration")}>
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
            <div className="space-y-2">
              <Label>Jours ouvrables</Label>
              <p className="text-xs text-muted-foreground">
                Décochez le samedi s&apos;il n&apos;y a pas de cours ce jour-là.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CRENEAU_WEEKDAY_OPTIONS.map((day) => {
                  const checked = (creneauForm.workingDays ?? []).includes(
                    day.value,
                  );
                  return (
                    <label
                      key={day.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/40",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(state) => {
                          setCreneauForm((current) => {
                            const currentDays = current.workingDays ?? [];
                            const next =
                              state === true
                                ? normalizeCreneauWorkingDays([
                                    ...currentDays,
                                    day.value,
                                  ])
                                : currentDays.filter((d) => d !== day.value);
                            return { ...current, workingDays: next };
                          });
                        }}
                      />
                      <span>{day.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <Button disabled={creatingCreneau} onClick={createCreneau}>
              {creatingCreneau ? tReg("actions.creating") : "Créer la vacation"}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={tReg("fields.vacationRequired")}>
              <Select
                value={creneauId || "none"}
                onValueChange={(value: string) =>
                  setCreneauId(value === "none" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={tReg("placeholders.chooseVacation")} />
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
            <Field label={tReg("fields.classCapacityRequired", { classLabel })}>
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
            {creatingClass ? tReg("actions.creating") : buttonLabel}
          </Button>
        )}
      </div>
    );
  }

  function renderPersonFields(
    value: StudentForm | ParentForm,
    setter: (value: any) => void,
    studentFields = false,
    parentNameSearch = false,
  ) {
    return (
      <div className="space-y-3">
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          <Field label={tReg("fields.nameRequired")}>
            {parentNameSearch ? (
              <SearchCombobox
                freeText
                filterItems={false}
                items={parentNameOptions}
                value={value.name}
                onValueChange={(next: string) => {
                  setParent((current) => ({ ...current, name: next }));
                  scheduleParentNameSearch(next);
                }}
                onSelectItem={(item) => {
                  selectExistingParentFromNameSearch(item.value);
                }}
                onCreate={(name) => {
                  setParent((current) => ({ ...current, name }));
                }}
                createLabel={(query) => tReg("createParent", { query })}
                placeholder={tReg("placeholders.parentName")}
                emptyText={tReg("noParentEmpty")}
                showClear
              />
            ) : (
              <Input
                value={value.name}
                onChange={(event) =>
                  updatePerson(value, setter, "name", event.target.value)
                }
              />
            )}
          </Field>
          <Field label={tReg("fields.postnomOptional")}>
            <Input
              value={value.postnom}
              onChange={(event) =>
                updatePerson(value, setter, "postnom", event.target.value)
              }
            />
          </Field>
          <Field label={tReg("fields.prenomOptional")}>
            <Input
              value={value.prenom}
              onChange={(event) =>
                updatePerson(value, setter, "prenom", event.target.value)
              }
            />
          </Field>

          {studentFields ? (
            <>
              <Field label={tReg("fields.dateOfBirthRequired")}>
                <Input
                  type="date"
                  title={tReg("fields.dateOfBirthRequired")}
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
              <Field label={tReg("fields.placeOfBirthOptional")}>
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
              <Field label={tReg("fields.sexRequired")}>
                <Select
                  value={value.sexe}
                  onValueChange={(next: string) =>
                    updatePerson(value, setter, "sexe", next)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculin">{tReg("sex.male")}</SelectItem>
                    <SelectItem value="feminin">{tReg("sex.female")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tReg("fields.addressOptional")}>
                <Input
                  value={value.address}
                  onChange={(event) =>
                    updatePerson(value, setter, "address", event.target.value)
                  }
                />
              </Field>
              {!hidesProvenance ? (
                <Field label={tReg("fields.provenanceOptional")}>
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
              ) : null}
              <Field label={tReg("fields.category")}>
                <Select
                  value={(value as StudentForm).category}
                  onValueChange={(next: string) =>
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
              <Field
                label={tReg("fields.observationOptional")}
                className="md:col-span-2 xl:col-span-3"
              >
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
                      studentStepIndex,
                      isStudentStepReady(studentMode, studentId, student),
                    )
                  }
                  rows={2}
                />
              </Field>
              <Field
                label={peopleLabels.photoOptionalLabel}
                className="md:col-span-2 xl:col-span-3"
                keepLabel
              >
                <div className="flex flex-wrap items-center gap-2">
                  {photoPreview ? (
                    <Image
                      src={photoPreview}
                      alt={peopleLabels.photoPreviewAlt}
                      width={56}
                      height={56}
                      unoptimized
                      className="size-14 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="flex size-14 items-center justify-center rounded-md border border-dashed bg-muted/40 text-muted-foreground">
                      <IconPhotoPlus className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Label className="inline-flex h-8 cursor-pointer items-center rounded-md border bg-background px-2.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                      <IconPhotoPlus className="mr-1.5 h-3.5 w-3.5" />
                      {tReg("actions.browse")}
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
                      className="h-8"
                      onClick={() => setCameraOpen(true)}
                    >
                      <IconCamera className="mr-1.5 h-3.5 w-3.5" />
                      {tReg("actions.camera")}
                    </Button>
                    {photoPreview ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={clearStudentPhoto}
                      >
                        <IconX className="mr-1.5 h-3.5 w-3.5" />
                        {tReg("actions.remove")}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {tReg("photoHint")}
                </p>
              </Field>
            </>
          ) : (
            <>
              <Field label={tReg("fields.addressRequired")}>
                <Input
                  value={value.address}
                  onChange={(event) =>
                    updatePerson(value, setter, "address", event.target.value)
                  }
                />
              </Field>
              <Field label={tReg("fields.phoneOptional")}>
                <Input
                  placeholder={tReg("placeholders.phone")}
                  value={value.telephone}
                  onChange={(event) =>
                    updatePerson(value, setter, "telephone", event.target.value)
                  }
                />
              </Field>
              <Field label={tReg("fields.professionOptional")}>
                <Input
                  placeholder={tReg("placeholders.profession")}
                  value={(value as ParentForm).profession}
                  onChange={(event) =>
                    updatePerson(
                      value,
                      setter,
                      "profession",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label={tReg("fields.emailOptional")}>
                <Input
                  type="email"
                  placeholder={generatedParentEmail}
                  value={value.email}
                  onChange={(event) =>
                    updatePerson(value, setter, "email", event.target.value)
                  }
                />
                {!value.email.trim() ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tReg("emailAutoHint")}{" "}
                    <span className="font-mono">{generatedParentEmail}</span>
                  </p>
                ) : null}
              </Field>
              <Field label={tReg("fields.sexRequired")}>
                <Select
                  value={value.sexe}
                  onValueChange={(next: string) =>
                    updatePerson(value, setter, "sexe", next)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculin">{tReg("sex.male")}</SelectItem>
                    <SelectItem value="feminin">{tReg("sex.female")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
      {requestReference ? (
        <Alert className="xl:col-span-2">
          <IconCheck className="h-4 w-4" />
          <AlertTitle>
            {tReg("requestConfirmed", { reference: requestReference })}
          </AlertTitle>
          <AlertDescription>
            {tReg("requestConfirmedDesc")}

            {siblingParentHint ? (
              <span className="mt-1 block font-medium text-foreground">
                {siblingParentHint}
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <RegistrationExtraInfoSheet
        open={extraSheetOpen}
        onOpenChange={setExtraSheetOpen}
        initialStudent={studentExtra}
        initialFamily={familyExtra}
        hideFamily={hidesParent}
        onSave={async ({ studentExtra: nextStudent, familyExtra: nextFamily }) => {
          setStudentExtra(nextStudent);
          setFamilyExtra(nextFamily);
          return {
            ok: true,
            message: tReg("extraInfoSaved"),
          };
        }}
      />
      <Card
        padding="none"
        className="h-fit overflow-hidden border-sky-200/70 bg-gradient-to-b from-sky-50/80 to-card shadow-sm xl:sticky xl:top-3 dark:border-sky-900/40 dark:from-sky-950/30"
      >
        <CardHeader className="gap-0.5 space-y-0 border-b border-sky-100/80 !p-4 !pb-3 dark:border-sky-900/40">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base font-semibold text-sky-950 dark:text-sky-100">
            {tReg("progress")}
            {draftSavedAt ? (
              <button
                type="button"
                className="rounded-full border border-sky-200 bg-sky-100/70 px-2.5 py-0.5 text-[11px] font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-900/50 dark:text-sky-200"
                title={tReg("draftTitle")}
                onClick={discardAdminDraft}
              >
                {tReg("draft")} · {formatDraftSavedAt(draftSavedAt)}
              </button>
            ) : null}
          </CardTitle>
          <CardDescription className="text-sm text-sky-800/80 dark:text-sky-300/80">
            {tReg("fourSteps")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5 p-4 pt-3">
          <Progress value={((step + 1) / registrationSteps.length) * 100} className="h-2" />
          {registrationStepKeys.map((stepKey, index) => {
            const { label, icon: Icon } = registrationSteps[index];
            const isCurrent = index === step;
            const isDone = index < step;
            const tone = stepTone[stepKey];
            return (
              <div
                key={stepKey}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-300 ease-out",
                  isCurrent
                    ? tone.currentCard
                    : isDone
                      ? "border-emerald-300/80 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30"
                      : tone.idleCard,
                )}
              >
                <div
                  className={cn(
                    "rounded-full p-2 transition-colors duration-300",
                    isCurrent
                      ? tone.currentIcon
                      : isDone
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-medium leading-tight">{label}</p>
                  <p className="mt-0.5 text-xs leading-tight text-muted-foreground">
                    {isDone
                      ? tReg("stepDone")
                      : isCurrent
                        ? tReg("stepCurrent")
                        : tReg("stepLabel", { n: index + 1 })}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card
        padding="none"
        className={cn(
          "flex max-h-[calc(100dvh-12.5rem)] flex-col overflow-hidden border-border/80 shadow-sm md:max-h-[calc(100dvh-8.5rem)]",
        )}
      >
        <CardHeader
          className={cn(
            "shrink-0 gap-0 space-y-0 border-b !px-3 !py-1.5 !pb-1.5",
            currentTone.formHeader,
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0">
              <CardTitle className="text-sm font-semibold leading-none">
                {registrationSteps[step].label}
              </CardTitle>
              <CardDescription className="text-[10px] leading-none">
                {currentStepKey === "class"
                  ? tReg("chooseClassHint", { classLabel })
                  : tReg("requiredHint")}
              </CardDescription>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                "h-5 shrink-0 px-1.5 text-[10px]",
                currentTone.badge,
              )}
            >
              {step + 1}/{registrationSteps.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent
          key={currentStepKey}
          className={cn(
            "animate-fade-in min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 sm:p-4",
            currentTone.fields,
          )}
        >
          {currentStepKey === "student" && (
            <>
              <RadioGroup
                className="grid gap-2 sm:grid-cols-2"
                value={studentMode}
                onValueChange={(value: string) => {
                  setStudentMode(value as any);
                  setHistoryOutcome(value === "new" ? "new" : "returning");
                }}
              >
                <ModeChoice
                  id="student-new"
                  value="new"
                  accent="create"
                  title={peopleLabels.studentNew}
                  description={tReg("mode.newStudentDesc")}
                />
                <ModeChoice
                  id="student-existing"
                  value="existing"
                  accent="reuse"
                  title={peopleLabels.studentExisting}
                  description={tReg("mode.existingStudentDesc")}
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
                  placeholder={peopleLabels.searchStudent}
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
                            ? tReg("lastClass", { classLabel, name: last.classe?.nameClasse, year: last.schoolYear.nameYear })
                            : tReg("noPreviousEnrollment")
                        }
                      />
                    );
                  })}
                  {studentId && (
                    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                      {!hidesParent && parentId ? (
                        <Alert>
                          <IconCheck className="h-4 w-4" />
                          <AlertTitle>{tReg("parentAutoTitle")}</AlertTitle>
                          <AlertDescription>
                            {siblingParentHint ||
                              tReg("parentAutoDesc")}
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      <div>
                        <Label className="mb-1.5 block text-sm">
                          {peopleLabels.situation}
                        </Label>
                        <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                          {tReg("historyHint", { yearLabel: schoolYearLabel })}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              historyOutcome === "passed" ? "default" : "outline"
                            }
                            onClick={() => void applyHistory("passed")}
                          >
                            {tReg("actions.passed")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              historyOutcome === "failed" ? "default" : "outline"
                            }
                            onClick={() => void applyHistory("failed")}
                          >
                            {tReg("actions.failed")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              historyOutcome === "returning"
                                ? "default"
                                : "outline"
                            }
                            onClick={() => void applyHistory("returning")}
                          >
                            {tReg("actions.returning")}
                          </Button>
                        </div>
                        {feeDebtMessage ? (
                          <Alert variant="destructive" className="mt-2">
                            <IconAlertTriangle className="h-4 w-4" />
                            <AlertTitle>{tReg("feeDebtTitle")}</AlertTitle>
                            <AlertDescription>{feeDebtMessage}</AlertDescription>
                          </Alert>
                        ) : null}
                        {historyOutcome === "passed" ||
                        historyOutcome === "failed" ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {tReg("expectedLevel")}{" "}
                            <span className="font-medium text-foreground">
                              {level
                                ? getClassLevelLabel(
                                    structureType || options.typebranch,
                                    level,
                                    options.educationSystem,
                                  )
                                : "—"}
                            </span>
                            {schoolYearId ? (
                              <>
                                {" "}
                                ·{" "}
                                {
                                  options.schoolYears.find(
                                    (year: any) => year.id === schoolYearId,
                                  )?.nameYear
                                }{" "}
                                {tReg("currentYear")}
                              </>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </SearchPanel>
              )}
            </>
          )}
          {currentStepKey === "parent" && (
            <>
              <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-teal-300/70 bg-teal-50/60 px-3 py-2 transition-colors duration-300 sm:flex-row sm:items-center sm:justify-between dark:border-teal-800 dark:bg-teal-950/30">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight text-teal-950 dark:text-teal-100">
                    {tReg("extraInfoTitle")}
                  </p>
                  <p className="text-[11px] text-teal-800/80 dark:text-teal-300/80">
                    {tReg("extraInfoDesc")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 border-teal-300 bg-background/80 hover:bg-teal-100 dark:border-teal-700 dark:hover:bg-teal-950"
                  onClick={() => setExtraSheetOpen(true)}
                >
                  {tReg("actions.addExtraInfo")}
                </Button>
              </div>
              <RadioGroup
                className="grid gap-2 sm:grid-cols-2"
                value={parentMode}
                onValueChange={(value: string) =>
                  setParentMode(value as any)
                }
              >
                <ModeChoice
                  id="parent-new"
                  value="new"
                  accent="create"
                  title={tReg("mode.newParent")}
                  description={tReg("mode.newParentDesc")}
                />
                <ModeChoice
                  id="parent-existing"
                  value="existing"
                  accent="reuse"
                  title={tReg("mode.existingParent")}
                  description={tReg("mode.existingParentDesc")}
                />
              </RadioGroup>
              <Separator />
              {parentMode === "new" ? (
                renderPersonFields(parent, setParent, false, true)
              ) : (
                <div className="space-y-2">
                  {parentId && siblingParentHint ? (
                    <Alert>
                      <IconCheck className="h-4 w-4" />
                      <AlertTitle>{tReg("parentSelectedTitle")}</AlertTitle>
                      <AlertDescription>{siblingParentHint}</AlertDescription>
                    </Alert>
                  ) : null}
                  <SearchPanel
                    query={parentQuery}
                    setQuery={setParentQuery}
                    onSearch={searchParents}
                    placeholder={tReg("placeholders.searchParent")}
                  >
                    {!parentId && parentResults.length > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {tReg("parentClickHint")}
                      </p>
                    ) : null}
                    {parentResults.map((item) => {
                      const user = userOf(item);
                      return (
                        <ResultButton
                          key={item.id}
                          selected={parentId === item.id}
                          onClick={() => {
                            setParentId(item.id);
                            const user = userOf(item);
                            setParent({
                              ...emptyParent,
                              name: user?.name || "",
                              postnom: user?.postnom || "",
                              prenom: user?.prenom || "",
                              email: user?.email || "",
                              telephone: user?.telephone || "",
                              address: user?.address || "",
                              profession: item.profession ?? "",
                            });
                          }}
                          title={`${user?.name ?? ""} ${user?.postnom ?? ""} ${user?.prenom ?? ""}`}
                          subtitle={`${user?.telephone ?? tReg("summary.noPhone")} — ${user?.email ?? tReg("summary.noEmail")}`}
                        />
                      );
                    })}
                  </SearchPanel>
                </div>
              )}
            </>
          )}
          {currentStepKey === "class" && (
            <div className="space-y-3">
              {hidesParent ? (
                <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-teal-300/70 bg-teal-50/60 px-3 py-2 transition-colors duration-300 sm:flex-row sm:items-center sm:justify-between dark:border-teal-800 dark:bg-teal-950/30">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight text-teal-950 dark:text-teal-100">
                      {tReg("extraInfoTitle")}
                    </p>
                    <p className="text-[11px] text-teal-800/80 dark:text-teal-300/80">
                      {tReg("extraInfoDescStudentOnly")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 border-teal-300 bg-background/80 hover:bg-teal-100 dark:border-teal-700 dark:hover:bg-teal-950"
                    onClick={() => setExtraSheetOpen(true)}
                  >
                    {tReg("actions.addExtraInfo")}
                  </Button>
                </div>
              ) : null}
              {loadingOptions ? (
                <p className="text-muted-foreground">{tReg("loadingClasses", { classLabelPlural })}</p>
              ) : (
                <>
                  {isMultiCycle ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-emerald-900/80 dark:text-emerald-100/80">
                        {tReg("fields.cycleRequired")}
                      </Label>
                      <div
                        className={cn(
                          "grid gap-2",
                          branchCycles.length === 2
                            ? "sm:grid-cols-2"
                            : "sm:grid-cols-3",
                        )}
                      >
                        {branchCycles.map((cycle, index) => (
                          <CycleChoiceCard
                            key={cycle}
                            cycle={cycle}
                            selected={academicCycle === cycle}
                            index={index}
                            hint={
                              cycle === "MATERNELLE"
                                ? tReg("fields.cycleHintMaternelle")
                                : cycle === "PRIMAIRE"
                                  ? tReg("fields.cycleHintPrimaire")
                                  : cycle === "SECONDAIRE"
                                    ? tReg("fields.cycleHintSecondaire")
                                    : tReg("fields.cycleHintOther")
                            }
                            onSelect={() => {
                              setAcademicCycle(cycle);
                              setLevel("");
                              setSectionId("");
                              setOptionId("");
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div
                    className={`grid gap-2.5 ${allowsOption ? "lg:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-3"}`}
                  >
                    <Field label={tReg("fields.schoolYearRequired", { yearLabel: schoolYearLabel })}>
                      <Select
                        value={schoolYearId || undefined}
                        onValueChange={setSchoolYearId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={tReg("placeholders.chooseYear")} />
                        </SelectTrigger>
                        <SelectContent>
                          {options.schoolYears.map((year: any) => (
                            <SelectItem key={year.id} value={year.id}>
                              {year.nameYear}
                              {year.isCurrentYear ? tReg("yearCurrentSuffix") : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={tReg("fields.classLevelRequired", { classLabel })}>
                      <Select
                        key={structureType || "no-cycle"}
                        value={level || undefined}
                        onValueChange={(value: string) => {
                          setLevel(value);
                          const lockCteb = isCtebLevel(value);
                          const lockNucleo =
                            angolaSecondary && isAngolaFirstCycleLevel(value);
                          if (lockCteb || lockNucleo) {
                            const lockedSection = lockNucleo
                              ? (options.sections ?? []).find(
                                  (section: {
                                    codeSection: string;
                                    id: string;
                                  }) =>
                                    section.codeSection ===
                                    ANGOLA_CICLO1_SECTION_CODE,
                                )
                              : findCtebSection(options.sections ?? []) ??
                                findCtebSection(
                                  options.sections ?? [],
                                  "SECONDAIRE",
                                );
                            const lockedOption = lockNucleo
                              ? (options.options ?? []).find(
                                  (item: {
                                    codeOption?: string;
                                    nameOption?: string;
                                    id: string;
                                    sectionId?: string | null;
                                  }) => isAngolaNucleoComumOption(item),
                                )
                              : findCtebOption(options.options ?? []) ??
                                findCtebOption(
                                  options.options ?? [],
                                  "SECONDAIRE",
                                );
                            setSectionId(
                              lockedSection?.id ?? lockedOption?.sectionId ?? "",
                            );
                            setOptionId(lockedOption?.id ?? "");
                            return;
                          }
                          setSectionId("");
                          setOptionId("");
                        }}
                        disabled={isMultiCycle && !academicCycle}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              isMultiCycle && !academicCycle
                                ? tReg("placeholders.chooseCycle")
                                : tReg("placeholders.chooseClass", { classLabel })
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {classLevels.map((item: string) => (
                            <SelectItem key={item} value={item}>
                              {getClassLevelLabel(
                                structureType || options.typebranch,
                                item,
                                options.educationSystem,
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {allowsOption ? (
                      structureType === "SECONDAIRE" ? (
                        <>
                          {secondaryHumanitesLevel ? (
                            <Field label={tReg("fields.sectionTrackRequired")}>
                              <Select
                                key={`section-${structureType}-${level}`}
                                value={
                                  sectionsForLevel.some(
                                    (section: { id: string }) =>
                                      section.id === sectionId,
                                  )
                                    ? sectionId
                                    : undefined
                                }
                                onValueChange={(value: string) => {
                                  setSectionId(value);
                                  setOptionId("");
                                }}
                                disabled={!level}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={tReg("placeholders.chooseSection")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {sectionsForLevel.map(
                                    (section: {
                                      id: string;
                                      nameSection: string;
                                    }) => (
                                      <SelectItem
                                        key={section.id}
                                        value={section.id}
                                      >
                                        {section.nameSection}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </Field>
                          ) : null}
                          <Field
                            label={
                              requiresOptionForLevel(
                                structureType,
                                level,
                                options.educationSystem,
                              )
                                ? tReg("fields.optionRequired")
                                : tReg("fields.option")
                            }
                          >
                            <Select
                              key={`option-${structureType}-${level}-${sectionId}`}
                              value={optionSelectValue}
                              onValueChange={setOptionId}
                              disabled={
                                !level ||
                                isCtebLevel(level) ||
                                angolaNucleoLevel ||
                                (secondaryHumanitesLevel && !sectionId)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    secondaryHumanitesLevel && !sectionId
                                      ? tReg("placeholders.chooseOptionFirst")
                                      : isCtebLevel(level) || angolaNucleoLevel
                                        ? tReg("placeholders.commonCore")
                                        : tReg("placeholders.chooseOption")
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {optionChoices.map((item: any) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.nameOption}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {isCtebLevel(level) || angolaNucleoLevel ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {angolaNucleoLevel
                                  ? "7ª–8ª : Núcleo comum (comme le tronc commun). Pas d'option à choisir."
                                  : tReg("ctebHint")}
                              </p>
                            ) : null}
                          </Field>
                        </>
                      ) : (
                        <Field
                          label={
                            requiresOptionForLevel(structureType, level, options.educationSystem)
                              ? tReg("fields.optionRequired")
                              : tReg("fields.option")
                          }
                        >
                          <Select
                            value={
                              optionId ||
                              (requiresOptionForLevel(structureType, level, options.educationSystem)
                                ? undefined
                                : "none")
                            }
                            onValueChange={(value: string) =>
                              setOptionId(value === "none" ? "" : value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={tReg("placeholders.chooseOption")} />
                            </SelectTrigger>
                            <SelectContent>
                              {!requiresOptionForLevel(
                                structureType,
                                level,
                              ) ? (
                                <SelectItem value="none">{tReg("noOptionItem")}</SelectItem>
                              ) : null}
                              {options.options.map((item: any) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.nameOption}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      )
                    ) : null}
                  </div>
                  {showDiscountFields ? (
                    <div className="grid gap-2.5 md:grid-cols-2">
                      <Field label={tReg("fields.familyDiscountOptional")}>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={parent.discountPercentage}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setParent((current) => ({
                              ...current,
                              discountPercentage: Number.isFinite(next) ? next : 0,
                              discountTypeFraisId:
                                next > 0 ? current.discountTypeFraisId : "",
                            }));
                          }}
                        />
                      </Field>
                      {parent.discountPercentage > 0 ? (
                        <Field label={tReg("fields.discountFeeType")}>
                          <Select
                            value={parent.discountTypeFraisId || undefined}
                            onValueChange={(next: string) =>
                              setParent((current) => ({
                                ...current,
                                discountTypeFraisId: next,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={tReg("placeholders.chooseFeeType")}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {(options.typeFrais ?? []).map(
                                (type: { id: string; nameType: string }) => (
                                  <SelectItem key={type.id} value={type.id}>
                                    {type.nameType}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {tReg("discountHint")}
                          </p>
                        </Field>
                      ) : (
                        <div className="hidden md:block" aria-hidden />
                      )}
                      {parent.discountPercentage > 0 && parent.discountTypeFraisId ? (
                        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm md:col-span-2">
                          {discountEligibleTotal > 0 ? (
                            <p>
                              <span className="font-medium">
                                {tReg("discountAmount", {
                                  amount: formatDiscountAmount(discountAmount),
                                })}
                              </span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {tReg("discountAmountDetail", {
                                  pct: parent.discountPercentage,
                                  total: formatDiscountAmount(discountEligibleTotal),
                                  type:
                                    (options.typeFrais ?? []).find(
                                      (type: { id: string; nameType: string }) =>
                                        type.id === parent.discountTypeFraisId,
                                    )?.nameType ?? "",
                                })}
                              </span>
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {discountClassId
                                ? tReg("discountNoEligibleFees")
                                : tReg("discountNeedClass")}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <Alert>
                    <IconSchool className="h-4 w-4" />
                    <AlertTitle>{tReg("autoAssignTitle")}</AlertTitle>
                    <AlertDescription>
                      {tReg("autoAssignDesc", { classLabel })}
                    </AlertDescription>
                  </Alert>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{tReg("existingParallels")}</h3>
                      <Badge variant="outline" className="text-[11px]">
                        {selectedClasses.length} {classLabelLower}(s)
                      </Badge>
                    </div>
                    {!level ? (
                      <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                        {tReg("selectClassForParallels", { classLabel })}
                      </p>
                    ) : requiresOptionForLevel(
                        structureType,
                        level,
                        options.educationSystem,
                      ) && !optionId ? (
                      <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                        {tReg("chooseOptionForClasses", { classLabelPlural })}
                      </p>
                    ) : (
                      <>
                        {classStats.length > 0 ? (
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {classStats.map((classe: any) => (
                              <ParallelCapacityCard
                                key={classe.id}
                                classe={classe}
                                tReg={tReg}
                                onSaveCapacity={async (value) => {
                                  await saveClassCapacity(classe.id, value);
                                }}
                              />
                            ))}
                          </div>
                        ) : null}

                        {needsClassAction
                          ? renderClassCreationPanel(
                              selectedClasses.length === 0
                                ? tReg("noClassConfigured", { classLabel })
                                : classesNeedingCapacity
                                  ? tReg("capacityToDefine")
                                  : tReg("allParallelsFull"),
                              selectedClasses.length === 0
                                ? tReg("createFirstClass", { classLabel })
                                : classesNeedingCapacity
                                  ? tReg("defineCapacityHint", { classLabelPlural })
                                  : tReg("createNextParallelHint", { classLabel }),
                              selectedClasses.length === 0
                                ? tReg("createClass", { classLabel })
                                : classesNeedingCapacity
                                  ? tReg("defineCapacity")
                                  : tReg("createNextParallel"),
                            )
                          : null}

                        {predictedClass ? (
                          <Alert className="mt-2">
                            <IconCheck className="h-4 w-4" />
                            <AlertTitle>{tReg("plannedAssignTitle")}</AlertTitle>
                            <AlertDescription>
                              {tReg("plannedAssignDesc", {
                                student: peopleLabels.studentLower,
                                className: predictedClass.nameClasse,
                                occupied: predictedClass.occupied + 1,
                                capacity: predictedClass.capacity,
                              })}
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
          {currentStepKey === "confirm" && (
            <div className="space-y-3">
              <Alert>
                <IconCheck className="h-4 w-4" />
                <AlertTitle>{tReg("readyTitle")}</AlertTitle>
                <AlertDescription>
                  {tReg("readyDesc")}
                </AlertDescription>
              </Alert>
              <div className="grid gap-2.5 md:grid-cols-2">
                <Summary
                  title={peopleLabels.student}
                  tone="student"
                  lines={
                    studentMode === "new"
                      ? [
                          `${student.name} ${student.postnom} ${student.prenom}`,
                          tReg("summary.category", { value: student.category }),
                          ...(hidesProvenance
                            ? []
                            : [
                                student.provenanceEcole
                                  ? tReg("summary.provenance", { value: student.provenanceEcole })
                                  : tReg("summary.noProvenance"),
                              ]),
                          photoPreview ? tReg("summary.photoAdded") : tReg("summary.photoMissing"),
                        ]
                      : [
                          personDisplayName(userOf(selectedStudent), student) ||
                            tReg("summary.existingStudent", { student: peopleLabels.student }),
                          tReg("summary.situation", { value: historyLabels[historyOutcome] }),
                          selectedStudent?.classEnrollment?.[0]?.classe
                            ?.nameClasse
                            ? tReg("summary.lastClassSimple", { classLabel, name: selectedStudent.classEnrollment[0].classe.nameClasse })
                            : tReg("noPreviousEnrollment"),
                        ]
                  }
                />
                {!hidesParent ? (
                  <Summary
                    title={tReg("summary.parentTutor")}
                    tone="parent"
                    lines={
                      parentMode === "new"
                        ? [
                            `${parent.name} ${parent.postnom} ${parent.prenom}`,
                            parent.telephone.trim()
                              ? tReg("summary.phone", {
                                  value: parent.telephone,
                                })
                              : tReg("summary.noPhone"),
                            tReg("summary.email", {
                              value: resolvedParentEmail,
                            }) +
                              (parent.email.trim()
                                ? ""
                                : tReg("summary.emailAuto")),
                            ...(parent.profession.trim()
                              ? [
                                  tReg("summary.profession", {
                                    value: parent.profession.trim(),
                                  }),
                                ]
                              : []),
                            parent.discountPercentage
                              ? (() => {
                                  const typeName = (
                                    options.typeFrais ?? []
                                  ).find(
                                    (type: {
                                      id: string;
                                      nameType: string;
                                    }) =>
                                      type.id === parent.discountTypeFraisId,
                                  )?.nameType;
                                  return (
                                    tReg("summary.discount", {
                                      pct: parent.discountPercentage,
                                    }) +
                                    (typeName
                                      ? tReg("summary.discountOn", {
                                          type: typeName,
                                        })
                                      : "") +
                                    (discountAmount > 0
                                      ? tReg("summary.discountValue", {
                                          amount:
                                            formatDiscountAmount(discountAmount),
                                        })
                                      : "")
                                  );
                                })()
                              : tReg("summary.noDiscount"),
                          ]
                        : [
                            personDisplayName(userOf(selectedParent), parent) ||
                              tReg("summary.existingParent"),
                            (userOf(selectedParent)?.telephone ||
                            parent.telephone.trim())
                              ? tReg("summary.phone", {
                                  value:
                                    userOf(selectedParent)?.telephone ||
                                    parent.telephone,
                                })
                              : tReg("summary.noPhone"),
                            (userOf(selectedParent)?.email || parent.email.trim())
                              ? tReg("summary.email", {
                                  value:
                                    userOf(selectedParent)?.email ||
                                    parent.email,
                                })
                              : tReg("summary.noEmail"),
                            ...(selectedParent?.profession
                              ? [
                                  tReg("summary.profession", {
                                    value: selectedParent.profession,
                                  }),
                                ]
                              : []),
                          ]
                    }
                  />
                ) : null}
                <Summary
                  title={tReg("summary.schooling")}
                  tone="school"
                  lines={[
                    options.schoolYears.find(
                      (item: any) => item.id === schoolYearId,
                    )?.nameYear ?? tReg("summary.yearNotChosen"),
                    tReg("summary.requestedLevel", { level }),
                    ...(isMultiCycle && academicCycle
                      ? [cycleLabel(academicCycle)]
                      : []),
                    ...(allowsOption
                      ? [
                          ...(secondaryHumanitesLevel &&
                          sectionsForLevel.find(
                            (item: { id: string }) => item.id === sectionId,
                          )?.nameSection
                            ? [
                                tReg("summary.section", {
                                  value: sectionsForLevel.find(
                                    (item: { id: string }) =>
                                      item.id === sectionId,
                                  )?.nameSection,
                                }),
                              ]
                            : []),
                          options.options.find(
                            (item: any) => item.id === optionId,
                          )?.nameOption
                            ? tReg("summary.option", {
                                value: options.options.find(
                                  (item: any) => item.id === optionId,
                                )?.nameOption,
                              })
                            : tReg("summary.noOption"),
                        ]
                      : []),
                  ]}
                />
                <Summary
                  title={tReg("summary.assignment")}
                  tone="assign"
                  lines={[
                    predictedClass
                      ? tReg("summary.parallel", { name: predictedClass.nameClasse })
                      : tReg("summary.noSeat"),
                    predictedClass
                      ? tReg("summary.seats", { occupied: predictedClass.occupied + 1, capacity: predictedClass.capacity })
                      : classesNeedingCapacity
                        ? tReg("summary.defineCapacityFirst", { classLabel })
                        : tReg("summary.createParallelFirst"),
                    tReg("summary.duplicateProtected"),
                  ]}
                />
              </div>
            </div>
          )}
        </CardContent>
        <div className="z-20 mt-auto flex shrink-0 items-center justify-between gap-2 border-t bg-card px-3 py-2.5 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)]">
          <Button
            variant="outline"
            disabled={step === 0 || loading}
            onClick={goPrevious}
          >
            <IconArrowLeft className="mr-2 h-4 w-4" />
            {tReg("actions.previous")}
          </Button>
          {step < lastStepIndex ? (
            <Button
              disabled={Boolean(feeDebtMessage) || loading}
              onClick={goNext}
            >
              {tReg("actions.continue")}
              <IconArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button disabled={loading} onClick={submit}>
              {loading ? tReg("actions.saving") : tReg("actions.confirm")}
            </Button>
          )}
        </div>
      </Card>
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title={tReg("cameraTitle")}
        onCapture={(file) => {
          applyStudentPhoto(file);
        }}
      />
    </div>
  );
}

function enhanceWithPlaceholder(node: ReactNode, label: string): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;

    const element = child as ReactElement<{
      children?: ReactNode;
      placeholder?: string;
      type?: string;
      "aria-label"?: string;
    }>;
    const props = element.props;
    const typeName =
      typeof element.type === "string"
        ? element.type
        : ((element.type as { displayName?: string; name?: string })
            .displayName ??
          (element.type as { name?: string }).name ??
          "");

    const isInputLike =
      element.type === Input ||
      element.type === Textarea ||
      element.type === SearchCombobox ||
      typeName === "input" ||
      typeName === "textarea";
    const isSelectValue =
      element.type === SelectValue || typeName === "SelectValue";

    const nextChildren =
      props.children != null && !isInputLike
        ? enhanceWithPlaceholder(props.children, label)
        : props.children;

    if (isInputLike) {
      return cloneElement(element, {
        placeholder: label,
        "aria-label": props["aria-label"] ?? label,
        ...(nextChildren !== props.children ? { children: nextChildren } : {}),
      });
    }

    if (isSelectValue) {
      return cloneElement(element, {
        placeholder: label,
        ...(nextChildren !== props.children ? { children: nextChildren } : {}),
      });
    }

    if (nextChildren !== props.children) {
      return cloneElement(element, { children: nextChildren });
    }

    return element;
  });
}

function Field({
  label,
  children,
  className = "",
  keepLabel = false,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Garde le label visible (photo, date, etc.). */
  keepLabel?: boolean;
}) {
  return (
    <div
      className={`[&_input:not([type=file]):not([type=hidden])]:h-8 [&_input:not([type=file]):not([type=hidden])]:px-3 [&_input:not([type=file]):not([type=hidden])]:py-1.5 [&_input:not([type=file]):not([type=hidden])]:text-xs [&_[role=combobox]]:h-8 [&_textarea]:min-h-[52px] [&_textarea]:py-1.5 [&_textarea]:text-xs ${keepLabel ? "space-y-1" : ""} ${className}`}
    >
      <Label className={keepLabel ? "text-xs leading-none" : "sr-only"}>
        {label}
      </Label>
      {keepLabel ? children : enhanceWithPlaceholder(children, label)}
    </div>
  );
}
function ParallelCapacityCard({
  classe,
  tReg,
  onSaveCapacity,
}: {
  classe: {
    id: string;
    nameClasse: string;
    parallel?: string | null;
    occupied: number;
    capacity: number | null;
    hasCapacity: boolean;
    available: boolean;
  };
  tReg: (key: string, values?: Record<string, string | number>) => string;
  onSaveCapacity: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(
    classe.hasCapacity && classe.capacity != null
      ? String(classe.capacity)
      : "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(
      classe.hasCapacity && classe.capacity != null
        ? String(classe.capacity)
        : "",
    );
  }, [classe.id, classe.capacity, classe.hasCapacity]);

  const dirty =
    draft.trim() !==
    (classe.hasCapacity && classe.capacity != null
      ? String(classe.capacity)
      : "");

  async function handleSave() {
    setSaving(true);
    try {
      await onSaveCapacity(draft.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-md border p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm",
        classe.available
          ? "border-emerald-300/80 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/25"
          : classe.hasCapacity
            ? "border-rose-300/80 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/25"
            : "border-amber-300/80 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/25",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <b className="truncate">{classe.nameClasse}</b>
          {classe.parallel ? (
            <p className="text-xs text-muted-foreground">
              {tReg("parallel", { letter: classe.parallel })}
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
          className={
            classe.available
              ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
              : undefined
          }
        >
          {classe.available
            ? tReg("available")
            : classe.hasCapacity
              ? tReg("full")
              : tReg("capacityMissing")}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {classe.hasCapacity && classe.capacity != null
          ? tReg("places", {
              occupied: classe.occupied,
              capacity: classe.capacity,
            })
          : tReg("enrollmentsNoCapacity", { count: classe.occupied })}
      </p>
      {classe.hasCapacity && classe.capacity != null ? (
        <Progress
          className={cn(
            "mt-1.5 h-1.5",
            classe.available ? "[&>div]:bg-emerald-500" : "[&>div]:bg-rose-500",
          )}
          value={Math.min(100, (classe.occupied / classe.capacity) * 100)}
        />
      ) : null}
      <div className="mt-2 flex items-center gap-1.5">
        <Label
          htmlFor={`capacity-${classe.id}`}
          className="shrink-0 text-[10px] text-muted-foreground"
        >
          {tReg("capacityQuickEdit")}
        </Label>
        <Input
          id={`capacity-${classe.id}`}
          type="number"
          min={Math.max(1, classe.occupied)}
          inputSize="sm"
          className="h-7 w-16 px-2 text-xs"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && dirty && !saving) {
              event.preventDefault();
              void handleSave();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant={dirty ? "default" : "outline"}
          className="h-7 px-2 text-[11px]"
          disabled={!dirty || saving || !draft.trim()}
          onClick={() => void handleSave()}
        >
          {saving ? "…" : tReg("capacitySave")}
        </Button>
      </div>
    </div>
  );
}

function CycleChoiceCard({
  cycle,
  selected,
  index,
  hint,
  onSelect,
}: {
  cycle: Cycle;
  selected: boolean;
  index: number;
  hint: string;
  onSelect: () => void;
}) {
  const delayClass =
    index === 0
      ? "animate-delay-75"
      : index === 1
        ? "animate-delay-150"
        : index === 2
          ? "animate-delay-225"
          : "animate-delay-300";

  const visual = (() => {
    switch (cycle) {
      case "MATERNELLE":
        return {
          Icon: IconBabyCarriage,
          shell: selected
            ? "border-rose-400 bg-gradient-to-br from-rose-100 via-rose-50 to-card shadow-md shadow-rose-200/50 ring-2 ring-rose-300/70 dark:border-rose-500 dark:from-rose-950/60 dark:via-rose-950/30 dark:shadow-rose-950/40 dark:ring-rose-700/50"
            : "border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-card hover:border-rose-300 hover:shadow-sm dark:border-rose-900/50 dark:from-rose-950/30",
          iconWrap: selected
            ? "bg-rose-500 text-white shadow-sm shadow-rose-300/60 dark:bg-rose-600"
            : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
          title: "text-rose-950 dark:text-rose-50",
          check: "text-rose-600 dark:text-rose-300",
        };
      case "PRIMAIRE":
        return {
          Icon: IconBackpack,
          shell: selected
            ? "border-sky-400 bg-gradient-to-br from-sky-100 via-sky-50 to-card shadow-md shadow-sky-200/50 ring-2 ring-sky-300/70 dark:border-sky-500 dark:from-sky-950/60 dark:via-sky-950/30 dark:shadow-sky-950/40 dark:ring-sky-700/50"
            : "border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-card hover:border-sky-300 hover:shadow-sm dark:border-sky-900/50 dark:from-sky-950/30",
          iconWrap: selected
            ? "bg-sky-600 text-white shadow-sm shadow-sky-300/60 dark:bg-sky-500"
            : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200",
          title: "text-sky-950 dark:text-sky-50",
          check: "text-sky-600 dark:text-sky-300",
        };
      case "SECONDAIRE":
        return {
          Icon: IconSchool,
          shell: selected
            ? "border-emerald-400 bg-gradient-to-br from-emerald-100 via-emerald-50 to-card shadow-md shadow-emerald-200/50 ring-2 ring-emerald-300/70 dark:border-emerald-500 dark:from-emerald-950/60 dark:via-emerald-950/30 dark:shadow-emerald-950/40 dark:ring-emerald-700/50"
            : "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-card hover:border-emerald-300 hover:shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/30",
          iconWrap: selected
            ? "bg-emerald-600 text-white shadow-sm shadow-emerald-300/60 dark:bg-emerald-500"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
          title: "text-emerald-950 dark:text-emerald-50",
          check: "text-emerald-600 dark:text-emerald-300",
        };
      default:
        return {
          Icon: IconSchool,
          shell: selected
            ? "border-teal-400 bg-gradient-to-br from-teal-100 via-teal-50 to-card shadow-md shadow-teal-200/50 ring-2 ring-teal-300/70 dark:border-teal-500 dark:from-teal-950/60 dark:via-teal-950/30 dark:shadow-teal-950/40 dark:ring-teal-700/50"
            : "border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-card hover:border-teal-300 hover:shadow-sm dark:border-teal-900/50 dark:from-teal-950/30",
          iconWrap: selected
            ? "bg-teal-600 text-white shadow-sm shadow-teal-300/60 dark:bg-teal-500"
            : "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-200",
          title: "text-teal-950 dark:text-teal-50",
          check: "text-teal-600 dark:text-teal-300",
        };
    }
  })();

  const { Icon } = visual;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "animate-cycle-card-in group relative flex w-full items-center gap-2 overflow-hidden rounded-lg border px-2.5 py-1.5 text-left transition-all duration-300 ease-out",
        "hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        delayClass,
        visual.shell,
        selected && "animate-cycle-selected",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-5 -top-5 size-14 rounded-full opacity-25 transition-transform duration-500",
          selected ? "scale-125" : "scale-100 group-hover:scale-110",
          cycle === "MATERNELLE" && "bg-rose-300/40 dark:bg-rose-700/30",
          cycle === "PRIMAIRE" && "bg-sky-300/40 dark:bg-sky-700/30",
          cycle === "SECONDAIRE" && "bg-emerald-300/40 dark:bg-emerald-700/30",
          cycle !== "MATERNELLE" &&
            cycle !== "PRIMAIRE" &&
            cycle !== "SECONDAIRE" &&
            "bg-teal-300/40 dark:bg-teal-700/30",
        )}
      />
      <span
        className={cn(
          "relative flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
          visual.iconWrap,
          selected && "animate-cycle-icon",
        )}
      >
        <Icon size={15} stroke={1.75} />
      </span>
      <span className="relative min-w-0 flex-1 leading-tight">
        <span
          className={cn(
            "block truncate text-xs font-semibold",
            visual.title,
          )}
        >
          {cycleLabel(cycle)}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {hint}
        </span>
      </span>
      {selected ? (
        <IconCheck
          className={cn(
            "relative size-3.5 shrink-0 animate-fade-in",
            visual.check,
          )}
        />
      ) : null}
    </button>
  );
}

function ModeChoice({
  id,
  value,
  title,
  description,
  accent = "create",
}: {
  id: string;
  value: string;
  title: string;
  description: string;
  accent?: "create" | "reuse";
}) {
  const tones =
    accent === "create"
      ? "border-emerald-200/80 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50 has-[[data-state=checked]]:border-emerald-500 has-[[data-state=checked]]:bg-emerald-100/90 has-[[data-state=checked]]:shadow-sm has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-emerald-300/70 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:has-[[data-state=checked]]:border-emerald-500 dark:has-[[data-state=checked]]:bg-emerald-950/50"
      : "border-sky-200/80 bg-sky-50/40 hover:border-sky-300 hover:bg-sky-50 has-[[data-state=checked]]:border-sky-500 has-[[data-state=checked]]:bg-sky-100/90 has-[[data-state=checked]]:shadow-sm has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-sky-300/70 dark:border-sky-900/50 dark:bg-sky-950/20 dark:has-[[data-state=checked]]:border-sky-500 dark:has-[[data-state=checked]]:bg-sky-950/50";

  return (
    <Label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 transition-all duration-300 ease-out hover:-translate-y-0.5 ${tones}`}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span>
        <span className="block text-sm font-semibold leading-tight">{title}</span>
        <span className="mt-0.5 block text-[11px] font-normal leading-snug text-muted-foreground">
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
  onSearch: (query: string) => void | Promise<void>;
  placeholder: string;
  children: React.ReactNode;
}) {
  const [searching, setSearching] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      requestIdRef.current += 1;
      setSearching(false);
      void onSearch(trimmed);
      return;
    }

    const requestId = ++requestIdRef.current;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await onSearch(trimmed);
        } finally {
          if (requestId === requestIdRef.current) {
            setSearching(false);
          }
        }
      })();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="h-9 pl-9"
          autoComplete="off"
        />
      </div>
      {searching ? (
        <p className="text-xs text-muted-foreground">Recherche…</p>
      ) : query.trim().length > 0 && query.trim().length < 2 ? (
        <p className="text-xs text-muted-foreground">
          Saisissez au moins 2 caractères.
        </p>
      ) : null}
      <div className="grid gap-1.5">{children}</div>
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
      className={`rounded-md border px-2.5 py-2 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-sm ${
        selected
          ? "border-sky-500 bg-sky-100/90 shadow-sm ring-1 ring-sky-300/70 dark:border-sky-500 dark:bg-sky-950/50 dark:ring-sky-700/50"
          : "hover:border-sky-200 hover:bg-sky-50/50 dark:hover:border-sky-900 dark:hover:bg-sky-950/20"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{title}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {subtitle}
          </p>
        </div>
        {selected && (
          <IconCheck className="size-4 shrink-0 animate-fade-in text-sky-600 dark:text-sky-400" />
        )}
      </div>
    </button>
  );
}

const summaryTones = {
  student:
    "border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-card dark:border-sky-900/50 dark:from-sky-950/40",
  parent:
    "border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-card dark:border-amber-900/50 dark:from-amber-950/30",
  school:
    "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-card dark:border-emerald-900/50 dark:from-emerald-950/30",
  assign:
    "border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-card dark:border-teal-900/50 dark:from-teal-950/30",
} as const;

const summaryTitleTones = {
  student: "text-sky-900 dark:text-sky-100",
  parent: "text-amber-950 dark:text-amber-100",
  school: "text-emerald-950 dark:text-emerald-100",
  assign: "text-teal-950 dark:text-teal-100",
} as const;

function Summary({
  title,
  lines,
  tone = "student",
}: {
  title: string;
  lines: string[];
  tone?: keyof typeof summaryTones;
}) {
  return (
    <Card
      className={`animate-fade-in overflow-hidden border shadow-sm transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-md ${summaryTones[tone]}`}
    >
      <CardHeader className="space-y-0 p-3 pb-1.5">
        <CardTitle className={`text-sm ${summaryTitleTones[tone]}`}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5 p-3 pt-0 text-xs">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </CardContent>
    </Card>
  );
}
