import { normalizeAngolaCourseKey } from "@/lib/angola-secondary-course-catalog";
import type { SystemPrimaryDomainCode } from "@/lib/primary-domains";

/**
 * Catalogue de l'Ensino primário / 1.º ciclo do ensino básico (1ª–6ª).
 * Abréviations officielles de la Declaração de Estudo.
 */
export type AngolaPrimaryCourseEntry = {
  codeCours: string;
  nameCours: string;
  /** Libellé abrégé sur la Declaração (L. Port, Mat., …). */
  declarationLabel: string;
  description: string;
  sortOrder: number;
  aliases: string[];
  /** Unités de max : 1 → 10 (échelle angolaise du 1.º ciclo). */
  ponderation: number;
  primaryDomain: SystemPrimaryDomainCode;
};

export const ANGOLA_PRIMARY_COURSE_CATALOG: AngolaPrimaryCourseEntry[] = [
  {
    codeCours: "LPORT-PRI",
    nameCours: "Língua Portuguesa",
    declarationLabel: "L. Port",
    description: "Língua Portuguesa",
    sortOrder: 10,
    aliases: [
      "l. port",
      "l.port",
      "lingua portuguesa",
      "portugues",
      "portugais",
      "francais",
      "langue francaise",
    ],
    ponderation: 1,
    primaryDomain: "LANGUES",
  },
  {
    codeCours: "MAT-PRI",
    nameCours: "Matemática",
    declarationLabel: "Mat.",
    description: "Matemática",
    sortOrder: 20,
    aliases: ["mat", "mat.", "matematica", "mathematique", "mathematiques", "math"],
    ponderation: 1,
    primaryDomain: "MATH_SCIENCES_TECH",
  },
  {
    codeCours: "EMEIO",
    nameCours: "Estudo do Meio",
    declarationLabel: "E. Meio",
    description: "Estudo do Meio",
    sortOrder: 30,
    aliases: [
      "e. meio",
      "e.meio",
      "estudo do meio",
      "estudos do meio",
      "environnement",
      "sciences",
    ],
    ponderation: 1,
    primaryDomain: "UNIVERS_SOCIAUX",
  },
  {
    codeCours: "EMP",
    nameCours: "E.M.P",
    declarationLabel: "E.M.P",
    description: "Educação Manual e Plástica",
    sortOrder: 40,
    aliases: [
      "emp",
      "e.m.p",
      "educacao manual",
      "educacao plastica",
      "educacao manual e plastica",
      "educacao visual",
      "arts plastiques",
      "education artistique",
    ],
    ponderation: 1,
    primaryDomain: "ARTS",
  },
  {
    codeCours: "EMUS",
    nameCours: "Educação Musical",
    declarationLabel: "E. Mus",
    description: "Educação Musical",
    sortOrder: 50,
    aliases: ["e. mus", "e.mus", "educacao musical", "musica", "musique"],
    ponderation: 1,
    primaryDomain: "ARTS",
  },
  {
    codeCours: "EFIS-PRI",
    nameCours: "Educação Física",
    declarationLabel: "E. Fis",
    description: "Educação Física",
    sortOrder: 60,
    aliases: [
      "e. fis",
      "e.fis",
      "educacao fisica",
      "education physique",
      "eps",
      "sport",
    ],
    ponderation: 1,
    primaryDomain: "DEVELOPPEMENT",
  },
];

export function matchAngolaPrimaryCourse(name: string) {
  const key = normalizeAngolaCourseKey(name);
  return ANGOLA_PRIMARY_COURSE_CATALOG.find((entry) => {
    if (normalizeAngolaCourseKey(entry.nameCours) === key) return true;
    if (normalizeAngolaCourseKey(entry.declarationLabel) === key) return true;
    return entry.aliases.some(
      (alias) => normalizeAngolaCourseKey(alias) === key,
    );
  });
}
