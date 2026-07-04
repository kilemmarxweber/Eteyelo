import { prisma } from "@/lib/prisma";
import type { SupportAgentPublic } from "@/lib/support/types";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=80";

/** Agents support actifs d'une organisation (pour utilisateurs finaux). */
export async function listActiveOrganizationSupportAgents(
  organizationId: string,
  branchId?: string | null,
): Promise<SupportAgentPublic[]> {
  const agents = await prisma.organizationSupportAgent.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: branchId
        ? [
            { branchScopes: { none: {} } },
            { branchScopes: { some: { branchId: null } } },
            { branchScopes: { some: { branchId } } },
          ]
        : undefined,
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    include: {
      member: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      branchScopes: true,
    },
  });

  return agents.map((agent) => ({
    id: agent.id,
    name: agent.member.user.name,
    email: agent.member.user.email ?? "",
    role: agent.displayTitle ?? "Support établissement",
    image: agent.member.user.image ?? DEFAULT_IMAGE,
    topics: agent.specialties,
  }));
}

export async function getOrganizationSupportAgentForUser(
  userId: string,
  organizationId: string,
) {
  return prisma.organizationSupportAgent.findFirst({
    where: {
      organizationId,
      isActive: true,
      member: { userId },
    },
    include: {
      member: { include: { user: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function getOrganizationBySlug(slug: string) {
  return prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
}

export async function listOrganizationSupportEmails(
  organizationId: string,
): Promise<string[]> {
  const agents = await listActiveOrganizationSupportAgents(organizationId);
  return agents.map((a) => a.email).filter(Boolean);
}

export async function isOrganizationSupportEmail(
  organizationId: string,
  email: string,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const emails = await listOrganizationSupportEmails(organizationId);
  return emails.some((e) => e.toLowerCase() === normalized);
}

export async function listOrganizationSupportAgents(organizationId: string) {
  return prisma.organizationSupportAgent.findMany({
    where: { organizationId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    include: {
      member: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      branchScopes: {
        include: { branch: { select: { id: true, name: true } } },
      },
    },
  });
}
