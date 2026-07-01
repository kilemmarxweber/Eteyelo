#!/usr/bin/env node

import { prisma as Prisma } from "@/lib/prisma";
import { initSchoolYears } from "./initSchoolYears";
import { initSections } from "./initSections";
import { initOptions } from "./initOptions";
import { initUsers } from "./initUsers";
import { initAdmin } from "./initAdmin";

async function quickDemo() {
  console.log("🚀 Démonstration rapide ETEYELO - Données minimales\n");

  const startTime = Date.now();

  try {
    // Données de base nécessaires
    await initSchoolYears();
    await initSections();
    await initOptions();
    await initUsers();
    await initAdmin();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n🎉 Démonstration terminée en ${duration}s`);
    console.log("\n📊 Données créées:");
    console.log("   ✅ 3 années scolaires");
    console.log("   ✅ 7 sections");
    console.log("   ✅ 15 options");
    console.log(
      "   ✅ 22 utilisateurs (admin, enseignants, parents, étudiants)",
    );
    console.log("   ✅ 1 administrateur");

    console.log("\n🔑 Connexions de test:");
    console.log("   👨‍💼 Admin: admin / Admin123!");
    console.log("   👨‍🏫 Enseignant: prof.mukendi / Password123!");
    console.log("   👨‍👩‍👧‍👦 Parent: parent.kasongo / Password123!");
    console.log("   🎓 Étudiant: eleve.kasongo.junior / Student123!");

    console.log("\n➡️  Pour des données complètes: pnpm run seed:all");
  } catch (error) {
    console.error("❌ Erreur lors de la démonstration:", error);
    throw error;
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  quickDemo()
    .catch((error) => {
      console.error("❌ Erreur:", error);
      process.exit(1);
    })
    .finally(async () => {
      await Prisma.$disconnect();
    });
}

export { quickDemo };
