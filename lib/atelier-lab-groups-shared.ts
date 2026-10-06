/**
 * Suffixe domaine : « Domaine des sciences » → « sciences ».
 * Sinon code domaine en minuscules (SCIENCES → sciences).
 */
export function extractPracticalDomainSuffix(params: {
  domainName?: string | null;
  domainCode?: string | null;
}): string | null {
  const name = params.domainName?.trim() ?? "";
  if (name) {
    const stripped = name
      .replace(
        /^domaine\s+(?:(?:des|de\s+la|du|de\s+l['’]|de)\s+)?/i,
        "",
      )
      .trim();
    const value =
      stripped && stripped.toLowerCase() !== "domaine" ? stripped : name;
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }
  const code = params.domainCode?.trim();
  if (code) {
    return code
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }
  return null;
}

/**
 * Compacte un code classe pour le libellé atelier.
 * Ex. « 1SC » → « 1sc », « 1E-SC » → « 1esc ».
 */
export function compactAtelierSourceClassCode(
  codeClasse?: string | null,
): string | null {
  const raw = codeClasse?.trim();
  if (!raw) return null;
  const compact = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
  return compact || null;
}

/**
 * Code court pour le libellé : chiffre du niveau + code option (ex. 1 + SC → 1sc),
 * sinon codeClasse compacté. Le parallèle (A/B) distingue les classes jumelles.
 */
export function resolveAtelierSourceClassCode(params: {
  codeClasse?: string | null;
  level?: string | null;
  optionCode?: string | null;
  sourceClasseName?: string | null;
  parallel?: string | null;
}): string | null {
  const option = params.optionCode
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
  const levelDigit = params.level?.match(/\d+/)?.[0];
  let base =
    levelDigit && option
      ? `${levelDigit}${option}`
      : compactAtelierSourceClassCode(params.codeClasse) ||
        compactAtelierSourceClassCode(params.sourceClasseName);

  if (!base) return null;

  const parallel = params.parallel
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
  if (parallel) return `${base}${parallel}`;
  return base;
}

/**
 * Libellé groupe atelier =
 * laboratoire + code classe source (+ parallèle) + suffixe domaine.
 * Ex. « laboratoire 10electa electricidade » vs « …10electb… »
 * (Sans dépendance Prisma — utilisable côté client.)
 */
export function buildAtelierLabGroupLabel(params: {
  domainName?: string | null;
  domainCode?: string | null;
  /** Conservé pour compat ; ignoré dans le libellé. */
  roomName?: string | null;
  sourceClasseName?: string | null;
  sourceClasseCode?: string | null;
  sourceClasseLevel?: string | null;
  sourceOptionCode?: string | null;
  sourceParallel?: string | null;
  fallbackName: string;
}): string {
  const domainSuffix = extractPracticalDomainSuffix({
    domainName: params.domainName,
    domainCode: params.domainCode,
  });
  const classCode = resolveAtelierSourceClassCode({
    codeClasse: params.sourceClasseCode,
    level: params.sourceClasseLevel,
    optionCode: params.sourceOptionCode,
    sourceClasseName: params.sourceClasseName,
    parallel: params.sourceParallel,
  });

  const parts = ["laboratoire", classCode, domainSuffix].filter(Boolean);
  if (parts.length > 1) return parts.join(" ");
  return params.fallbackName;
}
