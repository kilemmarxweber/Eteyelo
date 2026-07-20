import { prisma } from "../lib/prisma";
import { startOfTodayParis, nowLocal } from "../lib/timezone";

async function main() {
  const sessions = await prisma.attendanceSession.findMany({
    where: { date: startOfTodayParis(nowLocal()) },
    select: {
      id: true,
      branchId: true,
      teachingId: true,
      startTime: true,
    },
  });
  console.log("sessions", sessions);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
