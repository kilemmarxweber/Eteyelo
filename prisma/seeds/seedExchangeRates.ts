import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { DEFAULT_EXCHANGE_PAIRS } from "@/lib/exchange-rate";

/** Seed les 4 paires de taux par défaut pour chaque organisation. */
export async function seedExchangeRates() {
  console.log("Initialisation des taux de change...");

  const organizations = await prisma.organization.findMany({
    where: { isArchived: false },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  if (organizations.length === 0) {
    console.warn(
      "Aucune organisation en base — aucun taux seedé. Créez une organisation puis relancez.",
    );
    return { organizations: 0, pairsUpserted: 0 };
  }

  let pairsUpserted = 0;

  for (const org of organizations) {
    for (const pair of DEFAULT_EXCHANGE_PAIRS) {
      await prisma.exchangeRate.upsert({
        where: {
          organizationId_fromCurrency_toCurrency: {
            organizationId: org.id,
            fromCurrency: pair.fromCurrency,
            toCurrency: pair.toCurrency,
          },
        },
        create: {
          organizationId: org.id,
          fromCurrency: pair.fromCurrency,
          toCurrency: pair.toCurrency,
          rate: pair.rate,
          isActive: true,
        },
        update: {
          rate: pair.rate,
          isActive: true,
        },
      });
      pairsUpserted += 1;
    }
    console.log(
      `  OK ${org.name} (${org.slug}) — ${DEFAULT_EXCHANGE_PAIRS.length} paires`,
    );
  }

  console.log(
    `Taux de change prêts: ${organizations.length} org(s), ${pairsUpserted} paire(s)`,
  );
  return { organizations: organizations.length, pairsUpserted };
}

export async function clearExchangeRates() {
  console.log("Suppression des taux de change...");
  const result = await prisma.exchangeRate.deleteMany({});
  console.log(`  ${result.count} taux supprimé(s)`);
  return result.count;
}
