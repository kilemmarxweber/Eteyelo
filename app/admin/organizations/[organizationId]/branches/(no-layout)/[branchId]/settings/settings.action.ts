"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canManageOrganization } from "@/lib/auth/session-roles";

const eventTypeSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(3, "Le nom doit contenir au moins 3 caractères.").max(80),
});

function assertCanManage(session: Awaited<ReturnType<typeof requireBranchContext>>["session"]) {
  if (!canManageOrganization(session)) throw new Error("Action non autorisée.");
}

export async function getCalendarSettingsAction() {
  const { branchId } = await requireBranchContext();
  return prisma.eventType.findMany({
    where: { branchId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { events: true } } },
  });
}

export async function saveEventTypeAction(input: z.infer<typeof eventTypeSchema>) {
  const context = await requireBranchContext();
  assertCanManage(context.session);
  const data = eventTypeSchema.parse(input);
  const duplicate = await prisma.eventType.findFirst({
    where: { branchId: context.branchId, name: { equals: data.name, mode: "insensitive" }, ...(data.id ? { id: { not: data.id } } : {}) },
    select: { id: true },
  });
  if (duplicate) return { ok: false, message: "Ce type d'événement existe déjà." };

  if (data.id) {
    const existing = await prisma.eventType.findFirst({ where: { id: data.id, branchId: context.branchId }, select: { id: true } });
    if (!existing) return { ok: false, message: "Type d'événement introuvable." };
    await prisma.eventType.update({ where: { id: data.id }, data: { name: data.name } });
  } else {
    await prisma.eventType.create({ data: { branchId: context.branchId, name: data.name } });
  }
  revalidatePath(`/admin/organizations/${context.organizationId}/branches/${context.branchId}/settings/calendar`);
  return { ok: true, message: data.id ? "Type d'événement modifié." : "Type d'événement créé." };
}

const attendanceSettingsSchema = z.object({ attendanceRadius: z.coerce.number().int().min(10).max(5000) });

export async function getAttendanceSettingsAction() {
  const { branchId } = await requireBranchContext();
  return prisma.branch.findUniqueOrThrow({ where: { id: branchId }, select: { attendanceRadius: true, latitude: true, longitude: true } });
}

export async function saveAttendanceSettingsAction(input: { attendanceRadius: number }) {
  const context = await requireBranchContext();
  assertCanManage(context.session);
  const data = attendanceSettingsSchema.parse(input);
  await prisma.branch.update({ where: { id: context.branchId }, data });
  revalidatePath(`/admin/organizations/${context.organizationId}/branches/${context.branchId}/settings/attendance`);
  return { ok: true, message: "Paramètres de présence enregistrés." };
}
