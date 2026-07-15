#!/usr/bin/env node

import { prisma } from "@/lib/prisma";
import {
  auditOrganizationRolesForCli,
  formatMigrationReport,
  migrateOrganizationRoles,
} from "@/lib/auth/migrate-organization-roles";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const auditOnly = args.includes("--audit");

  if (auditOnly) {
    console.log(await auditOrganizationRolesForCli());
    return;
  }

  const report = await migrateOrganizationRoles({ dryRun });
  console.log(formatMigrationReport(report));

  if (dryRun) {
    console.log("\nAucune modification appliquee (dry-run).");
    console.log("Relancez sans --dry-run pour appliquer la migration.");
  }
}

main()
  .catch((error) => {
    console.error("Erreur migration:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
