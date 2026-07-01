import { z } from "zod";
// import { Permission } from "@/prisma/generated/prisma/client"; // ✅ IMPORTANT

// Define Permission enum locally to avoid importing Prisma client in client components
export const Permission = {
  VIEW: "VIEW",
  ADD: "ADD",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;

export type PermissionType = (typeof Permission)[keyof typeof Permission];

export const roleSchema = z.object({
  id: z.string().optional(),
  codeRole: z.string().min(2),
  nameRole: z.string().min(5),
});

export interface IRole {
  id: string;
  codeRole: string;
  nameRole: string;
  createdAt: Date;
  updatedAt: Date;

  // ✅ relations Prisma
  permissions?: PermissionType[];
}
