import { randomBytes } from "node:crypto";
import { Prisma } from "@/prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  phoneDigitKeys,
  phoneLookupVariants,
} from "@/lib/mobile/phone";

const SESSION_TTL_MS = 60 * 60 * 24 * 30 * 1000; // 30 jours

const userPhoneSelect = {
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
} as const;

export function isProfileComplete(user: {
  name?: string | null;
  image?: string | null;
  prenom?: string | null;
}) {
  const hasName = Boolean(
    (user.prenom && user.prenom.trim()) ||
      (user.name && user.name.trim() && !user.name.startsWith("+")),
  );
  // Photo optionnelle (Klambo) — le nom suffit pour accéder.
  return hasName;
}

type PhoneUser = {
  id: string;
  name: string;
  prenom: string | null;
  postnom: string | null;
  image: string | null;
  telephone: string | null;
  email: string;
  role: string | null;
  banned: boolean | null;
  statusUser: boolean | null;
};

function scorePhoneCandidate(user: PhoneUser) {
  let score = 0;
  if (!user.email.endsWith("@mobile.klambo.local")) score += 100;
  if (user.telephone && !user.telephone.startsWith("+")) score += 5;
  if (user.prenom?.trim()) score += 10;
  if (user.name?.trim() && !user.name.startsWith("+")) score += 10;
  if (user.image?.trim()) score += 5;
  if (user.statusUser !== false) score += 2;
  if (!user.banned) score += 2;
  return score;
}

async function pickBestPhoneUser(candidates: PhoneUser[]) {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  const ids = candidates.map((c) => c.id);
  const members = await prisma.member.findMany({
    where: { userId: { in: ids }, isArchived: false },
    select: { userId: true },
  });
  const withMembership = new Set(members.map((m) => m.userId));

  return [...candidates].sort((a, b) => {
    const ma = withMembership.has(a.id) ? 1 : 0;
    const mb = withMembership.has(b.id) ? 1 : 0;
    if (mb !== ma) return mb - ma;
    return scorePhoneCandidate(b) - scorePhoneCandidate(a);
  })[0]!;
}

/**
 * Retrouve un User Eteyelo par numéro, y compris formats « sales »
 * (espaces, sans +, national 9 chiffres Angola/RDC).
 */
export async function findUserByTelephone(phoneE164: string) {
  const variants = phoneLookupVariants(phoneE164);
  const digitKeys = phoneDigitKeys(phoneE164);

  const exact = await prisma.user.findMany({
    where: {
      OR: variants.map((telephone) => ({ telephone })),
    },
    select: userPhoneSelect,
    take: 20,
  });
  const exactBest = await pickBestPhoneUser(exact);
  if (exactBest) return exactBest;

  if (digitKeys.length === 0) return null;

  // Match sur chiffres uniquement (ignore espaces / + / 0 / indicatif).
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM "user"
    WHERE telephone IS NOT NULL
      AND btrim(telephone) <> ''
      AND regexp_replace(telephone, '\D', '', 'g') IN (${Prisma.join(digitKeys)})
    LIMIT 30
  `);

  if (rows.length === 0) return null;

  const digitMatched = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    select: userPhoneSelect,
  });
  return pickBestPhoneUser(digitMatched);
}

/** Crée un utilisateur minimal après OTP (profil à compléter) ou lie le compte Eteyelo. */
export async function ensureUserForPhone(phoneE164: string) {
  const existing = await findUserByTelephone(phoneE164);
  if (existing) {
    // Normalise le téléphone stocké pour les prochains login.
    if (existing.telephone !== phoneE164) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { telephone: phoneE164 },
      });
      return { ...existing, telephone: phoneE164 };
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
    select: userPhoneSelect,
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
