"use client";

import { useSession } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import { getPeopleVariant } from "@/lib/people-variant";
import {
  DEFAULT_PEOPLE_LABELS,
  getPeopleLabels,
  type PeopleLabels,
} from "@/lib/people-labels";

/** Libellés élève / apprenant / étudiant selon le type de branche et la langue. */
export function useBranchPeopleLabels(typebranchOverride?: unknown): PeopleLabels {
  const { data: session } = useSession();
  const tPeople = useTranslations("people");
  const typebranch = typebranchOverride ?? session?.branch?.typebranch;
  const base = typebranch
    ? getPeopleLabels(typebranch)
    : DEFAULT_PEOPLE_LABELS;
  const variant = getPeopleVariant(typebranch);

  return {
    ...base,
    student: tPeople(`${variant}.student` as never),
    studentPlural: tPeople(`${variant}.studentPlural` as never),
    studentLower: tPeople(`${variant}.studentLower` as never),
    studentPluralLower: tPeople(`${variant}.studentPluralLower` as never),
    teacher: tPeople(`${variant}.teacher` as never),
    teacherPlural: tPeople(`${variant}.teacherPlural` as never),
    teacherLower: tPeople(`${variant}.teacher` as never).toLowerCase(),
    teacherPluralLower: tPeople(`${variant}.teacherPlural` as never).toLowerCase(),
    studentNew: tPeople(`${variant}.studentNew` as never),
    studentExisting: tPeople(`${variant}.studentExisting` as never),
  };
}
