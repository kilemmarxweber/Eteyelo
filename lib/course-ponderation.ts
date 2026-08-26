import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PONDERATION_LEVEL,
  normalizePonderationLevel,
  ponderationMapKey,
} from "@/lib/course-ponderation-shared";

export {
  DEFAULT_PONDERATION_LEVEL,
  normalizePonderationLevel,
  ponderationMapKey,
  resolveCoursePonderation,
} from "@/lib/course-ponderation-shared";

export async function getCoursePonderation(params: {
  branchId: string;
  coursId?: string | null;
  optionId?: string | null;
  level?: string | null;
}) {
  if (!params.coursId || !params.optionId) return 1;

  const level = normalizePonderationLevel(params.level);
  const records = await prisma.coursOptionPonderation.findMany({
    where: {
      branchId: params.branchId,
      coursId: params.coursId,
      optionId: params.optionId,
      level: level
        ? { in: [level, DEFAULT_PONDERATION_LEVEL] }
        : DEFAULT_PONDERATION_LEVEL,
    },
    select: { ponderation: true, level: true },
  });

  const specific = level
    ? records.find((record) => record.level === level)
    : undefined;
  const fallback = records.find(
    (record) => record.level === DEFAULT_PONDERATION_LEVEL,
  );
  return specific?.ponderation ?? fallback?.ponderation ?? 1;
}

export async function getCoursePonderationMap(params: {
  branchId: string;
  pairs: Array<{
    coursId?: string | null;
    optionId?: string | null;
    level?: string | null;
  }>;
}) {
  const pairs = params.pairs.filter(
    (pair): pair is { coursId: string; optionId: string; level?: string | null } =>
      Boolean(pair.coursId) && Boolean(pair.optionId),
  );

  if (!pairs.length) return new Map<string, number>();

  const uniqueOptionPairs = Array.from(
    new Map(
      pairs.map((pair) => [`${pair.coursId}:${pair.optionId}`, pair] as const),
    ).values(),
  );

  const records = await prisma.coursOptionPonderation.findMany({
    where: {
      branchId: params.branchId,
      OR: uniqueOptionPairs.map((pair) => ({
        coursId: pair.coursId,
        optionId: pair.optionId,
      })),
    },
    select: {
      coursId: true,
      optionId: true,
      level: true,
      ponderation: true,
    },
  });

  return new Map(
    records.map((record) => [
      ponderationMapKey(record.coursId, record.optionId, record.level),
      record.ponderation,
    ]),
  );
}
