#!/usr/bin/env node

import { prisma as Prisma } from "@/lib/prisma";
import { initOrganizationBranch } from "./initOrganizationBranch";
import { initUsers } from "./initUsers";
import { initPlatformOwner } from "./initPlatformOwner";
import { initAdmin } from "./initAdmin";
import { initPlatformSupport } from "./initPlatformSupport";
import { initTeachers } from "./initTeachers";
import { initParents } from "./initParents";
import { initStudents } from "./initStudents";
import { printDemoAccounts } from "./demoAccounts";

async function quickDemo() {
  console.log("Demonstration rapide ETEYELO - comptes par role\n");

  const startTime = Date.now();

  try {
    await initOrganizationBranch();
    await initUsers();
    await initPlatformOwner();
    await initAdmin();
    await initPlatformSupport();
    await initTeachers();
    await initParents();
    await initStudents();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\nDemonstration terminee en ${duration}s`);
    printDemoAccounts();
    console.log("\nPour des donnees completes: pnpm run seed:all");
  } catch (error) {
    console.error("Erreur lors de la demonstration:", error);
    throw error;
  }
}

if (require.main === module) {
  quickDemo()
    .catch((error) => {
      console.error("Erreur:", error);
      process.exit(1);
    })
    .finally(async () => {
      await Prisma.$disconnect();
    });
}

export { quickDemo };
