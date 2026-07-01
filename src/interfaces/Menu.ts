import { z } from "zod";

export interface IMenu {
  id: number;

  name: string;
  href: string;

  icon?: string | null;
  section?: string | null;

  parentId?: number | null;

  // 🔥 FLAT / DENORMALIZED (comme Option)
  nameParent?: string;
  codeSection?: string;

  isVisible: boolean;

  order: number;

  createdAt: Date;
  updatedAt: Date;
}
export const menuSchema = z.object({
  id: z.number().optional(),

  name: z.string().min(2, "Nom requis"),
  href: z.string().min(1, "Lien requis"),

  icon: z.string().nullable().optional(),
  section: z.string().nullable().optional(),

  parentId: z.number().nullable().optional(),

  isVisible: z.boolean().optional(),
  order: z.number().optional(),
});