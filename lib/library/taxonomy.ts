import {
  normalizeBranchType,
  type ManagedBranchType,
} from "@/lib/academic-structure";
import { getBranchCapabilities } from "@/lib/branch-capabilities";
import { getPeopleLabels } from "@/lib/people-labels";

/** Cycles Prisma `LibraryCycle` (étendus pour centre / université). */
export type LibraryCycleCode =
  | "PRIMAIRE"
  | "SECONDAIRE"
  | "HUMANITES"
  | "FORMATION"
  | "UNIVERSITE";

export type LibraryTaxonomy = {
  typebranch: ManagedBranchType;
  /** Cycles proposés dans les filtres / formulaire */
  cycles: Array<{ value: LibraryCycleCode; label: string }>;
  /** Cycle par défaut à la création */
  defaultCycle: LibraryCycleCode;
  levels: string[];
  subjects: string[];
  sections: Array<{ value: string; label: string }>;
  /** Libellés UI adaptés (élève / apprenant / étudiant) */
  readerPluralLower: string;
  pageDescriptionManage: string;
  pageDescriptionRead: string;
};

const PRIMARY_SUBJECTS = [
  "Français",
  "Mathématiques",
  "Sciences",
  "Histoire",
  "Géographie",
  "Éducation civique",
  "Éducation physique",
  "Arts",
  "Religion",
  "Lingala",
  "Anglais",
  "Autre",
] as const;

const SECONDARY_SUBJECTS = [
  "Français",
  "Mathématiques",
  "Physique",
  "Chimie",
  "Biologie",
  "Histoire",
  "Géographie",
  "Éducation civique",
  "Anglais",
  "Latin",
  "Informatique",
  "Économie",
  "Comptabilité",
  "Philosophie",
  "Religion",
  "Arts",
  "Technologie",
  "Culture générale",
  "Pédagogie",
  "Commerce",
  "Autre",
] as const;

const TRAINING_SUBJECTS = [
  "Informatique",
  "Bureautique",
  "Comptabilité",
  "Gestion",
  "Entrepreneuriat",
  "Marketing",
  "Langues",
  "Communication",
  "Électricité",
  "Mécanique",
  "Couture",
  "Cuisine",
  "Santé / Secourisme",
  "Développement personnel",
  "Autre",
] as const;

const UNIVERSITY_SUBJECTS = [
  "Droit",
  "Économie",
  "Gestion",
  "Informatique",
  "Mathématiques",
  "Physique",
  "Chimie",
  "Biologie",
  "Médecine",
  "Sciences sociales",
  "Lettres",
  "Langues",
  "Communication",
  "Éducation",
  "Ingénierie",
  "Architecture",
  "Agronomie",
  "Théologie",
  "Autre",
] as const;

const PRIMARY_LEVELS = [
  "1ère primaire",
  "2ème primaire",
  "3ème primaire",
  "4ème primaire",
  "5ème primaire",
  "6ème primaire",
] as const;

const SECONDARY_LEVELS = [
  "7ème / 1ère secondaire",
  "8ème / 2ème secondaire",
  "3ème secondaire",
  "4ème secondaire",
  "5ème secondaire",
  "6ème secondaire / Humanités",
] as const;

const TRAINING_LEVELS = [
  "Module débutant",
  "Module intermédiaire",
  "Module avancé",
  "Certification",
  "Tous niveaux",
] as const;

const UNIVERSITY_LEVELS = [
  "L1",
  "L2",
  "L3",
  "M1",
  "M2",
  "Doctorat",
  "Tous niveaux",
] as const;

function buildTaxonomy(typebranch: ManagedBranchType): LibraryTaxonomy {
  const people = getPeopleLabels(typebranch);
  const caps = getBranchCapabilities(typebranch);

  const base = {
    typebranch,
    readerPluralLower: people.studentPluralLower,
    pageDescriptionManage: `Gérez les manuels PDF et EPUB réservés aux ${people.studentPluralLower} (lecture seule).`,
    pageDescriptionRead: `Consultez vos manuels en lecture seule (${caps.shortLabel}).`,
  };

  switch (typebranch) {
    case "PRIMAIRE":
      return {
        ...base,
        cycles: [{ value: "PRIMAIRE", label: "Primaire" }],
        defaultCycle: "PRIMAIRE",
        levels: [...PRIMARY_LEVELS],
        subjects: [...PRIMARY_SUBJECTS],
        sections: [{ value: "GENERALE", label: "Générale" }],
      };

    case "SECONDAIRE":
      return {
        ...base,
        cycles: [
          { value: "SECONDAIRE", label: "Secondaire (tronc commun)" },
          { value: "HUMANITES", label: "Humanités" },
        ],
        defaultCycle: "SECONDAIRE",
        levels: [...SECONDARY_LEVELS],
        subjects: [...SECONDARY_SUBJECTS],
        sections: [
          { value: "GENERALE", label: "Générale" },
          { value: "LITTERAIRE", label: "Littéraire" },
          { value: "SCIENTIFIQUE", label: "Scientifique" },
          { value: "PEDAGOGIQUE", label: "Pédagogique" },
          { value: "COMMERCIALE", label: "Commerciale" },
          { value: "TECHNIQUE", label: "Technique" },
          { value: "CUT", label: "CUT" },
        ],
      };

    case "CENTRE_FORMATION":
      return {
        ...base,
        cycles: [{ value: "FORMATION", label: "Formation" }],
        defaultCycle: "FORMATION",
        levels: [...TRAINING_LEVELS],
        subjects: [...TRAINING_SUBJECTS],
        sections: [
          { value: "TECHNIQUE", label: "Technique" },
          { value: "PROFESSIONNELLE", label: "Professionnelle" },
          { value: "QUALIFIANTE", label: "Qualifiante" },
        ],
      };

    case "UNIVERSITE":
      return {
        ...base,
        cycles: [{ value: "UNIVERSITE", label: "Université" }],
        defaultCycle: "UNIVERSITE",
        levels: [...UNIVERSITY_LEVELS],
        subjects: [...UNIVERSITY_SUBJECTS],
        sections: [
          { value: "LICENCE", label: "Licence" },
          { value: "MASTER", label: "Master" },
          { value: "DOCTORAT", label: "Doctorat" },
          { value: "GENERALE", label: "Générale" },
        ],
      };

    case "ATELIER":
    default:
      return {
        ...base,
        cycles: [
          { value: "FORMATION", label: "Atelier / Formation" },
          { value: "SECONDAIRE", label: "Secondaire" },
        ],
        defaultCycle: "FORMATION",
        levels: [...TRAINING_LEVELS],
        subjects: [...TRAINING_SUBJECTS],
        sections: [
          { value: "TECHNIQUE", label: "Technique" },
          { value: "PRACTIQUE", label: "Pratique" },
        ],
      };
  }
}

export function getLibraryTaxonomy(typebranch: unknown): LibraryTaxonomy {
  return buildTaxonomy(normalizeBranchType(typebranch));
}

/** Cycles du catalogue seed autorisés pour une branche. */
export function getLibrarySeedCyclesForBranch(
  typebranch: unknown,
): LibraryCycleCode[] {
  return getLibraryTaxonomy(typebranch).cycles.map((c) => c.value);
}

export const LIBRARY_CYCLE_LABELS: Record<LibraryCycleCode, string> = {
  PRIMAIRE: "Primaire",
  SECONDAIRE: "Secondaire",
  HUMANITES: "Humanités",
  FORMATION: "Formation",
  UNIVERSITE: "Université",
};

/** Compat : listes plates (fallback si pas de typebranche). */
export const LIBRARY_SUBJECTS = [
  ...new Set([
    ...PRIMARY_SUBJECTS,
    ...SECONDARY_SUBJECTS,
    ...TRAINING_SUBJECTS,
    ...UNIVERSITY_SUBJECTS,
  ]),
];

export const LIBRARY_LEVELS = [
  ...PRIMARY_LEVELS,
  ...SECONDARY_LEVELS,
  ...TRAINING_LEVELS,
  ...UNIVERSITY_LEVELS,
];

export const LIBRARY_SECTIONS = [
  "GENERALE",
  "LITTERAIRE",
  "SCIENTIFIQUE",
  "PEDAGOGIQUE",
  "COMMERCIALE",
  "TECHNIQUE",
  "CUT",
  "PROFESSIONNELLE",
  "QUALIFIANTE",
  "LICENCE",
  "MASTER",
  "DOCTORAT",
  "PRACTIQUE",
] as const;
