import {
  aggregateBulletinPeriodMaxima,
  type BulletinPeriodMaxima,
} from "@/lib/bulletin-maxima";
import {
  dedupeBulletinSubjectsByName,
  normalizeBulletinSubjectKey,
  type SubjectWithMaxima,
} from "@/lib/bulletin-subjects";

export type { SubjectWithMaxima } from "@/lib/bulletin-subjects";

export type PrimaryDomainCode =
  | "LANGUES"
  | "MATH_SCIENCES_TECH"
  | "UNIVERS_SOCIAUX"
  | "ARTS"
  | "DEVELOPPEMENT";

export type PrimaryCatalogEntry = {
  name: string;
  domain: PrimaryDomainCode;
  section?: string;
  aliases?: string[];
  sortOrder: number;
  /** Maxima période (bulletin RDC) — optionnel, pour pondération future */
  maxPer?: number;
  maxExam?: number;
};

export type PrimarySubjectPlacement = {
  domain: PrimaryDomainCode;
  section: string;
  sortOrder: number;
  /** Si false, pas de ligne section gras (ex. FRANÇAIS retiré). */
  showSectionHeader: boolean;
};

export const PRIMARY_DOMAIN_LABELS: Record<PrimaryDomainCode, string> = {
  LANGUES: "DOMAINE DES LANGUES",
  MATH_SCIENCES_TECH: "DOMAINES DES MATHEMATIQUES, SCIENCES ET TECHNOLOGIE",
  UNIVERS_SOCIAUX: "DOMAINE DE L'UNIVERS SOCIAL ET ENVIRONNEMENT",
  ARTS: "DOMAINE DES ARTS ET CULTURE",
  DEVELOPPEMENT: "DOMAINE DE DEVELOPPEMENT PERSONNEL",
};

/** Libellés courts pour l'UI Settings (selects, onglets). */
export const PRIMARY_DOMAIN_SHORT_LABELS: Record<PrimaryDomainCode, string> = {
  LANGUES: "Langues",
  MATH_SCIENCES_TECH: "Math / Sciences / Tech",
  UNIVERS_SOCIAUX: "Univers social & environnement",
  ARTS: "Arts & culture",
  DEVELOPPEMENT: "Développement personnel",
};

export const PRIMARY_DOMAIN_ORDER: PrimaryDomainCode[] = [
  "LANGUES",
  "MATH_SCIENCES_TECH",
  "UNIVERS_SOCIAUX",
  "ARTS",
  "DEVELOPPEMENT",
];

/** Sections : plus affichées en gras sur le bulletin (domaine suffit). */

/**
 * Les lignes « section » (sans maxima) ne sont plus dessinées sur le bulletin :
 * le domaine au-dessus annonce déjà le regroupement.
 */
export function shouldShowPrimarySectionHeader(
  _section: string | null | undefined,
): boolean {
  return false;
}

export const PRIMARY_COURSE_CATALOG: PrimaryCatalogEntry[] = [
  // —— 1. DOMAINE DES LANGUES ——
  {
    name: "Exp. Orale & V",
    domain: "LANGUES",
    section: "LANGUES CONGOLAISES",
    sortOrder: 10,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Expression orale et vocabulaire", "Exp Orale & V"],
  },
  {
    name: "Grammaire & C",
    domain: "LANGUES",
    section: "LANGUES CONGOLAISES",
    sortOrder: 11,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Grammaire et conjugaison", "Grammaire & Conjugaison"],
  },
  {
    name: "Orth. & Redact",
    domain: "LANGUES",
    section: "LANGUES CONGOLAISES",
    sortOrder: 12,
    maxPer: 5,
    maxExam: 10,
    aliases: ["Orthographe et rédaction", "Orthographe & Redaction"],
  },
  {
    name: "Langues nationales",
    domain: "LANGUES",
    section: "LANGUES CONGOLAISES",
    sortOrder: 13,
    maxPer: 10,
    maxExam: 20,
  },
  {
    name: "Exp. Orale-Reci",
    domain: "LANGUES",
    section: "FRANÇAIS",
    sortOrder: 20,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Expression orale et récitation", "Exp Orale Reci"],
  },
  {
    name: "Orth. Phra. Ecrit",
    domain: "LANGUES",
    section: "FRANÇAIS",
    sortOrder: 21,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Orthographe phrase écrite", "Orthographe Phrases Ecrites"],
  },
  {
    name: "Gram-Conj-Ana",
    domain: "LANGUES",
    section: "FRANÇAIS",
    sortOrder: 22,
    maxPer: 15,
    maxExam: 30,
    aliases: ["Grammaire conjugaison analyse", "Grammaire-Conjugaison-Analyse"],
  },
  {
    name: "Français",
    domain: "LANGUES",
    section: "FRANÇAIS",
    aliases: ["Francais", "FRANCAIS"],
    sortOrder: 25,
    maxPer: 10,
    maxExam: 20,
  },
  {
    name: "LECT.-ECRITURE EN LANGUES CONG",
    domain: "LANGUES",
    sortOrder: 30,
    maxPer: 30,
    maxExam: 60,
    aliases: [
      "Lecture-ecriture en langues congolaises",
      "Lecture écriture langues congolaises",
    ],
  },
  {
    name: "LECT.-ECRITURE EN LANGUES FRAN",
    domain: "LANGUES",
    sortOrder: 31,
    maxPer: 30,
    maxExam: 60,
    aliases: [
      "Lecture-ecriture en langue française",
      "Lecture écriture français",
    ],
  },

  // —— 2. MATH / SCIENCES / TECH ——
  {
    name: "Numération",
    domain: "MATH_SCIENCES_TECH",
    section: "MATHEMATIQUES",
    sortOrder: 40,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Numeration"],
  },
  {
    name: "Opérations",
    domain: "MATH_SCIENCES_TECH",
    section: "MATHEMATIQUES",
    sortOrder: 41,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Operations"],
  },
  {
    name: "Mésures des G",
    domain: "MATH_SCIENCES_TECH",
    section: "MATHEMATIQUES",
    sortOrder: 42,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Mesures des grandeurs", "Mesures des G", "Mésures des grandeurs"],
  },
  {
    name: "Formes Géomé",
    domain: "MATH_SCIENCES_TECH",
    section: "MATHEMATIQUES",
    sortOrder: 43,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Formes géométriques", "Formes Geometriques"],
  },
  {
    name: "Problèmes",
    domain: "MATH_SCIENCES_TECH",
    section: "MATHEMATIQUES",
    sortOrder: 44,
    maxPer: 20,
    maxExam: 40,
    aliases: ["Problemes"],
  },
  {
    name: "Mathématiques",
    domain: "MATH_SCIENCES_TECH",
    section: "MATHEMATIQUES",
    aliases: ["Mathematiques", "MATH"],
    sortOrder: 45,
    maxPer: 10,
    maxExam: 20,
  },
  {
    name: "Sciences",
    domain: "MATH_SCIENCES_TECH",
    section: "SCIENCES",
    sortOrder: 50,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Sciences naturelles", "Initiation scientifique"],
  },
  {
    name: "Technologie",
    domain: "MATH_SCIENCES_TECH",
    section: "TECHNOLOGIE",
    sortOrder: 51,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Education technologique", "Initiation technologique"],
  },

  // —— 3. UNIVERS SOCIAL & ENVIRONNEMENT ——
  {
    name: "Éveil",
    domain: "UNIVERS_SOCIAUX",
    section: "UNIVERS SOCIAL",
    sortOrder: 60,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Eveil", "Éveil scientifique"],
  },
  {
    name: "Histoire",
    domain: "UNIVERS_SOCIAUX",
    section: "UNIVERS SOCIAL",
    sortOrder: 61,
    maxPer: 10,
    maxExam: 20,
  },
  {
    name: "Géographie",
    domain: "UNIVERS_SOCIAUX",
    section: "UNIVERS SOCIAL",
    sortOrder: 62,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Geographie"],
  },
  {
    name: "Environnement",
    domain: "UNIVERS_SOCIAUX",
    section: "UNIVERS SOCIAL",
    sortOrder: 63,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Education à l'environnement", "Étude du milieu"],
  },
  {
    name: "Éducation civique et morale",
    domain: "UNIVERS_SOCIAUX",
    section: "UNIVERS SOCIAL",
    sortOrder: 64,
    maxPer: 10,
    maxExam: 20,
    aliases: ["ECM", "Education civique et morale", "Civisme"],
  },

  // —— 4. ARTS & CULTURE ——
  {
    name: "Éducation artistique",
    domain: "ARTS",
    section: "ARTS",
    sortOrder: 70,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Education artistique", "Arts plastiques", "Dessin"],
  },
  {
    name: "Éducation musicale",
    domain: "ARTS",
    section: "ARTS",
    sortOrder: 71,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Education musicale", "Musique", "Chant"],
  },
  {
    name: "Arts plastiques",
    domain: "ARTS",
    section: "ARTS",
    sortOrder: 72,
    maxPer: 10,
    maxExam: 20,
  },

  // —— 5. DÉVELOPPEMENT PERSONNEL ——
  {
    name: "Éducation physique",
    domain: "DEVELOPPEMENT",
    section: "DEVELOPPEMENT",
    sortOrder: 80,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Education physique", "EPS", "Sport"],
  },
  {
    name: "Éducation à la vie",
    domain: "DEVELOPPEMENT",
    section: "DEVELOPPEMENT",
    sortOrder: 81,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Education a la vie", "EVB", "Education à la vie familiale"],
  },
  {
    name: "Religion",
    domain: "DEVELOPPEMENT",
    section: "DEVELOPPEMENT",
    sortOrder: 82,
    maxPer: 10,
    maxExam: 20,
    aliases: ["Education religieuse", "Religion / Morale"],
  },
];

/** Code stable pour upsert Prisma (unique par branche). */
export function buildPrimaryCatalogCourseCode(entry: PrimaryCatalogEntry): string {
  const compact = entry.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 6);
  return `PRI${String(entry.sortOrder).padStart(2, "0")}${compact || "COU"}`.slice(
    0,
    16,
  );
}

export function getPrimaryCatalogSection(entry: PrimaryCatalogEntry): string | null {
  if (!entry.section) return null;
  if (entry.section === "AUTRES" || entry.section === "AUTRES COURS") return null;
  return entry.section;
}

export type PrimaryBulletinRow =
  | { type: "domain-header"; domain: PrimaryDomainCode; label: string }
  | { type: "section-header"; domain: PrimaryDomainCode; label: string }
  | { type: "course"; domain: PrimaryDomainCode; subject: SubjectWithMaxima }
  | { type: "sous-total"; domain: PrimaryDomainCode; section: string; maxima: BulletinPeriodMaxima; subjects: SubjectWithMaxima[] }
  | { type: "maxima-general"; maxima: BulletinPeriodMaxima };

export type SubjectWithPrimaryPlacement = SubjectWithMaxima & {
  primaryDomain?: PrimaryDomainCode | null;
  primarySection?: string | null;
  domainOrder?: number | null;
};

function resolveCatalogEntry(subjectName: string): PrimaryCatalogEntry | undefined {
  const normalized = normalizeBulletinSubjectKey(subjectName);
  return PRIMARY_COURSE_CATALOG.find((entry) => {
    if (normalizeBulletinSubjectKey(entry.name) === normalized) return true;
    return entry.aliases?.some(
      (alias) => normalizeBulletinSubjectKey(alias) === normalized,
    );
  });
}

/** Placement catalogue (création auto / fallback). */
export function getCatalogPrimaryPlacement(subjectName: string): PrimarySubjectPlacement {
  const catalog = resolveCatalogEntry(subjectName);
  if (catalog) {
    const section = catalog.section ?? "AUTRES";
    return {
      domain: catalog.domain,
      section,
      sortOrder: catalog.sortOrder,
      showSectionHeader: shouldShowPrimarySectionHeader(section),
    };
  }

  return {
    domain: "DEVELOPPEMENT",
    section: "AUTRES COURS",
    sortOrder: 999,
    showSectionHeader: false,
  };
}

export function getPrimarySubjectCanonicalKey(subjectName: string): string {
  const catalog = resolveCatalogEntry(subjectName);
  return catalog
    ? normalizeBulletinSubjectKey(catalog.name)
    : normalizeBulletinSubjectKey(subjectName);
}

export function getPrimarySubjectDisplayName(subjectName: string): string {
  return resolveCatalogEntry(subjectName)?.name ?? subjectName.trim();
}

export function dedupePrimarySubjectsByCanonicalName(
  subjects: SubjectWithMaxima[],
): SubjectWithMaxima[] {
  return dedupeBulletinSubjectsByName(
    subjects,
    getPrimarySubjectCanonicalKey,
    getPrimarySubjectDisplayName,
  );
}

export function resolveSubjectPlacement(
  subject: SubjectWithPrimaryPlacement | string,
): PrimarySubjectPlacement {
  if (typeof subject === "string") {
    return getCatalogPrimaryPlacement(subject);
  }

  if (subject.primaryDomain) {
    const section = subject.primarySection?.trim() || "AUTRES";
    return {
      domain: subject.primaryDomain,
      section,
      sortOrder: subject.domainOrder ?? 500,
      showSectionHeader: shouldShowPrimarySectionHeader(section),
    };
  }

  return getCatalogPrimaryPlacement(subject.name);
}

export function buildPrimaryBulletinRows(
  subjects: SubjectWithPrimaryPlacement[],
): PrimaryBulletinRow[] {
  const rows: PrimaryBulletinRow[] = [];
  const uniqueSubjects = dedupePrimarySubjectsByCanonicalName(
    subjects,
  ) as SubjectWithPrimaryPlacement[];

  // Preserve DB placement fields after dedupe by name key
  const placementByKey = new Map<string, SubjectWithPrimaryPlacement>();
  for (const subject of subjects) {
    const key = getPrimarySubjectCanonicalKey(subject.name);
    const prev = placementByKey.get(key);
    if (!prev || subject.primaryDomain) {
      placementByKey.set(key, subject);
    }
  }

  const placed = uniqueSubjects.map((subject) => {
    const meta = placementByKey.get(getPrimarySubjectCanonicalKey(subject.name));
    const withMeta: SubjectWithPrimaryPlacement = {
      ...subject,
      primaryDomain: meta?.primaryDomain ?? subject.primaryDomain,
      primarySection: meta?.primarySection ?? subject.primarySection,
      domainOrder: meta?.domainOrder ?? subject.domainOrder,
    };
    return {
      subject: withMeta,
      ...resolveSubjectPlacement(withMeta),
    };
  });

  placed.sort((a, b) => {
    const domainDiff =
      PRIMARY_DOMAIN_ORDER.indexOf(a.domain) - PRIMARY_DOMAIN_ORDER.indexOf(b.domain);
    if (domainDiff !== 0) return domainDiff;
    return a.sortOrder - b.sortOrder || a.subject.name.localeCompare(b.subject.name, "fr");
  });

  let currentDomain: PrimaryDomainCode | null = null;
  let currentSection: string | null = null;
  let domainSubjects: SubjectWithMaxima[] = [];

  const flushDomainSousTotal = () => {
    if (!currentDomain || domainSubjects.length === 0) return;
    rows.push({
      type: "sous-total",
      domain: currentDomain,
      section: currentDomain,
      maxima: aggregateBulletinPeriodMaxima(domainSubjects.map((s) => s.maxima)),
      subjects: [...domainSubjects],
    });
    domainSubjects = [];
  };

  for (const item of placed) {
    if (item.domain !== currentDomain) {
      flushDomainSousTotal();
      currentDomain = item.domain;
      currentSection = null;
      rows.push({
        type: "domain-header",
        domain: item.domain,
        label: PRIMARY_DOMAIN_LABELS[item.domain],
      });
    }

    if (item.section !== currentSection) {
      currentSection = item.section;
      // Pas de ligne section (LANGUES CONGOLAISES, MATHEMATIQUES, …) :
      // le titre de domaine suffit pour le regroupement, et ces lignes n'ont pas de maxima.
    }

    rows.push({ type: "course", domain: item.domain, subject: item.subject });
    domainSubjects.push(item.subject);
  }

  flushDomainSousTotal();

  rows.push({
    type: "maxima-general",
    maxima: aggregateBulletinPeriodMaxima(uniqueSubjects.map((s) => s.maxima)),
  });

  return rows;
}
