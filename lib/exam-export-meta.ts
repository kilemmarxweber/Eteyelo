import { z } from "zod";

/** En-tête administratif du listing Excel finalistes (TENAFEP / 6è). */
export const examExportMetaSchema = z.object({
  province: z.string().trim().max(120).optional().or(z.literal("")),
  provinceCode: z.string().trim().max(20).optional().or(z.literal("")),
  centre: z.string().trim().max(120).optional().or(z.literal("")),
  centreCode: z.string().trim().max(20).optional().or(z.literal("")),
  etablissement: z.string().trim().max(200).optional().or(z.literal("")),
  etablissementCode: z.string().trim().max(40).optional().or(z.literal("")),
  option: z.string().trim().max(120).optional().or(z.literal("")),
  optionCode: z.string().trim().max(20).optional().or(z.literal("")),
  ordre: z.string().trim().max(20).optional().or(z.literal("")),
  gestion: z.string().trim().max(120).optional().or(z.literal("")),
  gestionCode: z.string().trim().max(20).optional().or(z.literal("")),
});

export type ExamExportMeta = z.infer<typeof examExportMetaSchema>;

export const emptyExamExportMeta = (): ExamExportMeta => ({
  province: "",
  provinceCode: "",
  centre: "",
  centreCode: "",
  etablissement: "",
  etablissementCode: "",
  option: "",
  optionCode: "",
  ordre: "",
  gestion: "",
  gestionCode: "",
});

export function parseExamExportMeta(raw: unknown): ExamExportMeta {
  const parsed = examExportMetaSchema.safeParse(raw ?? {});
  return parsed.success
    ? { ...emptyExamExportMeta(), ...parsed.data }
    : emptyExamExportMeta();
}

/** Niveau finaliste primaire. */
export const PRIMARY_FINALIST_LEVEL = "6è";

export function isPrimaryFinalistClass(classe: {
  level?: string | null;
  nameClasse?: string | null;
  codeClasse?: string | null;
}) {
  if (classe.level === PRIMARY_FINALIST_LEVEL) return true;
  const name = `${classe.nameClasse ?? ""} ${classe.codeClasse ?? ""}`.toLowerCase();
  return (
    name.includes("6è-pr") ||
    name.includes("6e-pr") ||
    /\b6[èe]\b/.test(name) ||
    name.includes("primaire 6")
  );
}
