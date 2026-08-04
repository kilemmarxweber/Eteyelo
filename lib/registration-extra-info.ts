import { z } from "zod";

/** Champs élève optionnels (compléter plus tard). */
export const studentExtraInfoSchema = z.object({
  nationalite: z.string().trim().max(120).optional().or(z.literal("")),
  autreNationalite: z.string().trim().max(120).optional().or(z.literal("")),
  territoireAutreNationalite: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal("")),
  langue: z.string().trim().max(120).optional().or(z.literal("")),
});

/** Champs famille / parent optionnels (compléter plus tard). */
export const familyExtraInfoSchema = z.object({
  nomMere: z.string().trim().max(200).optional().or(z.literal("")),
  professionMere: z.string().trim().max(200).optional().or(z.literal("")),
  tuteurNom: z.string().trim().max(200).optional().or(z.literal("")),
  adresseTuteur: z.string().trim().max(300).optional().or(z.literal("")),
  provinceOrigine: z.string().trim().max(120).optional().or(z.literal("")),
  territoireOrigine: z.string().trim().max(120).optional().or(z.literal("")),
  secteurOrigine: z.string().trim().max(120).optional().or(z.literal("")),
  villageOrigine: z.string().trim().max(120).optional().or(z.literal("")),
});

export type StudentExtraInfo = z.infer<typeof studentExtraInfoSchema>;
export type FamilyExtraInfo = z.infer<typeof familyExtraInfoSchema>;

export const emptyStudentExtraInfo = (): StudentExtraInfo => ({
  nationalite: "",
  autreNationalite: "",
  territoireAutreNationalite: "",
  langue: "",
});

export const emptyFamilyExtraInfo = (): FamilyExtraInfo => ({
  nomMere: "",
  professionMere: "",
  tuteurNom: "",
  adresseTuteur: "",
  provinceOrigine: "",
  territoireOrigine: "",
  secteurOrigine: "",
  villageOrigine: "",
});

export function optionalString(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function studentExtraToDb(extra?: StudentExtraInfo | null) {
  if (!extra) {
    return {
      nationalite: null as string | null,
      autreNationalite: null as string | null,
      territoireAutreNationalite: null as string | null,
      langue: null as string | null,
    };
  }
  return {
    nationalite: optionalString(extra.nationalite),
    autreNationalite: optionalString(extra.autreNationalite),
    territoireAutreNationalite: optionalString(
      extra.territoireAutreNationalite,
    ),
    langue: optionalString(extra.langue),
  };
}

export function familyExtraToDb(extra?: FamilyExtraInfo | null) {
  if (!extra) {
    return {
      nomMere: null as string | null,
      professionMere: null as string | null,
      tuteurNom: null as string | null,
      adresseTuteur: null as string | null,
      provinceOrigine: null as string | null,
      territoireOrigine: null as string | null,
      secteurOrigine: null as string | null,
      villageOrigine: null as string | null,
    };
  }
  return {
    nomMere: optionalString(extra.nomMere),
    professionMere: optionalString(extra.professionMere),
    tuteurNom: optionalString(extra.tuteurNom),
    adresseTuteur: optionalString(extra.adresseTuteur),
    provinceOrigine: optionalString(extra.provinceOrigine),
    territoireOrigine: optionalString(extra.territoireOrigine),
    secteurOrigine: optionalString(extra.secteurOrigine),
    villageOrigine: optionalString(extra.villageOrigine),
  };
}

export function pickStudentExtraFromUnknown(
  raw: unknown,
): StudentExtraInfo {
  const base = emptyStudentExtraInfo();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof StudentExtraInfo)[]) {
    const value = obj[key];
    if (typeof value === "string") base[key] = value;
  }
  return base;
}

export function pickFamilyExtraFromUnknown(raw: unknown): FamilyExtraInfo {
  const base = emptyFamilyExtraInfo();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof FamilyExtraInfo)[]) {
    const value = obj[key];
    if (typeof value === "string") base[key] = value;
  }
  return base;
}

export const STUDENT_EXTRA_FIELD_LABELS: Record<
  keyof StudentExtraInfo,
  string
> = {
  nationalite: "Nationalité",
  autreNationalite: "Autre nationalité",
  territoireAutreNationalite: "Territoire autre nationalité",
  langue: "Langue",
};

export const FAMILY_EXTRA_FIELD_LABELS: Record<keyof FamilyExtraInfo, string> =
  {
    nomMere: "Nom de la mère",
    professionMere: "Profession de la mère",
    tuteurNom: "Nom du tuteur",
    adresseTuteur: "Adresse du tuteur",
    provinceOrigine: "Province d'origine",
    territoireOrigine: "Territoire d'origine",
    secteurOrigine: "Secteur d'origine",
    villageOrigine: "Village d'origine",
  };
