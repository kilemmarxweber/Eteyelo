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
import {
  seedLibraryBooks,
  clearLibraryBooksSeed,
} from "./seedLibraryBooks";
import {
  seedAngolaSecondaryStudents,
  clearAngolaSecondaryStudents,
} from "./seedAngolaSecondaryStudents";

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
  {
    name: "libraryBooks",
    init: seedLibraryBooks,
    clear: clearLibraryBooksSeed,
  },
] as const;

const CLEAR_ORDER = [...INIT_ORDER].reverse();

async function seedAll() {
  console.log("Seed Kalasa — owner + support + taux + bibliothèque RDC\n");
  const start = Date.now();

  for (const script of INIT_ORDER) {
    await script.init();
  }

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\nTerminé en ${duration}s`);
  console.log("  - superAdmin (owner, email = SMTP_USER)");
  console.log("  - klambocoreSupport (même user, PlatformSupportAgent lead)");
  console.log("  - exchangeRates (4 paires / organisation)");
  console.log("  - libraryBooks (catalogue RDC open-license CC0)");
}

async function clearAll() {
  console.log("Clear seed Kalasa\n");
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
  pnpm seed                 Seed owner + support + taux + bibliothèque
  pnpm seed:library         Seed catalogue RDC uniquement
  pnpm seed:library:reset   Efface OPEN_LICENSE puis re-seed Gutenberg
  pnpm seed -- --clear      Supprime seeds (bibliothèque → … → admin)
  pnpm seed -- --list       Liste les seeds disponibles

Env bibliothèque :
  LIBRARY_SEED_BRANCH_ID       Une seule branche
  LIBRARY_SEED_MAX_BRANCHES    Limite (défaut 10)
  LIBRARY_SEED_INCLUDE_STUBS=1 Inclure PDF démo RDC (1 page) — déconseillé
  LIBRARY_STORAGE_DRIVER       local | s3
  LIBRARY_FETCH_LIMIT          Nb livres Gutendex (défaut 150)
  LIBRARY_FETCH_LANGS          Langues (défaut fr,en)

  pnpm library:fetch           Télécharge Gutenberg → JSON + EPUB complets
  pnpm seed:library            Importe les EPUB (désactive les stubs PDF)
  pnpm seed:library:reset      Écrase la base bibliothèque seed puis réimporte
  pnpm seed -- --angola-students   Élèves 7ª + 10ª (branche secondaire angolaise)
`);
    return;
  }

  if (args.includes("--list")) {
    for (const script of INIT_ORDER) {
      console.log(`  - ${script.name}`);
    }
    console.log("  - angolaSecondaryStudents (pnpm seed:angola-students)");
    return;
  }

  if (args.includes("--library-only")) {
    await seedLibraryBooks();
    return;
  }

  if (args.includes("--library-reset")) {
    await clearLibraryBooksSeed();
    await seedLibraryBooks();
    return;
  }

  if (args.includes("--angola-students")) {
    await seedAngolaSecondaryStudents();
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
