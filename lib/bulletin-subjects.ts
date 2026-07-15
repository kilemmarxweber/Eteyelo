import type { BulletinPeriodMaxima } from "@/lib/bulletin-maxima";
import type { Subject } from "@/lib/types";

export type SubjectWithMaxima = Subject & { maxima: BulletinPeriodMaxima };

/** Normalise un nom de cours pour comparaison (casse, accents, espaces). */
export function normalizeBulletinSubjectKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function mergeSubjectWithMaxima(
  existing: SubjectWithMaxima,
  incoming: SubjectWithMaxima,
): SubjectWithMaxima {
  return {
    ...existing,
    sem1: { ...existing.sem1, ...incoming.sem1 },
    sem2: { ...existing.sem2, ...incoming.sem2 },
    ...(existing.sem3 || incoming.sem3
      ? { sem3: { ...(existing.sem3 ?? {}), ...(incoming.sem3 ?? {}) } }
      : {}),
    maxima: { ...existing.maxima, ...incoming.maxima },
    baseMaxScore: existing.baseMaxScore || incoming.baseMaxScore,
  };
}

/** Fusionne les sujets qui représentent le même cours (variantes de nom). */
export function dedupeBulletinSubjectsByName(
  subjects: SubjectWithMaxima[],
  resolveKey: (name: string) => string = normalizeBulletinSubjectKey,
  resolveDisplayName: (name: string) => string = (name) => name.trim(),
): SubjectWithMaxima[] {
  const byKey = new Map<string, SubjectWithMaxima>();

  for (const subject of subjects) {
    const key = resolveKey(subject.name);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...subject,
        name: resolveDisplayName(subject.name),
        maxima: { ...subject.maxima },
        sem1: { ...(subject.sem1 ?? {}) },
        sem2: { ...(subject.sem2 ?? {}) },
        ...(subject.sem3 ? { sem3: { ...subject.sem3 } } : {}),
      });
      continue;
    }

    byKey.set(key, mergeSubjectWithMaxima(existing, subject));
  }

  return [...byKey.values()];
}

/**
 * Clé de note fiche : préfère coursId (unique par branche),
 * sinon nom normalisé — évite doublons et cotes répétées.
 */
export function getBulletinNoteSubjectKey(params: {
  coursId?: string | null;
  subjectName: string;
}): string {
  const coursId = params.coursId?.trim();
  if (coursId) return `id:${coursId}`;
  return `name:${normalizeBulletinSubjectKey(params.subjectName)}`;
}

export function getBulletinNoteDisplayName(params: {
  subjectName: string;
  existingName?: string;
}): string {
  return (params.existingName ?? params.subjectName).trim();
}
