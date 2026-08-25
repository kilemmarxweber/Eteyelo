/** Brouillon local (localStorage) pour l'inscription — pas d'appel réseau. */

export const REGISTRATION_DRAFT_VERSION = 1 as const;
const PUBLIC_KEY = "eteyelo:inscription-public";
const ADMIN_PREFIX = "eteyelo:inscription-admin:";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const REGISTRATION_DRAFT_DEBOUNCE_MS = 700;

export type PublicRegistrationDraftPayload = {
  step: number;
  branchTypeFilter: string;
  secondGuardian: boolean;
  form: Record<string, unknown>;
  guardians: unknown[];
  studentExtra: Record<string, unknown>;
  familyExtra: Record<string, unknown>;
  /** Photos non persistées (File). */
  queuedStudents: Array<Record<string, unknown>>;
};

export type AdminRegistrationDraftPayload = {
  step: number;
  studentMode: "existing" | "new";
  studentId: string;
  student: Record<string, unknown>;
  parentMode: "existing" | "new";
  parentId: string;
  parent: Record<string, unknown>;
  studentExtra: Record<string, unknown>;
  familyExtra: Record<string, unknown>;
  historyOutcome: string;
  schoolYearId: string;
  cycle?: string;
  level: string;
  sectionId: string;
  optionId: string;
  creneauId: string;
  photoUrl: string;
};

type DraftEnvelope<T> = {
  v: typeof REGISTRATION_DRAFT_VERSION;
  savedAt: number;
  payload: T;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readDraft<T>(storageKey: string): DraftEnvelope<T> | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (
      !parsed ||
      parsed.v !== REGISTRATION_DRAFT_VERSION ||
      typeof parsed.savedAt !== "number" ||
      !parsed.payload
    ) {
      return null;
    }
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft<T>(storageKey: string, payload: T): number {
  if (!canUseStorage()) return 0;
  const savedAt = Date.now();
  const draft: DraftEnvelope<T> = {
    v: REGISTRATION_DRAFT_VERSION,
    savedAt,
    payload,
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(draft));
    return savedAt;
  } catch {
    return 0;
  }
}

function clearDraft(storageKey: string) {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

export function readPublicRegistrationDraft() {
  return readDraft<PublicRegistrationDraftPayload>(PUBLIC_KEY);
}

export function writePublicRegistrationDraft(
  payload: PublicRegistrationDraftPayload,
) {
  return writeDraft(PUBLIC_KEY, payload);
}

export function clearPublicRegistrationDraft() {
  clearDraft(PUBLIC_KEY);
}

export function adminRegistrationDraftKey(branchId: string) {
  return `${ADMIN_PREFIX}${branchId}`;
}

export function readAdminRegistrationDraft(branchId: string) {
  return readDraft<AdminRegistrationDraftPayload>(
    adminRegistrationDraftKey(branchId),
  );
}

export function writeAdminRegistrationDraft(
  branchId: string,
  payload: AdminRegistrationDraftPayload,
) {
  return writeDraft(adminRegistrationDraftKey(branchId), payload);
}

export function clearAdminRegistrationDraft(branchId: string) {
  clearDraft(adminRegistrationDraftKey(branchId));
}

const DRAFT_CLEARED_FLAG = "eteyelo:inscription-draft-cleared";

export function markRegistrationDraftCleared() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DRAFT_CLEARED_FLAG, "1");
  } catch {
    /* ignore */
  }
}

export function consumeRegistrationDraftCleared() {
  if (typeof window === "undefined") return false;
  try {
    if (!sessionStorage.getItem(DRAFT_CLEARED_FLAG)) return false;
    sessionStorage.removeItem(DRAFT_CLEARED_FLAG);
    return true;
  } catch {
    return false;
  }
}

export function formatDraftSavedAt(savedAt: number) {
  return new Date(savedAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const DEFAULT_PHONE_VALUES = new Set(["", "+", "+243"]);

function hasEnteredText(value: unknown) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !DEFAULT_PHONE_VALUES.has(trimmed);
}

function recordHasEnteredText(
  record: Record<string, unknown> | undefined,
  keys: string[],
) {
  if (!record) return false;
  return keys.some((key) => hasEnteredText(record[key]));
}

const PUBLIC_FORM_KEYS = [
  "branchId",
  "name",
  "postnom",
  "prenom",
  "sexe",
  "dateOfBirth",
  "placeOfBirth",
  "address",
  "email",
  "provenanceEcole",
  "requestedLevel",
  "requestedSection",
  "requestedOption",
];

const GUARDIAN_KEYS = [
  "name",
  "postnom",
  "prenom",
  "relationshipPreset",
  "relationshipOther",
  "telephone",
  "email",
  "address",
];

const PERSON_KEYS = [
  "username",
  "name",
  "postnom",
  "prenom",
  "email",
  "telephone",
  "address",
  "dateOfBirth",
  "placeOfBirth",
  "provenanceEcole",
  "observation",
  "profession",
];

const EXTRA_KEYS = [
  "nationalite",
  "autreNationalite",
  "territoireAutreNationalite",
  "langue",
  "nomMere",
  "professionMere",
  "tuteurNom",
  "adresseTuteur",
  "provinceOrigine",
  "territoireOrigine",
  "secteurOrigine",
  "villageOrigine",
];

export function isMeaningfulPublicDraft(payload: PublicRegistrationDraftPayload) {
  if (recordHasEnteredText(payload.form, PUBLIC_FORM_KEYS)) return true;
  if (payload.form?.consentAccepted === true) return true;
  if (
    (payload.guardians ?? []).some((item) => {
      if (!item || typeof item !== "object") return false;
      const guardian = item as Record<string, unknown>;
      return (
        recordHasEnteredText(guardian, GUARDIAN_KEYS) ||
        guardian.sexe === "feminin"
      );
    })
  ) {
    return true;
  }
  if (recordHasEnteredText(payload.studentExtra, EXTRA_KEYS)) return true;
  if (recordHasEnteredText(payload.familyExtra, EXTRA_KEYS)) return true;
  return (payload.queuedStudents?.length ?? 0) > 0;
}

export function isMeaningfulAdminDraft(payload: AdminRegistrationDraftPayload) {
  if (recordHasEnteredText(payload.student, PERSON_KEYS)) return true;
  if (recordHasEnteredText(payload.parent, PERSON_KEYS)) return true;
  if (recordHasEnteredText(payload.studentExtra, EXTRA_KEYS)) return true;
  if (recordHasEnteredText(payload.familyExtra, EXTRA_KEYS)) return true;
  return [
    payload.studentId,
    payload.parentId,
    payload.level,
    payload.sectionId,
    payload.optionId,
    payload.creneauId,
    payload.photoUrl,
  ].some((value) => hasEnteredText(value));
}
