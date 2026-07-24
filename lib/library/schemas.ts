import { z } from "zod";

export const libraryCycleSchema = z.enum(["PRIMAIRE", "SECONDAIRE", "HUMANITES"]);
export const libraryFileTypeSchema = z.enum(["PDF", "EPUB"]);

export const libraryBookMetaSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(200),
  author: z.string().trim().max(200).optional().nullable(),
  publisher: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  coverImage: z.string().trim().max(1000).optional().nullable(),
  cycle: libraryCycleSchema.optional().nullable(),
  level: z.string().trim().max(80).optional().nullable(),
  section: z.string().trim().max(80).optional().nullable(),
  subject: z.string().trim().max(120).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  language: z.string().trim().min(2).max(10).optional(),
  license: z.string().trim().max(120).optional().nullable(),
  isbn: z.string().trim().max(40).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateLibraryBookSchema = libraryBookMetaSchema.extend({
  id: z.string().min(1),
});

export const libraryBookIdSchema = z.object({
  id: z.string().min(1),
});

export type LibraryBookMetaInput = z.infer<typeof libraryBookMetaSchema>;

export const LIBRARY_SUBJECTS = [
  "Français",
  "Mathématiques",
  "Sciences",
  "Histoire",
  "Géographie",
  "Éducation civique",
  "Anglais",
  "Latin",
  "Physique",
  "Chimie",
  "Biologie",
  "Économie",
  "Informatique",
  "Religion",
  "Arts",
  "Philosophie",
  "Pédagogie",
  "Commerce",
  "Autre",
] as const;

export const LIBRARY_LEVELS = [
  "1ère primaire",
  "2ème primaire",
  "3ème primaire",
  "4ème primaire",
  "5ème primaire",
  "6ème primaire",
  "7ème / 1ère secondaire",
  "8ème / 2ème secondaire",
  "3ème secondaire",
  "4ème secondaire",
  "5ème secondaire",
  "6ème secondaire / Humanités",
] as const;

export const LIBRARY_SECTIONS = [
  "GENERALE",
  "LITTERAIRE",
  "SCIENTIFIQUE",
  "PEDAGOGIQUE",
  "COMMERCIALE",
  "TECHNIQUE",
  "CUT",
] as const;
