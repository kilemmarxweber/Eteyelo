/**
 * Catalogue RDC des classes / sections / options.
 * Source de vérité pour import, formulaires publics et admin.
 */

export type ClassCatalogSection = {
  codeSection: string;
  nameSection: string;
  /** CTEB = Éducation de Base ; FILIERE = Humanités */
  kind: "CTEB" | "FILIERE";
};

export type ClassCatalogOption = {
  codeOption: string;
  nameOption: string;
  sectionCode: string;
  abbrev: string;
};

export const CLASS_CATALOG_SECTIONS: ClassCatalogSection[] = [
  {
    codeSection: "CTEB",
    nameSection: "Éducation de Base (CTEB)",
    kind: "CTEB",
  },
  {
    codeSection: "SCIE",
    nameSection: "Scientifique",
    kind: "FILIERE",
  },
  {
    codeSection: "LITT",
    nameSection: "Littéraire",
    kind: "FILIERE",
  },
  {
    codeSection: "COMM-AD",
    nameSection: "Commerciale et administrative",
    kind: "FILIERE",
  },
  {
    codeSection: "TECH",
    nameSection: "Techniques",
    kind: "FILIERE",
  },
  {
    codeSection: "PEDA",
    nameSection: "Pédagogiques",
    kind: "FILIERE",
  },
];

export const CLASS_CATALOG_OPTIONS: ClassCatalogOption[] = [
  {
    codeOption: "TRONC-COM",
    nameOption: "Tronc commun",
    sectionCode: "CTEB",
    abbrev: "TC",
  },
  {
    codeOption: "BIO-CHI",
    nameOption: "Biologie-Chimie",
    sectionCode: "SCIE",
    abbrev: "BIO",
  },
  {
    codeOption: "MATH-PHYS",
    nameOption: "Mathématiques - Physique",
    sectionCode: "SCIE",
    abbrev: "MAT",
  },
  {
    codeOption: "LATIN-PHILO",
    nameOption: "Latin - Philosophie",
    sectionCode: "LITT",
    abbrev: "LAT",
  },
  {
    codeOption: "LETT-PHIL",
    nameOption: "Philosophie - Lettres",
    sectionCode: "LITT",
    abbrev: "LET",
  },
  {
    codeOption: "COMM-GEST",
    nameOption: "Commerciale et gestion",
    sectionCode: "COMM-AD",
    abbrev: "COM",
  },
  {
    codeOption: "COMM-SEC-ADM",
    nameOption: "Secrétariat administratif",
    sectionCode: "COMM-AD",
    abbrev: "SEC",
  },
  {
    codeOption: "COMM-COMPTE",
    nameOption: "Comptabilité",
    sectionCode: "COMM-AD",
    abbrev: "CPT",
  },
  {
    codeOption: "TECH-ELEC-GEN",
    nameOption: "Électricité générale",
    sectionCode: "TECH",
    abbrev: "ELE",
  },
  {
    codeOption: "TECH-MECA",
    nameOption: "Mécanique générale",
    sectionCode: "TECH",
    abbrev: "MEC",
  },
  {
    codeOption: "TECH-CONSTR",
    nameOption: "Technique construction",
    sectionCode: "TECH",
    abbrev: "CST",
  },
  {
    codeOption: "TECH-ELEC",
    nameOption: "Électronique",
    sectionCode: "TECH",
    abbrev: "ELN",
  },
  {
    codeOption: "INFO-GEST",
    nameOption: "Informatique de gestion",
    sectionCode: "TECH",
    abbrev: "INF",
  },
  {
    codeOption: "PED-GEN",
    nameOption: "Pédagogie générale",
    sectionCode: "PEDA",
    abbrev: "PDG",
  },
  {
    codeOption: "PED-SCIE",
    nameOption: "Pédagogie des sciences",
    sectionCode: "PEDA",
    abbrev: "PDS",
  },
  {
    codeOption: "PED-LAN",
    nameOption: "Pédagogie des langues",
    sectionCode: "PEDA",
    abbrev: "PDL",
  },
];

export const CTEB_OPTION_CODE = "TRONC-COM";
export const CTEB_SECTION_CODE = "CTEB";

export function getCatalogOptionByCode(code: string) {
  return CLASS_CATALOG_OPTIONS.find((o) => o.codeOption === code);
}

export function getCatalogOptionByName(name: string) {
  const n = name.trim().toLowerCase();
  return CLASS_CATALOG_OPTIONS.find(
    (o) => o.nameOption.toLowerCase() === n,
  );
}

export function getCatalogAbbrevForOptionName(name?: string | null): string {
  if (!name?.trim()) return "";
  return getCatalogOptionByName(name)?.abbrev ?? "";
}

export function getFiliereSections() {
  return CLASS_CATALOG_SECTIONS.filter((s) => s.kind === "FILIERE");
}

export function getCtebSection() {
  return CLASS_CATALOG_SECTIONS.find((s) => s.kind === "CTEB")!;
}

export function getOptionsForSectionCode(sectionCode: string) {
  return CLASS_CATALOG_OPTIONS.filter((o) => o.sectionCode === sectionCode);
}

export function getHumanitesOptions() {
  return CLASS_CATALOG_OPTIONS.filter((o) => o.codeOption !== CTEB_OPTION_CODE);
}

/** Sections + options groupées pour UI (inscription, candidature, admin). */
export function getOrganizedSectionOptionTree(params?: {
  includeCteb?: boolean;
  includeFilieres?: boolean;
}) {
  const includeCteb = params?.includeCteb ?? true;
  const includeFilieres = params?.includeFilieres ?? true;

  return CLASS_CATALOG_SECTIONS.filter((s) => {
    if (s.kind === "CTEB") return includeCteb;
    return includeFilieres;
  }).map((section) => ({
    ...section,
    options: getOptionsForSectionCode(section.codeSection),
  }));
}
