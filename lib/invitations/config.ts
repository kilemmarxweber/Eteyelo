import { z } from "zod";
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const DEFAULT_INVITATION_EXPIRES_IN_DAYS = 7;

export const organizationInvitationsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /** Accepter un user déjà membre d'une autre org (données toujours isolées). */
  allowMultiOrg: z.boolean().default(true),
  expiresInDays: z.number().int().min(1).max(30).default(DEFAULT_INVITATION_EXPIRES_IN_DAYS),
  invitableRoles: z
    .array(z.string())
    .default([...ALL_ORG_ROLE_SLUGS]),
});

export type OrganizationInvitationsConfig = z.infer<
  typeof organizationInvitationsConfigSchema
>;

export const DEFAULT_ORGANIZATION_INVITATIONS_CONFIG: OrganizationInvitationsConfig =
  organizationInvitationsConfigSchema.parse({});

type OrganizationMetadata = {
  invitations?: Partial<OrganizationInvitationsConfig>;
  [key: string]: unknown;
};

export function parseOrganizationMetadata(
  raw: string | null | undefined,
): OrganizationMetadata {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as OrganizationMetadata;
    }
  } catch {
    // ignore invalid metadata
  }
  return {};
}

export function stringifyOrganizationMetadata(
  metadata: OrganizationMetadata,
): string {
  return JSON.stringify(metadata);
}

export function parseOrganizationInvitationsConfig(
  raw: string | null | undefined,
): OrganizationInvitationsConfig {
  const metadata = parseOrganizationMetadata(raw);
  const parsed = organizationInvitationsConfigSchema.safeParse(
    metadata.invitations ?? {},
  );
  if (!parsed.success) {
    return DEFAULT_ORGANIZATION_INVITATIONS_CONFIG;
  }

  const invitableRoles = parsed.data.invitableRoles.filter((role) =>
    (ALL_ORG_ROLE_SLUGS as readonly string[]).includes(role),
  );

  return {
    ...parsed.data,
    invitableRoles:
      invitableRoles.length > 0
        ? invitableRoles
        : [...ALL_ORG_ROLE_SLUGS],
  };
}

export async function getOrganizationInvitationsConfig(
  organizationId: string,
): Promise<OrganizationInvitationsConfig> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { metadata: true },
  });
  return parseOrganizationInvitationsConfig(organization?.metadata);
}

export async function setOrganizationInvitationsConfig(
  organizationId: string,
  next: OrganizationInvitationsConfig,
): Promise<OrganizationInvitationsConfig> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { metadata: true },
  });
  if (!organization) {
    throw new Error("Organisation introuvable.");
  }

  const config = organizationInvitationsConfigSchema.parse(next);
  const metadata = parseOrganizationMetadata(organization.metadata);
  metadata.invitations = {
    enabled: config.enabled,
    allowMultiOrg: config.allowMultiOrg,
    expiresInDays: config.expiresInDays,
    invitableRoles: config.invitableRoles,
  };

  await prisma.organization.update({
    where: { id: organizationId },
    data: { metadata: stringifyOrganizationMetadata(metadata) },
  });

  return config;
}

export function invitationExpiresAtFromConfig(
  config: OrganizationInvitationsConfig,
  from = new Date(),
): Date {
  const days = config.expiresInDays || DEFAULT_INVITATION_EXPIRES_IN_DAYS;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isInvitableRole(
  role: string,
  config: OrganizationInvitationsConfig,
): boolean {
  return config.invitableRoles.includes(role);
}
