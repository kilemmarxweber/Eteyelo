"use client";

import { useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import { isUniversiteBranch } from "@/lib/branch-capabilities";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";

export function useNotesLabels(typebranchOverride?: unknown) {
  const { data: session } = useSession();
  const t = useTranslations("cursus.notes");
  const typebranch = typebranchOverride ?? session?.branch?.typebranch;
  const educationSystem = (
    session?.branch as { educationSystem?: string } | null | undefined
  )?.educationSystem;
  const isUniversite = isUniversiteBranch(typebranch);
  const peopleLabels = useBranchPeopleLabels(typebranch);

  return {
    typebranch,
    educationSystem,
    isUniversite,
    sessionLabel: isUniversite ? t("session") : t("period"),
    sessionPlaceholder: isUniversite
      ? t("sessionPlaceholder")
      : t("periodPlaceholder"),
    courseContextLabel: isUniversite
      ? t("courseAndAuditorium")
      : t("courseAndClass"),
    coursesListTitle: isUniversite
      ? t("coursesAndAuditoriums")
      : t("coursesAndClasses"),
    classColumnLabel: isUniversite ? t("auditorium") : t("class"),
    subjectColumnLabel: isUniversite ? t("course") : t("subject"),
    studentPlural: peopleLabels.studentPluralLower,
    studentSingular: peopleLabels.studentLower,
    teacher: peopleLabels.teacher,
    teacherLower: peopleLabels.teacherLower,
    exportClassLabel: isUniversite ? t("auditoriumColon") : t("classColon"),
    exportSessionLabel: isUniversite ? t("sessionColon") : t("periodColon"),
    undefinedClassLabel: isUniversite
      ? t("auditoriumUndefined")
      : t("classUndefined"),
  };
}
