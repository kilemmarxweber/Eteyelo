export const FACE_DESCRIPTOR_SIZE = 128;
/** Plus bas = plus strict. 0,5 limite les homonymes visuels en classe. */
export const FACE_MATCH_THRESHOLD = 0.5;
/** Écart mini avec le 2e meilleur, pour éviter deux visages trop proches. */
export const FACE_MATCH_MARGIN = 0.08;

export type FacePersonType = "student" | "teacher" | "personnel";

export type FaceDescriptorCandidate = {
  personType: FacePersonType;
  personId: string;
  descriptor: number[];
};

export type FaceMatchResult =
  | {
      matched: true;
      personType: FacePersonType;
      personId: string;
      distance: number;
    }
  | { matched: false; reason: "none" | "ambiguous" };

export function parseFaceDescriptor(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== FACE_DESCRIPTOR_SIZE) {
    return null;
  }
  const descriptor: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isFinite(item)) return null;
    descriptor.push(item);
  }
  return descriptor;
}

export function euclideanDistance(a: number[], b: number[]) {
  let sum = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const delta = a[i] - b[i];
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

export function matchFaceDescriptor(
  probe: number[],
  candidates: FaceDescriptorCandidate[],
  threshold = FACE_MATCH_THRESHOLD,
): FaceMatchResult {
  if (probe.length !== FACE_DESCRIPTOR_SIZE || candidates.length === 0) {
    return { matched: false, reason: "none" };
  }

  const ranked = candidates
    .map((candidate) => ({
      personType: candidate.personType,
      personId: candidate.personId,
      distance: euclideanDistance(probe, candidate.descriptor),
    }))
    .sort((left, right) => left.distance - right.distance);

  const best = ranked[0];
  if (!best || best.distance > threshold) {
    return { matched: false, reason: "none" };
  }

  const second = ranked[1];
  if (second && second.distance - best.distance < FACE_MATCH_MARGIN) {
    return { matched: false, reason: "ambiguous" };
  }

  return {
    matched: true,
    personType: best.personType,
    personId: best.personId,
    distance: best.distance,
  };
}
