import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  seedExchangeRates,
  clearExchangeRates,
} from "./seedExchangeRates";
import { seedSuperAdmin, clearSuperAdmin } from "./seedSuperAdmin";
import {
  seedKlambocoreSupport,
  clearKlambocoreSupport,
} from "./seedKlambocoreSupport";

const INIT_ORDER = [
  { name: "superAdmin", init: seedSuperAdmin, clear: clearSuperAdmin },
  {
    name: "klambocoreSupport",
    init: seedKlambocoreSupport,
    clear: clearKlambocoreSupport,
  },
  {
    name: "exchangeRates",
    init: seedExchangeRates,
    clear: clearExchangeRates,
  },
] as const;

const CLEAR_ORDER = [...INIT_ORDER].reverse();

async function seedAll() {
  console.log("Seed Eteyelo — owner + support Klambocore + taux\n");
  const start = Date.now();

  for (const script of INIT_ORDER) {
    await script.init();
  }

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\nTerminé en ${duration}s`);
  console.log("  - superAdmin (owner, email = SMTP_USER)");
  console.log("  - klambocoreSupport (même user, PlatformSupportAgent lead)");
  console.log("  - exchangeRates (4 paires / organisation)");
}

async function clearAll() {
  console.log("Clear seed Eteyelo\n");
  for (const script of CLEAR_ORDER) {
    await script.clear();
  }
  console.log("\nClear terminé.");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage:
  pnpm seed              Seed owner + support Klambocore + taux
  pnpm seed -- --all     Idem
  pnpm seed -- --clear   Supprime taux, support, puis super admin
  pnpm seed -- --list    Liste les seeds disponibles
`);
    return;
  }

  if (args.includes("--list")) {
    for (const script of INIT_ORDER) {
      console.log(`  - ${script.name}`);
    }
    return;
  }

  if (args.includes("--clear")) {
    await clearAll();
    return;
  }

  await seedAll();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
