"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canAccessBranchOrgSettings } from "@/lib/auth/session-roles";
import {
  getGoogleDriveAuthStatus,
  listGoogleDriveLibraryFiles,
  parseGoogleDriveFolderId,
  titleFromDriveFileName,
  toDriveStorageKey,
} from "@/lib/library/google-drive";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";

function assertCanManage(
  session: Awaited<ReturnType<typeof requireBranchContext>>["session"],
) {
  if (!canAccessBranchOrgSettings(session)) {
    throw new Error("Action non autorisée.");
  }
}

function revalidateLibrary(organizationId: string, branchId: string) {
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/settings/bibliotheque`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/bibliotheque`,
  );
}

const sourceInputSchema = z.object({
  name: z.string().trim().max(120).optional().nullable(),
  url: z.string().trim().min(8).max(500),
  apiKey: z.string().trim().max(200).optional().nullable(),
  isEnabled: z.boolean().optional(),
});

function sourceNameFromUrl(url: string, folderId: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("google")) return "Google Drive";
  } catch {
    // id brut
  }
  return `Drive ${folderId.slice(0, 8)}`;
}

function presentSource(source: {
  id: string;
  name: string;
  url: string;
  folderId: string | null;
  apiKey: string | null;
  isEnabled: boolean;
  lastSyncedAt: Date | null;
  lastError: string | null;
  fileCount: number;
  kind: string;
}) {
  return {
    id: source.id,
    name: source.name,
    url: source.url,
    folderId: source.folderId,
    isEnabled: source.isEnabled,
    lastSyncedAt: source.lastSyncedAt?.toISOString() ?? null,
    lastError: source.lastError,
    fileCount: source.fileCount,
    kind: source.kind,
    hasApiKey: Boolean(source.apiKey?.trim()),
  };
}

export const listLibraryCatalogSourcesAction = action.handler(async () => {
  const { branchId, session } = await requireBranchContext();
  assertCanManage(session);

  const sources = await prisma.libraryCatalogSource.findMany({
    where: { branchId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const driveAuth = getGoogleDriveAuthStatus();
  return {
    sources: sources.map(presentSource),
    envApiKeyConfigured: driveAuth.envApiKeyConfigured,
    serviceAccountConfigured: driveAuth.mode === "service_account",
    serviceAccountEmail: driveAuth.serviceAccountEmail,
    driveAuthMode: driveAuth.mode,
  };
});

export const createLibraryCatalogSourceAction = action
  .input(sourceInputSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    assertCanManage(session);

    const folderId = parseGoogleDriveFolderId(input.url);
    if (!folderId) {
      throw new Error(
        "Lien Google Drive invalide. Collez l’URL du dossier (…/folders/…).",
      );
    }

    const existing = await prisma.libraryCatalogSource.findFirst({
      where: { branchId, folderId },
      select: { id: true },
    });
    if (existing) {
      throw new Error("Ce dossier Drive est déjà ajouté.");
    }

    const count = await prisma.libraryCatalogSource.count({
      where: { branchId },
    });

    const source = await prisma.libraryCatalogSource.create({
      data: {
        branchId,
        kind: "GOOGLE_DRIVE",
        name: input.name?.trim() || sourceNameFromUrl(input.url, folderId),
        url: input.url.trim(),
        folderId,
        apiKey: input.apiKey?.trim() || null,
        isEnabled: input.isEnabled ?? true,
        sortOrder: count,
      },
    });

    revalidateLibrary(organizationId, branchId);
    return presentSource(source);
  });

export const updateLibraryCatalogSourceAction = action
  .input(
    sourceInputSchema.extend({
      id: z.string().min(1),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    assertCanManage(session);

    const current = await prisma.libraryCatalogSource.findFirst({
      where: { id: input.id, branchId },
    });
    if (!current) {
      throw new Error("Source introuvable.");
    }

    const folderId = parseGoogleDriveFolderId(input.url);
    if (!folderId) {
      throw new Error(
        "Lien Google Drive invalide. Collez l’URL du dossier (…/folders/…).",
      );
    }

    const duplicate = await prisma.libraryCatalogSource.findFirst({
      where: { branchId, folderId, id: { not: current.id } },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error("Ce dossier Drive est déjà ajouté.");
    }

    const source = await prisma.libraryCatalogSource.update({
      where: { id: current.id },
      data: {
        name: input.name?.trim() || current.name,
        url: input.url.trim(),
        folderId,
        apiKey:
          input.apiKey === undefined
            ? current.apiKey
            : input.apiKey?.trim() || null,
        isEnabled: input.isEnabled ?? current.isEnabled,
      },
    });

    revalidateLibrary(organizationId, branchId);
    return presentSource(source);
  });

export const toggleLibraryCatalogSourceAction = action
  .input(z.object({ id: z.string().min(1), isEnabled: z.boolean() }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    assertCanManage(session);

    const current = await prisma.libraryCatalogSource.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });
    if (!current) {
      throw new Error("Source introuvable.");
    }

    const source = await prisma.libraryCatalogSource.update({
      where: { id: current.id },
      data: { isEnabled: input.isEnabled },
    });

    revalidateLibrary(organizationId, branchId);
    return presentSource(source);
  });

export const deleteLibraryCatalogSourceAction = action
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    assertCanManage(session);

    const current = await prisma.libraryCatalogSource.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });
    if (!current) {
      throw new Error("Source introuvable.");
    }

    await prisma.libraryCatalogSource.delete({ where: { id: current.id } });
    revalidateLibrary(organizationId, branchId);
    return { ok: true };
  });

export const syncLibraryCatalogSourceAction = action
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    assertCanManage(session);

    const source = await prisma.libraryCatalogSource.findFirst({
      where: { id: input.id, branchId },
    });
    if (!source) {
      throw new Error("Source introuvable.");
    }

    const folderId =
      source.folderId || parseGoogleDriveFolderId(source.url);
    if (!folderId) {
      throw new Error("Identifiant de dossier Drive manquant.");
    }

    try {
      const files = await listGoogleDriveLibraryFiles({
        folderId,
        apiKey: source.apiKey,
      });
      const seen = new Set<string>();

      for (const [index, file] of files.entries()) {
        seen.add(file.id);
        await prisma.libraryBook.upsert({
          where: {
            catalogSourceId_externalId: {
              catalogSourceId: source.id,
              externalId: file.id,
            },
          },
          create: {
            branchId,
            catalogSourceId: source.id,
            externalId: file.id,
            title: titleFromDriveFileName(file.name),
            publisher: source.name,
            fileUrl: toDriveStorageKey(file.id),
            fileType: file.fileType,
            fileSize: Number.isFinite(file.size) ? file.size : null,
            language: "fr",
            source: "GOOGLE_DRIVE",
            allowDownload: false,
            isActive: source.isEnabled,
            category: source.name,
            tags: ["google-drive"],
            sortOrder: index,
          },
          update: {
            title: titleFromDriveFileName(file.name),
            publisher: source.name,
            fileUrl: toDriveStorageKey(file.id),
            fileType: file.fileType,
            fileSize: Number.isFinite(file.size) ? file.size : null,
            isActive: source.isEnabled,
            allowDownload: false,
            category: source.name,
            sortOrder: index,
          },
        });
      }

      await prisma.libraryBook.deleteMany({
        where: {
          catalogSourceId: source.id,
          ...(seen.size > 0 ? { externalId: { notIn: [...seen] } } : {}),
        },
      });

      const updated = await prisma.libraryCatalogSource.update({
        where: { id: source.id },
        data: {
          folderId,
          lastSyncedAt: new Date(),
          lastError: null,
          fileCount: files.length,
        },
      });

      revalidateLibrary(organizationId, branchId);
      return {
        ...presentSource(updated),
        imported: files.length,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Synchronisation Google Drive impossible.";
      const updated = await prisma.libraryCatalogSource.update({
        where: { id: source.id },
        data: { lastError: message },
      });
      revalidateLibrary(organizationId, branchId);
      throw new Error(message || updated.lastError || "Erreur Drive.");
    }
  });
