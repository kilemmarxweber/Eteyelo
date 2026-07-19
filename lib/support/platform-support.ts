import { prisma } from "@/lib/prisma";
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import type { SupportAgentPublic } from "@/lib/support/types";

const DEFAULT_IMAGE = KLAMBOCORE_DEFAULT_IMAGE_PATH;

/** Agents support plateforme Klambocore (actifs, pour pages publiques). */
export async function listActivePlatformSupportAgents(): Promise<
  SupportAgentPublic[]
> {
  const agents = await prisma.platformSupportAgent.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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
  });

  return agents.map((agent) => ({
    id: agent.id,
    userId: agent.user.id,
    name: agent.user.name,
    email: agent.user.email ?? "",
    role: agent.displayTitle ?? "Support plateforme Kalasa",
    image: agent.image ?? agent.user.image ?? DEFAULT_IMAGE,
    topics: agent.specialties,
  }));
}

export async function listPlatformSupportEmails(): Promise<string[]> {
  const agents = await listActivePlatformSupportAgents();
  return agents.map((a) => a.email).filter(Boolean);
}

export async function isPlatformSupportEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const emails = await listPlatformSupportEmails();
  return emails.some((e) => e.toLowerCase() === normalized);
}

/** Tous les agents plateforme (admin). */
export async function listAllPlatformSupportAgents() {
  return prisma.platformSupportAgent.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
        },
      },
    },
  });
}
