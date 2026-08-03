/**
 * Récupère un grand catalogue de livres du domaine public (Gutendex / Project Gutenberg)
 * et les enregistre dans le projet :
 * - prisma/seeds/library-gutenberg-open.json (métadonnées)
 * - .data/library-seed-cache/*.epub (fichiers)
 *
 * Usage:
 *   pnpm library:fetch
 *   LIBRARY_FETCH_LIMIT=200 pnpm library:fetch
 *   LIBRARY_FETCH_LANGS=fr,en pnpm library:fetch
 *   LIBRARY_FETCH_STEM_LIMIT=120 pnpm library:fetch   # maths / tech / info
 *   LIBRARY_FETCH_STEM_ONLY=1 pnpm library:fetch      # uniquement STEM (merge)
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";

type Cycle =
  | "PRIMAIRE"
  | "SECONDAIRE"
  | "HUMANITES"
  | "FORMATION"
  | "UNIVERSITE";

type CatalogEntry = {
  slug: string;
  title: string;
  author: string;
  publisher: string;
  description: string;
  cycle: Cycle;
  level: string;
  subject: string;
  section: string;
  category: string;
  language: string;
  license: string;
  tags: string[];
  gutenbergId?: number;
  epubUrl?: string;
  coverUrl?: string;
};

type GutendexBook = {
  id: number;
  title: string;
  authors: Array<{ name: string }>;
  subjects?: string[];
  bookshelves?: string[];
  languages?: string[];
  formats?: Record<string, string>;
  copyright?: boolean | null;
};

type StemKind = "math" | "tech" | "info";

const LIMIT = Math.min(
  500,
  Math.max(20, Number(process.env.LIBRARY_FETCH_LIMIT || 150)),
);
const STEM_LIMIT = Math.min(
  300,
  Math.max(0, Number(process.env.LIBRARY_FETCH_STEM_LIMIT || 120)),
);
const STEM_ONLY = process.env.LIBRARY_FETCH_STEM_ONLY === "1";
const LANGS = (process.env.LIBRARY_FETCH_LANGS || "fr,en")
  .split(",")
  .map((l) => trim(l))
  .filter(Boolean);

function trim(s: string) {
  return s.trim();
}

const STEM_QUERIES: Array<{
  kind: StemKind;
  url: string;
  label: string;
  anyLang?: boolean;
}> = [
  { kind: "math", label: "topic=mathematics", url: "topic=mathematics&copyright=false" },
  { kind: "math", label: "topic=algebra", url: "topic=algebra&copyright=false" },
  { kind: "math", label: "topic=geometry", url: "topic=geometry&copyright=false" },
  { kind: "math", label: "topic=calculus", url: "topic=calculus&copyright=false" },
  { kind: "math", label: "topic=arithmetic", url: "topic=arithmetic&copyright=false" },
  { kind: "math", label: "search=mathématiques", url: "search=mathématiques&copyright=false" },
  { kind: "math", label: "search=algèbre", url: "search=algèbre&copyright=false" },
  { kind: "math", label: "search=géométrie", url: "search=géométrie&copyright=false" },
  {
    kind: "info",
    label: "topic=computers",
    url: "topic=computers&copyright=false",
    anyLang: true,
  },
  {
    kind: "info",
    label: "topic=computer",
    url: "topic=computer&copyright=false",
    anyLang: true,
  },
  {
    kind: "info",
    label: "search=computing",
    url: "search=computing&copyright=false",
    anyLang: true,
  },
  {
    kind: "info",
    label: "search=programming",
    url: "search=programming&copyright=false",
    anyLang: true,
  },
  {
    kind: "info",
    label: "search=Babbage",
    url: "search=Babbage&copyright=false",
    anyLang: true,
  },
  {
    kind: "info",
    label: "search=analytical engine",
    url: "search=analytical%20engine&copyright=false",
    anyLang: true,
  },
  { kind: "info", label: "topic=logic", url: "topic=logic&copyright=false" },
  { kind: "tech", label: "topic=technology", url: "topic=technology&copyright=false" },
  { kind: "tech", label: "topic=engineering", url: "topic=engineering&copyright=false" },
  { kind: "tech", label: "topic=electricity", url: "topic=electricity&copyright=false" },
  { kind: "tech", label: "topic=mechanics", url: "topic=mechanics&copyright=false" },
  { kind: "tech", label: "search=électricité", url: "search=électricité&copyright=false" },
  { kind: "tech", label: "search=mécanique", url: "search=mécanique&copyright=false" },
  { kind: "tech", label: "search=technologie", url: "search=technologie&copyright=false" },
];

const CACHE_DIR = path.join(process.cwd(), ".data", "library-seed-cache");
const OUT_JSON = path.join(
  process.cwd(),
  "prisma",
  "seeds",
  "library-gutenberg-open.json",
);

const MAX_EPUB_BYTES = 50 * 1024 * 1024;
const NSFW_RE =
  /erotique|érotique|erotica|kama|sexuel|porn|adult|obscen|libertin|galanterie|nudit|anti-justine|justine|fouetteuse|sotadica|escole des filles|sodome|vénus|coote|delices de l.?amour/i;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function matchesStem(kind: StemKind, title: string, subjects: string[]): boolean {
  const blob = `${title} ${subjects.join(" ")}`.toLowerCase();
  if (kind === "math") {
    return /math|algebra|geometry|calculus|arithm|équation|equation|euclid|trigonometry|mathémat|mathématic|number|numer|probability|probabilit|logarithm|prime|fibonacci|flatland|slide rule|geometry|géométr|algèbr/.test(
      blob,
    );
  }
  if (kind === "info") {
    return /computer|computing|informatique|programming|software|algorithm|binary|digital|jargon|cyber|babbage|turing|analytical engine|calculating engine|automat|data process|machine language|fortran|cobol|basic programming|electronics.*comput/.test(
      blob,
    );
  }
  // tech
  return /technology|engineering|electric|mechanic|technolog|industrie|machinery|invention|telegraph|radio|aviation|automobile|engine|steam|locomotive|telephone|wireless|metallurg|construction|civil engineer|mécaniqu|électri/.test(
    blob,
  );
}

function detectStem(
  title: string,
  subjects: string[],
  forced?: StemKind,
): StemKind | null {
  if (forced) {
    return matchesStem(forced, title, subjects) ? forced : null;
  }
  const blob = `${title} ${subjects.join(" ")}`.toLowerCase();
  if (
    /computer|computing|informatique|programming|software|algorithm|binary|digital|jargon file|cyber|logic machine|babbage|turing|analytical engine/.test(
      blob,
    )
  ) {
    return "info";
  }
  if (
    /math|algebra|geometry|calculus|arithm|équation|equation|euclid|trigonometry|mathémat|mathématic/.test(
      blob,
    )
  ) {
    return "math";
  }
  if (
    /technology|engineering|electric|mechanic|technolog|industrie|machinery|invention|telegraph|radio|aviation|automobile/.test(
      blob,
    )
  ) {
    return "tech";
  }
  return null;
}

function subjectForStem(stem: StemKind | null, language: string, subjects: string[]): string {
  if (stem === "math") return "Mathématiques";
  if (stem === "info") return "Informatique";
  if (stem === "tech") return "Technologie";
  const blob = subjects.join(" ").toLowerCase();
  if (/math/.test(blob)) return "Mathématiques";
  if (/science|physics|chemistry|biology/.test(blob)) return "Sciences";
  if (/history|histoire/.test(blob)) return "Histoire";
  if (/geo/.test(blob)) return "Géographie";
  if (/poetry|poésie|drama|théâtre|fiction|roman|novel/.test(blob)) {
    return language === "fr" ? "Français" : "Littérature";
  }
  return language === "fr" ? "Français" : "Littérature";
}

/**
 * STEM → SECONDAIRE / HUMANITES pour apparaître sur les écoles secondaires.
 * Littérature / reste : rotation habituelle.
 */
function pickCycle(
  subjects: string[],
  index: number,
  stem: StemKind | null,
): Cycle {
  if (stem) {
    // Alternance secondaire / humanités (visible sur branche SECONDAIRE)
    return index % 3 === 0 ? "HUMANITES" : "SECONDAIRE";
  }
  const blob = subjects.join(" ").toLowerCase();
  if (
    /children|juvenile|enfant|jeunesse|fairy|conte|alphabet|primer/.test(blob)
  ) {
    return "PRIMAIRE";
  }
  if (/school|éducation|education|pedagog|manuel|textbook/.test(blob)) {
    return "SECONDAIRE";
  }
  if (/history|philosophie|philosophy|classic|littérature|literature|poetry|drama/.test(blob)) {
    return "HUMANITES";
  }
  const rotation: Cycle[] = [
    "PRIMAIRE",
    "SECONDAIRE",
    "HUMANITES",
    "FORMATION",
    "UNIVERSITE",
  ];
  return rotation[index % rotation.length]!;
}

function levelForCycle(cycle: Cycle): string {
  switch (cycle) {
    case "PRIMAIRE":
      return "Tous niveaux primaire";
    case "SECONDAIRE":
      return "Tous niveaux secondaire";
    case "HUMANITES":
      return "Humanités";
    case "FORMATION":
      return "Formation";
    case "UNIVERSITE":
      return "Université";
  }
}

function epubUrlFromFormats(formats?: Record<string, string>): string | null {
  if (!formats) return null;
  const preferred =
    formats["application/epub+zip"] ||
    Object.entries(formats).find(([k]) => k.includes("epub"))?.[1];
  return preferred || null;
}

async function fetchPage(url: string): Promise<{
  count: number;
  next: string | null;
  results: GutendexBook[];
}> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "EteyeloLibrarySeed/1.0",
        },
      });
      if (!res.ok) {
        throw new Error(`Gutendex ${res.status} ${url}`);
      }
      return res.json();
    } catch (error) {
      lastError = error;
      const wait = attempt * 1500;
      console.warn(`  ⚠ retry ${attempt}/4 dans ${wait}ms…`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastError;
}

async function downloadEpub(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "EteyeloLibrarySeed/1.0" },
      redirect: "follow",
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) return false;
    if (buf.length > MAX_EPUB_BYTES) return false;
    await fs.writeFile(dest, buf);
    return true;
  } catch {
    return false;
  }
}

async function loadExistingCatalog(): Promise<CatalogEntry[]> {
  try {
    const raw = await fs.readFile(OUT_JSON, "utf8");
    return JSON.parse(raw) as CatalogEntry[];
  } catch {
    return [];
  }
}

/** Retire les STEM mal classés (sujets Gutendex trop larges). */
function pruneWeakStem(entries: CatalogEntry[]): CatalogEntry[] {
  return entries.filter((e) => {
    if (!e.tags.includes("stem")) return true;
    const kind: StemKind | null =
      e.subject === "Mathématiques"
        ? "math"
        : e.subject === "Informatique"
          ? "info"
          : e.subject === "Technologie"
            ? "tech"
            : null;
    if (!kind) return false;
    return matchesStem(kind, e.title, [e.description]);
  });
}

async function ingestBook(
  book: GutendexBook,
  opts: {
    entries: CatalogEntry[];
    seen: Set<number>;
    forcedStem?: StemKind;
    langHint?: string;
    maxTotal?: number;
  },
): Promise<boolean> {
  const { entries, seen, forcedStem, langHint, maxTotal } = opts;
  if (maxTotal !== undefined && entries.length >= maxTotal) return false;
  if (seen.has(book.id)) return false;
  if (book.copyright === true) return false;

  const subjects = book.subjects ?? [];
  const haystack = `${book.title} ${subjects.join(" ")}`;
  if (NSFW_RE.test(haystack)) return false;

  const epubUrl = epubUrlFromFormats(book.formats);
  if (!epubUrl) return false;

  const stem = detectStem(book.title, subjects, forcedStem);
  // En mode STEM forcé, ignorer hors-sujet
  if (forcedStem && !stem) return false;
  if (forcedStem && stem !== forcedStem) return false;

  seen.add(book.id);
  const author =
    book.authors?.map((a) => a.name).filter(Boolean).join(", ") ||
    "Auteur inconnu";
  const language = book.languages?.[0] || langHint || "en";
  const cycle = pickCycle(subjects, entries.length, stem);
  const subject = subjectForStem(stem, language, subjects);
  const slug = `gutenberg-${book.id}-${slugify(book.title)}`;
  const coverUrl = book.formats?.["image/jpeg"] || undefined;

  const cacheFile = path.join(CACHE_DIR, `${book.id}.epub`);
  let hasFile = false;
  try {
    const st = await fs.stat(cacheFile);
    hasFile = st.size > 1000 && st.size <= MAX_EPUB_BYTES;
  } catch {
    hasFile = false;
  }
  if (!hasFile) {
    process.stdout.write(`    ↓ ${book.id} ${book.title.slice(0, 50)}… `);
    hasFile = await downloadEpub(epubUrl, cacheFile);
    console.log(hasFile ? "ok" : "échec");
    await new Promise((r) => setTimeout(r, 250));
  }

  if (!hasFile) return false;

  const stemTag =
    stem === "math"
      ? "maths"
      : stem === "info"
        ? "informatique"
        : stem === "tech"
          ? "technologie"
          : null;

  entries.push({
    slug,
    title: book.title.slice(0, 240),
    author,
    publisher: "Project Gutenberg",
    description:
      subjects.slice(0, 4).join(" · ") ||
      `Livre du domaine public (Project Gutenberg #${book.id}).`,
    cycle,
    level: levelForCycle(cycle),
    subject,
    section: stem ? "SCIENTIFIQUE" : "GENERALE",
    category: "livre",
    language,
    license: "Public Domain (Project Gutenberg)",
    tags: [
      "gutenberg",
      "open-license",
      "domaine-public",
      language,
      cycle.toLowerCase(),
      ...(stemTag ? [stemTag, "stem"] : []),
    ],
    gutenbergId: book.id,
    epubUrl,
    coverUrl,
  });
  return true;
}

async function fetchPopularByLang(
  entries: CatalogEntry[],
  seen: Set<number>,
) {
  for (const lang of LANGS) {
    let url: string | null =
      `https://gutendex.com/books/?languages=${encodeURIComponent(lang)}&copyright=false`;
    console.log(`\nLangue ${lang} — objectif ${LIMIT} livres au total…`);

    while (url && entries.length < LIMIT) {
      console.log(`  GET ${url}`);
      const page = await fetchPage(url);
      for (const book of page.results) {
        if (entries.length >= LIMIT) break;
        await ingestBook(book, {
          entries,
          seen,
          langHint: lang,
          maxTotal: LIMIT,
        });
      }
      url = page.next;
    }
  }
}

async function fetchStemTopics(
  entries: CatalogEntry[],
  seen: Set<number>,
) {
  if (STEM_LIMIT <= 0) return;

  const perKind = Math.max(10, Math.ceil(STEM_LIMIT / 3));
  const addedByKind: Record<StemKind, number> = {
    math: 0,
    tech: 0,
    info: 0,
  };

  console.log(
    `\nSTEM (maths / tech / info) — objectif +${STEM_LIMIT} (~${perKind}/domaine)…`,
  );

  for (const query of STEM_QUERIES) {
    if (Object.values(addedByKind).reduce((a, b) => a + b, 0) >= STEM_LIMIT) {
      break;
    }
    if (addedByKind[query.kind] >= perKind) continue;

    let url: string | null = `https://gutendex.com/books/?${query.url}`;
    if (!query.anyLang && !query.url.includes("languages=")) {
      url += `&languages=${encodeURIComponent(LANGS.join(","))}`;
    }

    console.log(
      `\n  [${query.kind}] ${query.label} (${addedByKind[query.kind]}/${perKind})`,
    );
    let pages = 0;
    while (
      url &&
      addedByKind[query.kind] < perKind &&
      Object.values(addedByKind).reduce((a, b) => a + b, 0) < STEM_LIMIT &&
      pages < 10
    ) {
      pages += 1;
      console.log(`    GET ${url}`);
      const page = await fetchPage(url);
      for (const book of page.results) {
        if (addedByKind[query.kind] >= perKind) break;
        if (
          Object.values(addedByKind).reduce((a, b) => a + b, 0) >= STEM_LIMIT
        ) {
          break;
        }
        const before = entries.length;
        const ok = await ingestBook(book, {
          entries,
          seen,
          forcedStem: query.kind,
        });
        if (ok && entries.length > before) {
          addedByKind[query.kind] += 1;
        }
      }
      url = page.next;
    }
  }

  console.log(
    `  → STEM ajoutés : maths=${addedByKind.math}, tech=${addedByKind.tech}, info=${addedByKind.info}`,
  );
}

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });

  const existingRaw = await loadExistingCatalog();
  const existing = pruneWeakStem(existingRaw);
  if (existing.length !== existingRaw.length) {
    console.log(
      `Nettoyage STEM faible : ${existingRaw.length} → ${existing.length}`,
    );
  }
  const entries: CatalogEntry[] = STEM_ONLY ? [...existing] : [];
  const seen = new Set<number>();

  if (STEM_ONLY) {
    for (const e of existing) {
      if (e.gutenbergId) seen.add(e.gutenbergId);
    }
    console.log(
      `Mode STEM-only : conservation de ${existing.length} titre(s) existants.`,
    );
  }

  if (!STEM_ONLY) {
    await fetchPopularByLang(entries, seen);
    // Fusionner d’éventuels titres STEM déjà présents dans l’ancien catalogue
    for (const e of existing) {
      if (!e.gutenbergId || seen.has(e.gutenbergId)) continue;
      if (!e.tags.includes("stem")) continue;
      seen.add(e.gutenbergId);
      entries.push(e);
    }
  }

  await fetchStemTopics(entries, seen);

  // Dédup par slug
  const bySlug = new Map<string, CatalogEntry>();
  for (const e of entries) bySlug.set(e.slug, e);
  const finalEntries = [...bySlug.values()];

  await fs.writeFile(OUT_JSON, JSON.stringify(finalEntries, null, 2), "utf8");

  const stemCount = finalEntries.filter((e) => e.tags.includes("stem")).length;
  const bySubject = finalEntries.reduce<Record<string, number>>((acc, e) => {
    acc[e.subject] = (acc[e.subject] || 0) + 1;
    return acc;
  }, {});

  console.log(
    `\n✓ ${finalEntries.length} livre(s) enregistrés → ${path.relative(process.cwd(), OUT_JSON)}`,
  );
  console.log(`  dont STEM : ${stemCount}`);
  console.log(`  par matière : ${JSON.stringify(bySubject)}`);
  console.log(`✓ EPUB cache → ${path.relative(process.cwd(), CACHE_DIR)}`);
  console.log(`\nEnsuite : pnpm seed:library   (ou pnpm seed:library:reset)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
