import { z } from "zod";

export const discountSchema = z
  .object({
    scope: z.enum(["PARENT", "GROUP", "ORPHAN"]),

    parentId: z.string().optional(),
    category: z
      .enum(["NORMAL", "ORPHAN", "VIP", "SPONSORED", "GROUPE"])
      .optional(),
    minChildren: z.number().optional(),

    percentage: z.number().min(0).max(100),
    /** Type de frais concerné par la remise (requis si percentage > 0). */
    typeFraisId: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.scope === "PARENT") return !!data.parentId;
      if (data.scope === "ORPHAN") return data.category === "ORPHAN";
      if (data.scope === "GROUP") return !!data.minChildren;
      return false;
    },
    {
      message: "Configuration de réduction invalide",
    },
  )
  .refine(
    (data) => data.percentage <= 0 || Boolean(data.typeFraisId?.trim()),
    {
      message: "Choisissez le type de frais concerné par la remise",
      path: ["typeFraisId"],
    },
  );
