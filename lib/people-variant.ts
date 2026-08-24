import {
  isCentreFormationBranch,
  isUniversiteBranch,
} from "@/lib/branch-capabilities";

export type PeopleVariant = "school" | "training" | "university";

export function getPeopleVariant(typebranch: unknown): PeopleVariant {
  if (isUniversiteBranch(typebranch)) return "university";
  if (isCentreFormationBranch(typebranch)) return "training";
  return "school";
}

/** Clés nav.json pour élève / enseignant selon le type de branche. */
export function getNavPeopleKeys(typebranch: unknown): {
  student: "student" | "learner" | "universityStudent";
  teacher: "teacher" | "professor";
} {
  const variant = getPeopleVariant(typebranch);
  if (variant === "university") {
    return { student: "universityStudent", teacher: "professor" };
  }
  if (variant === "training") {
    return { student: "learner", teacher: "teacher" };
  }
  return { student: "student", teacher: "teacher" };
}

/** Clés nav.json pour Classe / Groupes / etc. */
export function getNavClassKeys(classLabel: string): {
  singular: string;
  plural: string;
} {
  switch (classLabel) {
    case "Groupe":
      return { singular: "group", plural: "groups" };
    case "Session":
      return { singular: "session", plural: "sessions" };
    case "Auditoire":
      return { singular: "auditorium", plural: "auditoriums" };
    default:
      return { singular: "class", plural: "classes" };
  }
}
