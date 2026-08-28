/**
 * CLI — seed / sync OrganizationRole presets (P2).
 *
 *   pnpm exec tsx scripts/seed-organization-roles.ts
 *   pnpm exec tsx scripts/seed-organization-roles.ts --dry-run
 *   pnpm exec tsx scripts/seed-organization-roles.ts --reset-permissions
 *   pnpm exec tsx scripts/seed-organization-roles.ts --organization-id=<id>
 */
import {
  formatSeedOrganizationRolesReport,
  seedOrganizationRolePresets,
} from "../lib/auth/seed-organization-roles";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const resetPermissions = args.includes("--reset-permissions");
  const orgArg = args.find((a) => a.startsWith("--organization-id="));
  const organizationId = orgArg?.slice("--organization-id=".length) || undefined;

  const report = await seedOrganizationRolePresets({
    dryRun,
    resetPermissions,
    organizationId,
  });

  console.log(formatSeedOrganizationRolesReport(report));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
