import type { Prisma } from "@/prisma/generated/prisma/client";
import { PRACTICAL_DOMAIN_CATALOG } from "@/lib/practical-domains";

type PracticalDb = Pick<
  Prisma.TransactionClient,
  "practicalDomain" | "room"
>;

/**
 * Seed les domaines pratiques système + salle sciences pour une branche atelier.
 */
export async function ensurePracticalDomainsForBranch(
  db: PracticalDb,
  branchId: string,
) {
  const domains = [];

  for (const entry of PRACTICAL_DOMAIN_CATALOG) {
    let domain = await db.practicalDomain.findUnique({
      where: {
        branchId_code: { branchId, code: entry.code },
      },
      select: {
        id: true,
        code: true,
        name: true,
        sortOrder: true,
        isSystem: true,
      },
    });

    if (!domain) {
      domain = await db.practicalDomain.create({
        data: {
          branchId,
          code: entry.code,
          name: entry.name,
          sortOrder: entry.sortOrder,
          isSystem: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          sortOrder: true,
          isSystem: true,
        },
      });
    } else if (
      domain.name !== entry.name ||
      domain.sortOrder !== entry.sortOrder ||
      !domain.isSystem
    ) {
      domain = await db.practicalDomain.update({
        where: { id: domain.id },
        data: {
          name: entry.name,
          sortOrder: entry.sortOrder,
          isSystem: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          sortOrder: true,
          isSystem: true,
        },
      });
    }

    if (entry.defaultRoomName) {
      const existingRoom = await db.room.findFirst({
        where: {
          branchId,
          OR: [
            { name: { equals: entry.defaultRoomName, mode: "insensitive" } },
            { practicalDomainId: domain.id },
          ],
        },
        select: { id: true, name: true, practicalDomainId: true },
      });

      if (!existingRoom) {
        await db.room.create({
          data: {
            branchId,
            name: entry.defaultRoomName,
            practicalDomainId: domain.id,
          },
        });
      } else if (
        existingRoom.practicalDomainId !== domain.id ||
        existingRoom.name !== entry.defaultRoomName
      ) {
        await db.room.update({
          where: { id: existingRoom.id },
          data: {
            name: entry.defaultRoomName,
            practicalDomainId: domain.id,
          },
        });
      }
    }

    domains.push(domain);
  }

  return domains;
}
