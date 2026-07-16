/**
 * Catalogue RDC des cours du secondaire (Humanités + CTEB).
 * Les matières sont rattachées aux options via pondération (CoursOptionPonderation).
 * Source de vérité pour import admin et seeds.
 */

import {
  CLASS_CATALOG_OPTIONS,
  CLASS_CATALOG_SECTIONS,
  CTEB_OPTION_CODE,
  type ClassCatalogOption,
} from "@/lib/class-catalog";

/** Portée d'une matière : toutes les options, une section filière, ou une option précise. */
export type SecondaryCourseScope =
  | "ALL"
  | "CTEB"
  | "HUMANITES"
  | string;

export type SecondaryCourseAssignment = {
  scope: SecondaryCourseScope;
  ponderation: number;
};

export type SecondaryCourseCatalogEntry = {
  codeCours: string;
  nameCours: string;
  description: string;
  sortOrder: number;
  aliases?: string[];
  assignments: SecondaryCourseAssignment[];
};

const OPTION_CODES = new Set(CLASS_CATALOG_OPTIONS.map((o) => o.codeOption));
const SECTION_CODES = new Set(CLASS_CATALOG_SECTIONS.map((s) => s.codeSection));

function optionsForSection(sectionCode: string): ClassCatalogOption[] {
  return CLASS_CATALOG_OPTIONS.filter((o) => o.sectionCode === sectionCode);
}

function humanitesOptions(): ClassCatalogOption[] {
  return CLASS_CATALOG_OPTIONS.filter((o) => o.codeOption !== CTEB_OPTION_CODE);
}

/** Résout une portée catalogue en codes option RDC. */
export function resolveScopeToOptionCodes(scope: SecondaryCourseScope): string[] {
  if (scope === "ALL") {
    return CLASS_CATALOG_OPTIONS.map((o) => o.codeOption);
  }
  if (scope === "CTEB") {
    return [CTEB_OPTION_CODE];
  }
  if (scope === "HUMANITES") {
    return humanitesOptions().map((o) => o.codeOption);
  }
  if (OPTION_CODES.has(scope)) {
    return [scope];
  }
  if (SECTION_CODES.has(scope)) {
    return optionsForSection(scope).map((o) => o.codeOption);
  }
  return [];
}

/** Pondérations par code option pour une entrée catalogue (max si chevauchement). */
export function expandSecondaryCoursePonderations(
  entry: SecondaryCourseCatalogEntry,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const { scope, ponderation } of entry.assignments) {
    if (ponderation <= 0) continue;
    for (const code of resolveScopeToOptionCodes(scope)) {
      const prev = map.get(code) ?? 0;
      map.set(code, Math.max(prev, ponderation));
    }
  }
  return map;
}

export function getSecondaryCoursesForOptionCode(optionCode: string) {
  return SECONDARY_COURSE_CATALOG.filter((entry) => {
    const ponderations = expandSecondaryCoursePonderations(entry);
    return (ponderations.get(optionCode) ?? 0) > 0;
  }).map((entry) => ({
    entry,
    ponderation: expandSecondaryCoursePonderations(entry).get(optionCode)!,
  }));
}

export function resolveSecondaryCatalogEntry(
  subjectName: string,
): SecondaryCourseCatalogEntry | undefined {
  const normalized = subjectName.trim().toLowerCase();
  return SECONDARY_COURSE_CATALOG.find((entry) => {
    if (entry.nameCours.toLowerCase() === normalized) return true;
    return entry.aliases?.some((alias) => alias.toLowerCase() === normalized);
  });
}

/**
 * Matières du secondaire RDC — socle commun + spécialités par section / option.
 * Les sections et options doivent déjà exister en base (import catalogue classes).
 */
export const SECONDARY_COURSE_CATALOG: SecondaryCourseCatalogEntry[] = [
  // —— Socle commun (toutes filières + CTEB) ——
  {
    codeCours: "FRAN",
    nameCours: "Français",
    description: "Langue française et littérature",
    sortOrder: 10,
    assignments: [{ scope: "ALL", ponderation: 5 }],
  },
  {
    codeCours: "MATH",
    nameCours: "Mathématiques",
    description: "Mathématiques générales",
    sortOrder: 11,
    assignments: [{ scope: "ALL", ponderation: 5 }],
  },
  {
    codeCours: "ANG",
    nameCours: "Anglais",
    description: "Langue anglaise",
    sortOrder: 12,
    assignments: [{ scope: "ALL", ponderation: 2 }],
  },
  {
    codeCours: "HIST",
    nameCours: "Histoire",
    description: "Histoire générale et du Congo",
    sortOrder: 13,
    assignments: [{ scope: "ALL", ponderation: 2 }],
  },
  {
    codeCours: "GEO",
    nameCours: "Géographie",
    description: "Géographie du Congo et du monde",
    sortOrder: 14,
    assignments: [{ scope: "ALL", ponderation: 2 }],
  },
  {
    codeCours: "ECM",
    nameCours: "Éducation Civique et Morale",
    description: "Civisme et valeurs morales",
    sortOrder: 15,
    assignments: [{ scope: "ALL", ponderation: 1 }],
  },
  {
    codeCours: "EPS",
    nameCours: "Éducation Physique",
    description: "Activités sportives et physiques",
    sortOrder: 16,
    assignments: [{ scope: "ALL", ponderation: 1 }],
  },
  {
    codeCours: "REL",
    nameCours: "Religion",
    description: "Éducation religieuse",
    sortOrder: 17,
    assignments: [{ scope: "ALL", ponderation: 1 }],
  },

  // —— Section Scientifique ——
  {
    codeCours: "PHYS",
    nameCours: "Physique",
    description: "Physique générale",
    sortOrder: 20,
    assignments: [
      { scope: "BIO-CHI", ponderation: 2 },
      { scope: "MATH-PHYS", ponderation: 4 },
    ],
  },
  {
    codeCours: "CHIM",
    nameCours: "Chimie",
    description: "Chimie générale et organique",
    sortOrder: 21,
    assignments: [{ scope: "SCIE", ponderation: 4 }],
  },
  {
    codeCours: "BIO",
    nameCours: "Biologie",
    description: "Sciences de la vie",
    sortOrder: 22,
    assignments: [
      { scope: "BIO-CHI", ponderation: 4 },
      { scope: "MATH-PHYS", ponderation: 2 },
    ],
  },
  {
    codeCours: "SCI",
    nameCours: "Sciences",
    description: "Sciences naturelles",
    sortOrder: 23,
    assignments: [{ scope: "SCIE", ponderation: 2 }],
  },

  // —— Section Littéraire ——
  {
    codeCours: "PHIL",
    nameCours: "Philosophie",
    description: "Philosophie générale",
    sortOrder: 30,
    assignments: [{ scope: "LITT", ponderation: 2 }],
  },
  {
    codeCours: "LITT",
    nameCours: "Littérature",
    description: "Littérature française et africaine",
    sortOrder: 31,
    assignments: [{ scope: "LITT", ponderation: 2 }],
  },
  {
    codeCours: "LAT",
    nameCours: "Latin",
    description: "Langue latine",
    sortOrder: 32,
    assignments: [{ scope: "LATIN-PHILO", ponderation: 2 }],
  },

  // —— Section Commerciale et administrative ——
  {
    codeCours: "COMPTA",
    nameCours: "Comptabilité",
    description: "Comptabilité générale et analytique",
    sortOrder: 40,
    assignments: [
      { scope: "COMM-COMPTE", ponderation: 4 },
      { scope: "COMM-GEST", ponderation: 2 },
      { scope: "COMM-SEC-ADM", ponderation: 1 },
    ],
  },
  {
    codeCours: "ECO",
    nameCours: "Économie",
    description: "Économie générale et d'entreprise",
    sortOrder: 41,
    assignments: [{ scope: "COMM-AD", ponderation: 2 }],
  },
  {
    codeCours: "GEST",
    nameCours: "Gestion",
    description: "Gestion d'entreprise",
    sortOrder: 42,
    assignments: [
      { scope: "COMM-GEST", ponderation: 4 },
      { scope: "COMM-COMPTE", ponderation: 2 },
    ],
  },
  {
    codeCours: "DROIT",
    nameCours: "Droit",
    description: "Droit commercial et civil",
    sortOrder: 43,
    assignments: [{ scope: "COMM-AD", ponderation: 1 }],
  },
  {
    codeCours: "MARK",
    nameCours: "Marketing",
    description: "Techniques de marketing",
    sortOrder: 44,
    assignments: [{ scope: "COMM-GEST", ponderation: 2 }],
  },
  {
    codeCours: "STAT",
    nameCours: "Statistiques",
    description: "Statistiques appliquées",
    sortOrder: 45,
    assignments: [
      { scope: "COMM-COMPTE", ponderation: 2 },
      { scope: "COMM-GEST", ponderation: 2 },
    ],
  },
  {
    codeCours: "SEC-ADM",
    nameCours: "Secrétariat",
    description: "Techniques de secrétariat et bureautique",
    sortOrder: 46,
    assignments: [{ scope: "COMM-SEC-ADM", ponderation: 4 }],
  },

  // —— Section Techniques ——
  {
    codeCours: "ELEC-PRAT",
    nameCours: "Électricité",
    description: "Travaux pratiques d'électricité",
    sortOrder: 50,
    assignments: [
      { scope: "TECH-ELEC-GEN", ponderation: 4 },
      { scope: "TECH-ELEC", ponderation: 2 },
    ],
  },
  {
    codeCours: "MECA-PRAT",
    nameCours: "Mécanique",
    description: "Travaux pratiques de mécanique",
    sortOrder: 51,
    assignments: [{ scope: "TECH-MECA", ponderation: 4 }],
  },
  {
    codeCours: "DESSIN-TECH",
    nameCours: "Dessin Technique",
    description: "Dessin industriel et technique",
    sortOrder: 52,
    assignments: [
      { scope: "TECH-MECA", ponderation: 2 },
      { scope: "TECH-CONSTR", ponderation: 2 },
      { scope: "TECH-ELEC-GEN", ponderation: 2 },
    ],
  },
  {
    codeCours: "TECHNO",
    nameCours: "Technologie",
    description: "Technologie générale",
    sortOrder: 53,
    assignments: [
      { scope: "TECH-CONSTR", ponderation: 2 },
      { scope: "TECH-ELEC-GEN", ponderation: 2 },
    ],
  },
  {
    codeCours: "CONSTR",
    nameCours: "Construction",
    description: "Techniques de construction",
    sortOrder: 54,
    assignments: [{ scope: "TECH-CONSTR", ponderation: 4 }],
  },
  {
    codeCours: "ELEC-THEO",
    nameCours: "Électronique",
    description: "Électronique et circuits",
    sortOrder: 55,
    assignments: [{ scope: "TECH-ELEC", ponderation: 4 }],
  },
  {
    codeCours: "INFO",
    nameCours: "Informatique",
    description: "Initiation à l'informatique",
    sortOrder: 56,
    assignments: [
      { scope: "INFO-GEST", ponderation: 4 },
      { scope: "TECH-ELEC", ponderation: 2 },
    ],
  },
  {
    codeCours: "PROG",
    nameCours: "Programmation",
    description: "Bases de la programmation",
    sortOrder: 57,
    assignments: [{ scope: "INFO-GEST", ponderation: 2 }],
  },
  {
    codeCours: "RESEAU",
    nameCours: "Réseaux",
    description: "Réseaux informatiques",
    sortOrder: 58,
    assignments: [{ scope: "INFO-GEST", ponderation: 2 }],
  },

  // —— Section Pédagogiques ——
  {
    codeCours: "PEDAG",
    nameCours: "Pédagogie",
    description: "Sciences de l'éducation",
    sortOrder: 60,
    assignments: [{ scope: "PEDA", ponderation: 4 }],
  },
  {
    codeCours: "PSYCHO",
    nameCours: "Psychologie",
    description: "Psychologie de l'enfant",
    sortOrder: 61,
    assignments: [{ scope: "PEDA", ponderation: 2 }],
  },
  {
    codeCours: "DIDACT",
    nameCours: "Didactique",
    description: "Méthodes d'enseignement",
    sortOrder: 62,
    assignments: [{ scope: "PEDA", ponderation: 1 }],
  },
  {
    codeCours: "LING",
    nameCours: "Lingala",
    description: "Langue nationale lingala",
    sortOrder: 63,
    assignments: [{ scope: "PED-LAN", ponderation: 2 }],
  },
];
