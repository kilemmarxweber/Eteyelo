import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { phoneLookupVariants } from "@/lib/mobile/phone";

const SESSION_TTL_MS = 60 * 60 * 24 * 30 * 1000; // 30 jours

export function isProfileComplete(user: {
  name?: string | null;
  image?: string | null;
  prenom?: string | null;
}) {
  const hasName = Boolean(
    (user.prenom && user.prenom.trim()) ||
      (user.name && user.name.trim() && !user.name.startsWith("+")),
  );
  const hasImage = Boolean(user.image && user.image.trim());
  return hasName && hasImage;
}

export async function findUserByTelephone(phoneE164: string) {
  const variants = phoneLookupVariants(phoneE164);
  return prisma.user.findFirst({
    where: {
      OR: variants.map((telephone) => ({ telephone })),
    },
    select: {
      id: true,
      name: true,
      prenom: true,
      postnom: true,
      image: true,
      telephone: true,
      email: true,
      role: true,
      banned: true,
      statusUser: true,
    },
  });
}

/** Crée un utilisateur minimal après OTP (profil à compléter). */
export async function ensureUserForPhone(phoneE164: string) {
  const existing = await findUserByTelephone(phoneE164);
  if (existing) {
    if (!existing.telephone) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { telephone: phoneE164 },
      });
    }
    return existing;
  }

  const id = crypto.randomUUID();
  const email = `phone.${phoneE164.replace(/\D/g, "")}@mobile.klambo.local`;

  return prisma.user.create({
    data: {
      id,
      name: phoneE164,
      email,
      emailVerified: false,
      telephone: phoneE164,
      statusUser: true,
    },
    select: {
      id: true,
      name: true,
      prenom: true,
      postnom: true,
      image: true,
      telephone: true,
      email: true,
      role: true,
      banned: true,
      statusUser: true,
    },
  });
}

export async function createMobileSession(params: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  activeOrganizationId?: string | null;
}) {
  const token = randomBytes(32).toString("hex");
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  // Première org active si non fournie
  let activeOrganizationId = params.activeOrganizationId ?? null;
  if (!activeOrganizationId) {
    const membership = await prisma.member.findFirst({
      where: { userId: params.userId, isArchived: false },
      orderBy: { createdAt: "asc" },
      select: { organizationId: true },
    });
    activeOrganizationId = membership?.organizationId ?? null;
  }

  await prisma.session.create({
    data: {
      id,
      token,
      userId: params.userId,
      expiresAt,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      activeOrganizationId,
    },
  });

  return { token, expiresAt, sessionId: id, activeOrganizationId };
}

export async function revokeMobileSession(token: string) {
  await prisma.session.deleteMany({ where: { token } });
}
