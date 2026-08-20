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

export function formatDraftSavedAt(savedAt: number) {
  return new Date(savedAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isMeaningfulPublicDraft(payload: PublicRegistrationDraftPayload) {
  const form = payload.form ?? {};
  const hasFormValue = [
    form.branchId,
    form.name,
    form.postnom,
    form.prenom,
    form.dateOfBirth,
    form.address,
    form.requestedLevel,
  ].some((value) => typeof value === "string" && value.trim().length > 0);
  const hasGuardian = (payload.guardians ?? []).some((item) => {
    if (!item || typeof item !== "object") return false;
    const guardian = item as Record<string, unknown>;
    return [guardian.name, guardian.telephone, guardian.email].some(
      (value) => typeof value === "string" && value.trim().length > 0,
    );
  });
  return (
    hasFormValue ||
    hasGuardian ||
    (payload.queuedStudents?.length ?? 0) > 0
  );
}

export function isMeaningfulAdminDraft(payload: AdminRegistrationDraftPayload) {
  const student = payload.student ?? {};
  const parent = payload.parent ?? {};
  return [
    student.name,
    student.prenom,
    student.postnom,
    parent.name,
    parent.prenom,
    payload.studentId,
    payload.parentId,
    payload.level,
    payload.schoolYearId,
  ].some((value) => typeof value === "string" && value.trim().length > 0);
}
