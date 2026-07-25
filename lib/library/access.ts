import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  hasSessionRole,
  isPlatformOwnerSession,
} from "@/lib/auth/session-roles";
import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { BranchRole } from "@/prisma/generated/prisma/enums";

export type LibraryAccessMode = "manage" | "student";

export type LibraryAccessContext = {
  mode: LibraryAccessMode;
  userId: string;
  organizationId: string;
  branchId: string;
  session: Awaited<ReturnType<typeof requireBranchContext>>["session"];
};

/** Roles autorisés à lire + uploader (gestion bibliothèque). */
export const LIBRARY_MANAGE_ROLES = [
  APP_ROLE.OWNER, // owner plateforme
  APP_ROLE.ADMIN,
  ORG_ROLE.OWNER, // propriétaire organisation
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.DIRECTEUR_ETUDES,
  ORG_ROLE.SUPERVISEUR,
  "ADMIN",
  "DIRECTOR",
  "admin",
  "director",
] as const;

const STUDENT_ROLE_SLUGS = [ORG_ROLE.STUDENT, "STUDENT", "student"] as const;

const ORG_LIBRARY_MANAGE_DB_ROLES = [
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.DIRECTEUR_ETUDES,
  ORG_ROLE.SUPERVISEUR,
] as const;

/**
 * Owner plateforme, propriétaire org, gestionnaire (+ cadres école).
 * Lecture catalogue + upload / CRUD.
 */
export function canManageLibrary(session: unknown): boolean {
  if (isPlatformOwnerSession(session)) {
    return true;
  }

  return hasSessionRole(
    session as Parameters<typeof hasSessionRole>[0],
    [...LIBRARY_MANAGE_ROLES],
  );
}

/** Fallback DB si le rôle session est incomplet (owner / gestionnaire membre). */
export async function canManageLibraryForOrg(
  session: unknown,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  if (canManageLibrary(session)) {
    return true;
  }

  if (isPlatformOwnerSession(session)) {
    return true;
  }

  const member = await prisma.member.findFirst({
    where: {
      userId,
      organizationId,
      isArchived: false,
      role: { in: [...ORG_LIBRARY_MANAGE_DB_ROLES] },
      organization: { isArchived: false },
    },
    select: { id: true },
  });

  return Boolean(member);
}

export function isStudentSessionRole(session: unknown): boolean {
  return hasSessionRole(
    session as Parameters<typeof hasSessionRole>[0],
    [...STUDENT_ROLE_SLUGS],
  );
}

/**
 * Accès catalogue / lecteur :
 * - owner / propriétaire / gestionnaire (+ cadres) → mode manage (lecture + upload)
 * - BranchMember STUDENT → mode student (lecture seule)
 */
export async function enforceLibraryAccess(): Promise<LibraryAccessContext> {
  const ctx = await requireBranchContext();
  const { userId, organizationId, branchId, session } = ctx;

  if (await canManageLibraryForOrg(session, userId, organizationId)) {
    return { mode: "manage", userId, organizationId, branchId, session };
  }

  const membership = await prisma.branchMember.findFirst({
    where: {
      branchId,
      role: BranchRole.STUDENT,
      member: { userId },
    },
    select: { id: true },
  });

  if (!membership) {
    notFound();
  }

  return { mode: "student", userId, organizationId, branchId, session };
}

/** CRUD / upload bibliothèque. */
export async function enforceLibraryManageAccess(): Promise<LibraryAccessContext> {
  const ctx = await requireBranchContext();
  const allowed = await canManageLibraryForOrg(
    ctx.session,
    ctx.userId,
    ctx.organizationId,
  );

  if (!allowed) {
    throw new Error("Action non autorisée");
  }

  return {
    mode: "manage",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    session: ctx.session,
  };
}

/**
 * Gate API fichier livre (proxy).
 * Managers : même livres inactifs (aperçu admin).
 * Élèves : livres actifs uniquement.
 */
export async function resolveLibraryFileAccess(bookId: string): Promise<
  | {
      ok: true;
      book: {
        id: string;
        branchId: string;
        fileUrl: string;
        fileType: "PDF" | "EPUB";
        title: string;
        isActive: boolean;
      };
      userId: string;
    }
  | { ok: false; status: 401 | 403 | 404 }
> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.user?.id;
  const organizationId =
    session?.organization?.id ?? session?.session?.activeOrganizationId ?? null;
  const branchId =
    session?.branch?.id ?? session?.session?.activeBranchId ?? null;

  if (!userId || !branchId) {
    return { ok: false, status: 401 };
  }

  const book = await prisma.libraryBook.findFirst({
    where: { id: bookId, branchId },
    select: {
      id: true,
      branchId: true,
      fileUrl: true,
      fileType: true,
      title: true,
      isActive: true,
    },
  });

  if (!book) {
    return { ok: false, status: 404 };
  }

  const isManager = organizationId
    ? await canManageLibraryForOrg(session, userId, organizationId)
    : canManageLibrary(session);

  if (isManager) {
    return { ok: true, book, userId };
  }

  if (!book.isActive) {
    return { ok: false, status: 404 };
  }

  const membership = await prisma.branchMember.findFirst({
    where: {
      branchId,
      role: BranchRole.STUDENT,
      member: { userId },
    },
    select: { id: true },
  });

  if (!membership) {
    return { ok: false, status: 403 };
  }

  return { ok: true, book, userId };
}

/** Champs catalogue sûrs (sans fileUrl). */
export function toPublicLibraryBook<
  T extends {
    id: string;
    title: string;
    author: string | null;
    publisher: string | null;
    description: string | null;
    coverImage: string | null;
    fileType: "PDF" | "EPUB";
    language: string;
    cycle:
      | "PRIMAIRE"
      | "SECONDAIRE"
      | "HUMANITES"
      | "FORMATION"
      | "UNIVERSITE"
      | null;
    level: string | null;
    section: string | null;
    subject: string | null;
    category: string | null;
    tags: string[];
    viewCount: number;
    createdAt: Date;
  },
>(book: T) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    description: book.description,
    coverImage: book.coverImage,
    fileType: book.fileType,
    language: book.language,
    cycle: book.cycle,
    level: book.level,
    section: book.section,
    subject: book.subject,
    category: book.category,
    tags: book.tags,
    viewCount: book.viewCount,
    createdAt: book.createdAt,
  };
}
