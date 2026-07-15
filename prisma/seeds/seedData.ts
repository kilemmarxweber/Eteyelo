import { initSchoolYears, clearSchoolYears } from "./initSchoolYears";
import {
  initOrganizationBranch,
  clearOrganizationBranch,
} from "./initOrganizationBranch";
import { initSections, clearSections } from "./initSections";
import { initOptions, clearOptions } from "./initOptions";
import { initCreneaux, clearCreneaux } from "./initCreneaux";
import { initClasses, clearClasses } from "./initClasses";
import { initCours, clearCours } from "./initCours";
import {
  initPrimaryCours,
  clearPrimaryCatalogCours,
} from "./initPrimaryCours";
import { initUsers, clearUsers } from "./initUsers";
import { initAdmin, clearAdmin } from "./initAdmin";
import {
  initPlatformOwner,
  clearPlatformOwner,
} from "./initPlatformOwner";
import {
  initPlatformSupport,
  clearPlatformSupport,
} from "./initPlatformSupport";
import { printDemoAccounts } from "./demoAccounts";
import { initTeachers, clearTeachers } from "./initTeachers";
import { initParents, clearParents } from "./initParents";
import { initStudents, clearStudents } from "./initStudents";
import {
  initClassEnrollments,
  clearClassEnrollments,
} from "./initClassEnrollments";
import { initTeaching, clearTeaching } from "./initTeaching";
import { initSchedules, clearSchedules } from "./initSchedules";
import { initTypeFrais, clearTypeFrais } from "./initTypeFrais";
import { initFrais, clearFrais } from "./initFrais";
// import { initRoles, clearRoles } from "./initRole";
import { initPeriods, clearPeriods } from "./initPeriod";
import { initMetricsEvents, clearMetricsEvents } from "./initMetricsEvents";
import { prisma as Prisma } from "@/lib/prisma";
// Ordre d'exécution des scripts (important pour les dépendances)
const INIT_ORDER = [
  {
    name: "organizationBranch",
    init: initOrganizationBranch,
    clear: clearOrganizationBranch,
  },
  { name: "schoolYears", init: initSchoolYears, clear: clearSchoolYears },
  { name: "sections", init: initSections, clear: clearSections },
  { name: "options", init: initOptions, clear: clearOptions },
  { name: "creneaux", init: initCreneaux, clear: clearCreneaux },
  { name: "classes", init: initClasses, clear: clearClasses },
  { name: "cours", init: initCours, clear: clearCours },
  { name: "primaryCours", init: initPrimaryCours, clear: clearPrimaryCatalogCours },
  { name: "users", init: initUsers, clear: clearUsers },
  { name: "platformOwner", init: initPlatformOwner, clear: clearPlatformOwner },
  { name: "admin", init: initAdmin, clear: clearAdmin },
  {
    name: "platformSupport",
    init: initPlatformSupport,
    clear: clearPlatformSupport,
  },
  { name: "teachers", init: initTeachers, clear: clearTeachers },
  { name: "parents", init: initParents, clear: clearParents },
  { name: "students", init: initStudents, clear: clearStudents },
  // { name: "roles", init: initRoles, clear: clearRoles },
  {
    name: "classEnrollments",
    init: initClassEnrollments,
    clear: clearClassEnrollments,
  },
  { name: "teaching", init: initTeaching, clear: clearTeaching },
  { name: "schedules", init: initSchedules, clear: clearSchedules },
  { name: "typeFrais", init: initTypeFrais, clear: clearTypeFrais },
  { name: "frais", init: initFrais, clear: clearFrais },
  { name: "periods", init: initPeriods, clear: clearPeriods },
  { name: "metricsEvents", init: initMetricsEvents, clear: clearMetricsEvents },
];

// Ordre inverse pour la suppression
const CLEAR_ORDER = [...INIT_ORDER].reverse();

async function seedAll() {
  console.log("🚀 Initialisation complète de la base de données...\n");

  const startTime = Date.now();

  try {
    for (const script of INIT_ORDER) {
      await script.init();
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n🎉 Initialisation complète terminée en ${duration}s`);
    console.log("\n📊 Résumé des données créées:");
    console.log("   - Années scolaires: 3");
    console.log("   - Sections: 6");
    console.log("   - Options: 16");
    console.log("   - Créneaux: 4");
    console.log("   - Classes: 10");
    console.log("   - Cours: 32");
    console.log("   - Utilisateurs: 22");
    console.log("   - Support plateforme: 3");
    printDemoAccounts();
    console.log("   - Enseignants: 6");
    console.log("   - Parents: 5");
    console.log("   - Étudiants: 10");
    console.log("   - Inscriptions: Variable");
    console.log("   - Enseignements: Variable");
    console.log("   - Horaires: Variable");
    console.log("   - Types de frais: 10");
    console.log("   - Frais scolaires: Variable");
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation:", error);
    throw error;
  }
}

async function clearAll() {
  console.log("🗑️  Suppression complète de la base de données...\n");

  const startTime = Date.now();

  try {
    for (const script of CLEAR_ORDER) {
      await script.clear();
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Suppression complète terminée en ${duration}s`);
  } catch (error) {
    console.error("❌ Erreur lors de la suppression:", error);
    throw error;
  }
}

async function seedSpecific(scriptNames: string[]) {
  console.log(`🎯 Initialisation spécifique: ${scriptNames.join(", ")}\n`);

  for (const scriptName of scriptNames) {
    const script = INIT_ORDER.find((s) => s.name === scriptName);
    if (script) {
      await script.init();
    } else {
      console.warn(`⚠️  Script '${scriptName}' non trouvé`);
    }
  }
}

async function clearSpecific(scriptNames: string[]) {
  console.log(`🗑️  Suppression spécifique: ${scriptNames.join(", ")}\n`);

  // Inverser l'ordre pour la suppression
  const reversedNames = scriptNames.reverse();

  for (const scriptName of reversedNames) {
    const script = INIT_ORDER.find((s) => s.name === scriptName);
    if (script) {
      await script.clear();
    } else {
      console.warn(`⚠️  Script '${scriptName}' non trouvé`);
    }
  }
}

function printHelp() {
  console.log(`
🎓 Système de gestion des données de test pour ETEYELO

Usage: pnpm run seed [options]

Options:
  --all, -a                    Initialiser toutes les données
  --clear, -c                  Supprimer toutes les données
  --init <scripts>             Initialiser des scripts spécifiques
  --clear-specific <scripts>   Supprimer des scripts spécifiques
  --list, -l                   Lister tous les scripts disponibles
  --help, -h                   Afficher cette aide

Scripts disponibles:
${INIT_ORDER.map((s) => `  - ${s.name}`).join("\n")}

Exemples:
  pnpm run seed --all                           # Initialiser tout
  pnpm run seed --clear                         # Supprimer tout
  pnpm run seed --init users,teachers           # Initialiser uniquement users et teachers
  pnpm run seed --clear-specific frais          # Supprimer uniquement les frais
  pnpm run seed --list                          # Lister les scripts disponibles

Ordre recommandé pour les dépendances:
1. organizationBranch, schoolYears, sections, options, creneaux, cours, users
2. teachers, parents, students, classes
3. classEnrollments, teaching, schedules
4. typeFrais, frais
`);
}

function listScripts() {
  console.log("📋 Scripts disponibles:\n");
  INIT_ORDER.forEach((script, index) => {
    console.log(`${index + 1}. ${script.name}`);
  });
}

async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
      printHelp();
      return;
    }

    if (args.includes("--list") || args.includes("-l")) {
      listScripts();
      return;
    }

    if (args.includes("--all") || args.includes("-a")) {
      await seedAll();
    } else if (args.includes("--clear") || args.includes("-c")) {
      await clearAll();
    } else if (args.includes("--init")) {
      const index = args.indexOf("--init");
      const scriptNames = args[index + 1]?.split(",") || [];
      if (scriptNames.length > 0) {
        await seedSpecific(scriptNames);
      } else {
        console.error("❌ Veuillez spécifier les scripts à initialiser");
      }
    } else if (args.includes("--clear-specific")) {
      const index = args.indexOf("--clear-specific");
      const scriptNames = args[index + 1]?.split(",") || [];
      if (scriptNames.length > 0) {
        await clearSpecific(scriptNames);
      } else {
        console.error("❌ Veuillez spécifier les scripts à supprimer");
      }
    } else {
      console.error(
        "❌ Option non reconnue. Utilisez --help pour voir les options disponibles.",
      );
    }
  } catch (error) {
    console.error("❌ Erreur:", error);
    process.exit(1);
  } finally {
    await Prisma.$disconnect();
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}

export { seedAll, clearAll, seedSpecific, clearSpecific, INIT_ORDER };
