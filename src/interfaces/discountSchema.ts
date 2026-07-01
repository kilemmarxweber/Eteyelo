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
  );
