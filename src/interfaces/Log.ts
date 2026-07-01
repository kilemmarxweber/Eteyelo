// import { ActionType, DeviceType } from "@/prisma/generated/prisma/client";
import z from "zod";

// Define enums locally to avoid importing Prisma client in client components
export const ActionType = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;

export const DeviceType = {
  MOBILE: "MOBILE",
  DESKTOP: "DESKTOP",
} as const;

export type ActionTypeEnum = (typeof ActionType)[keyof typeof ActionType];
export type DeviceTypeEnum = (typeof DeviceType)[keyof typeof DeviceType];

export interface ILog {
  id: string;
  userId: string;
  action: ActionTypeEnum;
  pageVisited?: string;
  deviceName: string;
  deviceType: DeviceTypeEnum;
}

export const logSchema = z.object({
  id: z.string().optional(),
  username: z.string(),
  action: z.enum(Object.values(ActionType) as [string, ...string[]]),
  pageVisited: z.string().optional(),
  deviceName: z.string() || undefined,
  deviceType: z.enum(Object.values(DeviceType) as [string, ...string[]]),
});
