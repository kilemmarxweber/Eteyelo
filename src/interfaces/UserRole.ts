import { IRole } from "./Role";

export interface IUserRole {
  id: string;
  roleId: string;
  userId: string;

  startDate: Date;
  endDate?: Date | null;

  createdAt: Date;
  updatedAt: Date;

  role?: IRole;
}
import { z } from "zod";

export const userRoleSchema = z.object({
  id: z.string().optional(),

  userId: z.string().min(1, "userId requis"),
  roleId: z.string().min(1, "roleId requis"),

  startDate: z.coerce.date(),

  endDate: z.coerce.date().optional().nullable(),
});
