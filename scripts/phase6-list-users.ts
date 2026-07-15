import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      username: true,
      role: true,
      members: { select: { role: true, organization: { select: { name: true } } } },
    },
    orderBy: { email: "asc" },
  });
  console.log("USER_COUNT:", users.length);
  for (const u of users) {
    console.log(
      JSON.stringify({
        email: u.email,
        username: u.username,
        appRole: u.role,
        memberships: u.members.map((m) => `${m.role}@${m.organization.name}`),
      }),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
