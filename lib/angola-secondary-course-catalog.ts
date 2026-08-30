/**
 * Catalogue du 1.º Ciclo angolais (7ª–8ª) — disciplinas da Declaração de Estudo.
 * 2.º Ciclo (9ª–13ª) réutilise le même socle ; les options spécialisées
 * s'ajoutent ensuite via la pondération par option.
 */

export type AngolaSecondaryCourseEntry = {
  codeCours: string;
  nameCours: string;
  /** Libellé officiel sur la Declaração (DISCIPLINA). */
  declarationLabel: string;
  description: string;
  sortOrder: number;
  aliases: string[];
  /** Unités de max : 2 → 20 (échelle angolaise). */
  ponderation: number;
};

export const ANGOLA_SECONDARY_COURSE_CATALOG: AngolaSecondaryCourseEntry[] = [
  {
    codeCours: "LPORT",
    nameCours: "Língua Portuguesa",
    declarationLabel: "L. PORTUGUESA",
    description: "Língua Portuguesa",
    sortOrder: 10,
    aliases: ["l. portuguesa", "lingua portuguesa", "portugues", "portugais", "portuguesa"],
    ponderation: 2,
  },
  {
    codeCours: "MAT",
    nameCours: "Matemática",
    declarationLabel: "MATEMÁTICA",
    description: "Matemática",
    sortOrder: 20,
    aliases: ["matematica", "mathematique", "mathematiques", "math"],
    ponderation: 2,
  },
  {
    codeCours: "BIO",
    nameCours: "Biologia",
    declarationLabel: "BIOLOGIA",
    description: "Biologia",
    sortOrder: 30,
    aliases: ["biologie", "sciences de la vie"],
    ponderation: 2,
  },
  {
    codeCours: "GEO",
    nameCours: "Geografia",
    declarationLabel: "GEOGRAFIA",
    description: "Geografia",
    sortOrder: 40,
    aliases: ["geographie", "geografia"],
    ponderation: 2,
  },
  {
    codeCours: "HIST",
    nameCours: "História",
    declarationLabel: "HISTÓRIA",
    description: "História",
    sortOrder: 50,
    aliases: ["histoire", "historia"],
    ponderation: 2,
  },
  {
    codeCours: "QUIM",
    nameCours: "Química",
    declarationLabel: "QUÍMICA",
    description: "Química",
    sortOrder: 60,
    aliases: ["chimie", "quimica"],
    ponderation: 2,
  },
  {
    codeCours: "FIS",
    nameCours: "Física",
    declarationLabel: "FÍSICA",
    description: "Física",
    sortOrder: 70,
    aliases: ["physique", "fisica"],
    ponderation: 2,
  },
  {
    codeCours: "EMC",
    nameCours: "E.M.C",
    declarationLabel: "E.M.C",
    description: "Educação Moral e Cívica",
    sortOrder: 80,
    aliases: [
      "educacao moral e civica",
      "e.m.c",
      "emc",
      "education civique",
      "education civique et morale",
    ],
    ponderation: 2,
  },
  {
    codeCours: "ING",
    nameCours: "Inglês",
    declarationLabel: "INGLÊS",
    description: "Inglês",
    sortOrder: 90,
    aliases: ["ingles", "anglais", "english"],
    ponderation: 2,
  },
  {
    codeCours: "EVP",
    nameCours: "E.V.P",
    declarationLabel: "E.V.P",
    description: "Educação Visual e Plástica",
    sortOrder: 100,
    aliases: [
      "educacao visual e plastica",
      "e.v.p",
      "evp",
      "arts plastiques",
      "education artistique",
    ],
    ponderation: 2,
  },
  {
    codeCours: "EDLAB",
    nameCours: "Ed. Laboral",
    declarationLabel: "ED. LABORAL",
    description: "Educação Laboral",
    sortOrder: 110,
    aliases: ["educacao laboral", "ed. laboral", "travaux pratiques", "education au travail"],
    ponderation: 2,
  },
  {
    codeCours: "FRAN",
    nameCours: "Francês",
    declarationLabel: "FRANCÊS",
    description: "Francês",
    sortOrder: 120,
    aliases: ["frances", "francais", "français"],
    ponderation: 2,
  },
  {
    codeCours: "EDFIS",
    nameCours: "Ed. Física",
    declarationLabel: "ED. FÍSICA",
    description: "Educação Física",
    sortOrder: 130,
    aliases: [
      "educacao fisica",
      "ed. fisica",
      "education physique",
      "eps",
    ],
    ponderation: 2,
  },
  {
    codeCours: "REL",
    nameCours: "Religião",
    declarationLabel: "RELIGIÃO",
    description: "Religião",
    sortOrder: 140,
    aliases: ["religiao", "religion", "education religieuse"],
    ponderation: 2,
  },
];

export function normalizeAngolaCourseKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

export function matchAngolaSecondaryCourse(name: string) {
  const key = normalizeAngolaCourseKey(name);
  return ANGOLA_SECONDARY_COURSE_CATALOG.find((entry) => {
    if (normalizeAngolaCourseKey(entry.nameCours) === key) return true;
    if (normalizeAngolaCourseKey(entry.declarationLabel) === key) return true;
    return entry.aliases.some((alias) => normalizeAngolaCourseKey(alias) === key);
  });
}
