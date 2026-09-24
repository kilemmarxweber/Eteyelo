"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import {
  requireBranchAreaActionContext,
  requireBranchContext,
} from "@/lib/auth/require-branch-context";
import { isAtelierBranchType } from "@/lib/atelier-student-access";
import { ensurePracticalDomainsForBranch } from "@/lib/branch-practical-domains";
import { PRACTICAL_DOMAIN_CATALOG } from "@/lib/practical-domains";

function revalidatePracticalPages(organizationId: string, branchId: string) {
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/settings/practical-domains`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/cours`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/classe`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/schedule`,
  );
}

async function requireAtelierBranch() {
  const ctx = await requireBranchContext();
  if (!isAtelierBranchType(ctx.typebranch)) {
    throw new Error("Réservé aux branches atelier");
  }
  return ctx;
}

export const ensurePracticalDomainsAction = action.handler(async () => {
  const { branchId, organizationId, typebranch } =
    await requireBranchAreaActionContext("courses", "update");
  if (!isAtelierBranchType(typebranch)) {
    throw new Error("Réservé aux branches atelier");
  }
  const domains = await ensurePracticalDomainsForBranch(prisma, branchId);
  revalidatePracticalPages(organizationId, branchId);
  return domains;
});

export const getPracticalDomainsAction = action.handler(async () => {
  const { branchId, typebranch } = await requireAtelierBranch();
  if (!isAtelierBranchType(typebranch)) return [];

  let domains = await prisma.practicalDomain.findMany({
    where: { branchId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      sortOrder: true,
      isSystem: true,
      rooms: {
        select: { id: true, name: true, capacity: true },
        orderBy: { name: "asc" },
      },
      _count: { select: { cours: true } },
    },
  });

  if (domains.length === 0) {
    await ensurePracticalDomainsForBranch(prisma, branchId);
    domains = await prisma.practicalDomain.findMany({
      where: { branchId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        sortOrder: true,
        isSystem: true,
        rooms: {
          select: { id: true, name: true, capacity: true },
          orderBy: { name: "asc" },
        },
        _count: { select: { cours: true } },
      },
    });
  }

  return domains;
});

export const getRoomsAction = action.handler(async () => {
  const { branchId } = await requireAtelierBranch();
  return prisma.room.findMany({
    where: { branchId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      capacity: true,
      practicalDomainId: true,
      practicalDomain: { select: { id: true, code: true, name: true } },
    },
  });
});

export const upsertRoomAction = action
  .input(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(2).max(80),
      capacity: z.coerce.number().int().positive().nullable().optional(),
      practicalDomainId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, typebranch } =
      await requireBranchAreaActionContext("courses", "update");
    if (!isAtelierBranchType(typebranch)) {
      throw new Error("Réservé aux branches atelier");
    }

    if (input.practicalDomainId) {
      const domain = await prisma.practicalDomain.findFirst({
        where: { id: input.practicalDomainId, branchId },
        select: { id: true },
      });
      if (!domain) throw new Error("Domaine introuvable");
    }

    const name = input.name.trim();
    if (input.id) {
      const existing = await prisma.room.findFirst({
        where: { id: input.id, branchId },
        select: { id: true },
      });
      if (!existing) throw new Error("Salle introuvable");
      const room = await prisma.room.update({
        where: { id: input.id },
        data: {
          name,
          capacity: input.capacity ?? null,
          practicalDomainId: input.practicalDomainId ?? null,
        },
      });
      revalidatePracticalPages(organizationId, branchId);
      return room;
    }

    const room = await prisma.room.create({
      data: {
        branchId,
        name,
        capacity: input.capacity ?? null,
        practicalDomainId: input.practicalDomainId ?? null,
      },
    });
    revalidatePracticalPages(organizationId, branchId);
    return room;
  });

export const deleteRoomAction = action
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, typebranch } =
      await requireBranchAreaActionContext("courses", "delete");
    if (!isAtelierBranchType(typebranch)) {
      throw new Error("Réservé aux branches atelier");
    }
    const room = await prisma.room.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });
    if (!room) throw new Error("Salle introuvable");
    await prisma.room.delete({ where: { id: input.id } });
    revalidatePracticalPages(organizationId, branchId);
    return { ok: true };
  });

export const linkCoursToPracticalDomainAction = action
  .input(
    z.object({
      coursId: z.string().min(1),
      practicalDomainId: z.string().nullable(),
      sortOrderDefault: z.coerce.number().int().min(0).max(999).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, typebranch } =
      await requireBranchAreaActionContext("courses", "update");
    if (!isAtelierBranchType(typebranch)) {
      throw new Error("Réservé aux branches atelier");
    }

    const cours = await prisma.cours.findFirst({
      where: { id: input.coursId, branchId },
      select: { id: true },
    });
    if (!cours) throw new Error("Cours introuvable");

    await prisma.practicalDomainCours.deleteMany({
      where: { coursId: input.coursId },
    });

    if (!input.practicalDomainId) {
      await prisma.cours.update({
        where: { id: input.coursId },
        data: { hasPracticalLab: false },
      });
      revalidatePracticalPages(organizationId, branchId);
      return { linked: false };
    }

    const domain = await prisma.practicalDomain.findFirst({
      where: { id: input.practicalDomainId, branchId },
      select: { id: true },
    });
    if (!domain) throw new Error("Domaine introuvable");

    const maxOrder = await prisma.practicalDomainCours.aggregate({
      where: { practicalDomainId: domain.id },
      _max: { sortOrderDefault: true },
    });

    await prisma.practicalDomainCours.create({
      data: {
        practicalDomainId: domain.id,
        coursId: input.coursId,
        sortOrderDefault:
          input.sortOrderDefault ??
          (maxOrder._max.sortOrderDefault ?? -1) + 1,
      },
    });
    await prisma.cours.update({
      where: { id: input.coursId },
      data: { hasPracticalLab: true },
    });
    revalidatePracticalPages(organizationId, branchId);
    return { linked: true };
  });

export const getPracticalDomainCatalogAction = action.handler(async () => {
  return PRACTICAL_DOMAIN_CATALOG.map((d) => ({
    code: d.code,
    name: d.name,
    defaultRoomName: d.defaultRoomName ?? null,
  }));
});
