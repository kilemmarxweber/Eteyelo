import { prisma } from "../lib/prisma";
import { DEMO_ACCOUNTS } from "../prisma/seeds/demoAccounts";

const oldSlugs = ["surveillant", "responsable", "moniteur"];

async function main() {
  const members = await prisma.member.findMany({
    select: {
      id: true,
      role: true,
      organizationId: true,
      user: { select: { email: true, username: true, role: true } },
      organization: { select: { name: true } },
    },
    orderBy: [{ organizationId: "asc" }, { role: "asc" }],
  });

  const byRole = new Map<string, number>();
  for (const m of members) {
    byRole.set(m.role, (byRole.get(m.role) ?? 0) + 1);
  }

  const legacy = members.filter((m) => {
    const tokens = m.role
      .split(/[,\s]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    return tokens.some((t) => oldSlugs.includes(t));
  });

  console.log("=== MEMBER ROLE COUNTS ===");
  for (const [role, count] of [...byRole.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    console.log(`${role}: ${count}`);
  }
  console.log("TOTAL_MEMBERS:", members.length);
  console.log("LEGACY_COUNT:", legacy.length);
  if (legacy.length) {
    console.log("LEGACY_ROWS:");
    for (const m of legacy.slice(0, 50)) {
      console.log(
        JSON.stringify({
          email: m.user.email,
          role: m.role,
          org: m.organization.name,
        }),
      );
    }
  }

  console.log("=== MEMBERS LIST (email | member.role | user.role | org) ===");
  for (const m of members) {
    console.log(
      [m.user.email, m.role, m.user.role, m.organization.name].join(" | "),
    );
  }

  console.log("=== DEMO ACCOUNTS PRESENT IN DB ===");
  for (const account of DEMO_ACCOUNTS) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: account.email }, { username: account.username }],
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        members: { select: { role: true, organizationId: true } },
      },
    });
    if (!user) {
      console.log(`MISSING: ${account.email} (${account.label})`);
      continue;
    }
    console.log(
      JSON.stringify({
        label: account.label,
        email: user.email,
        username: user.username,
        appRole: user.role,
        memberRoles: user.members.map((m) => m.role),
        expectedMemberRole: account.memberRole,
        password: account.password,
      }),
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
