"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CurrencyCode } from "@/prisma/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canAccessBranchOrgSettings } from "@/lib/auth/session-roles";
import { action } from "@/lib/zsa";
import {
  DEFAULT_EXCHANGE_PAIRS,
  type ExchangeRatePair,
} from "@/lib/exchange-rate";

const currencySchema = z.nativeEnum(CurrencyCode);

const upsertSchema = z
  .object({
    fromCurrency: currencySchema,
    toCurrency: currencySchema,
    rate: z.coerce.number().positive("Le taux doit être > 0"),
    isActive: z.boolean().optional().default(true),
  })
  .refine((data) => data.fromCurrency !== data.toCurrency, {
    message: "Les devises source et cible doivent être différentes.",
    path: ["toCurrency"],
  });

function assertCanManage(
  session: Awaited<ReturnType<typeof requireBranchContext>>["session"],
) {
  if (!canAccessBranchOrgSettings(session)) {
    throw new Error("Action non autorisée.");
  }
}

async function seedDefaultRatesIfEmpty(
  organizationId: string,
  createdBy?: string | null,
) {
  const existing = await prisma.exchangeRate.count({
    where: { organizationId },
  });
  if (existing > 0) return;

  await prisma.exchangeRate.createMany({
    data: DEFAULT_EXCHANGE_PAIRS.map((pair) => ({
      organizationId,
      fromCurrency: pair.fromCurrency,
      toCurrency: pair.toCurrency,
      rate: pair.rate,
      isActive: true,
      createdBy: createdBy ?? null,
    })),
    skipDuplicates: true,
  });
}

function mapRate(row: {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  isActive: boolean;
  id: string;
  updatedAt: Date;
}): ExchangeRatePair & { id: string; updatedAt: Date } {
  return {
    id: row.id,
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    rate: row.rate,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
  };
}

/** Paires actives de l'organisation courante (seed si vide). */
export const getActiveExchangeRatesAction = action.handler(async () => {
  const { organizationId, userId } = await requireBranchContext();
  await seedDefaultRatesIfEmpty(organizationId, userId);

  const rows = await prisma.exchangeRate.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ fromCurrency: "asc" }, { toCurrency: "asc" }],
  });

  return rows.map(mapRate);
});

/** Toutes les paires org (écran settings). */
export const listExchangeRatesAction = action.handler(async () => {
  const { organizationId, userId, session } = await requireBranchContext();
  assertCanManage(session);
  await seedDefaultRatesIfEmpty(organizationId, userId);

  const rows = await prisma.exchangeRate.findMany({
    where: { organizationId },
    orderBy: [{ fromCurrency: "asc" }, { toCurrency: "asc" }],
  });

  return rows.map(mapRate);
});

/** Create / update d'une paire au niveau organisation. */
export const upsertExchangeRateAction = action
  .input(upsertSchema)
  .handler(async ({ input }) => {
    const { organizationId, userId, session, branchId } =
      await requireBranchContext();
    assertCanManage(session);
    await seedDefaultRatesIfEmpty(organizationId, userId);

    const row = await prisma.exchangeRate.upsert({
      where: {
        organizationId_fromCurrency_toCurrency: {
          organizationId,
          fromCurrency: input.fromCurrency,
          toCurrency: input.toCurrency,
        },
      },
      create: {
        organizationId,
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        rate: input.rate,
        isActive: input.isActive,
        createdBy: userId,
      },
      update: {
        rate: input.rate,
        isActive: input.isActive,
      },
    });

    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/settings/exchange-rates`,
    );
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/paiement`,
    );

    return mapRate(row);
  });
