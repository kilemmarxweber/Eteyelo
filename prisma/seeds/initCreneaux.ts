import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

export const creneauxData = [
  {
    nameCreneau: "Horaire Standard Matin",
    startTime: new Date("1970-01-01T07:30:00Z"),
    endTime: new Date("1970-01-01T13:30:00Z"),
    durationCourse: 55,
    recreationHour: new Date("1970-01-01T10:15:00Z"),
    recreationDuration: 15,
  },
  {
    nameCreneau: "Horaire Standard Apres-midi",
    startTime: new Date("1970-01-01T13:30:00Z"),
    endTime: new Date("1970-01-01T17:30:00Z"),
    durationCourse: 50,
    recreationHour: new Date("1970-01-01T15:15:00Z"),
    recreationDuration: 15,
  },
  {
    nameCreneau: "Horaire Complet Journee",
    startTime: new Date("1970-01-01T07:30:00Z"),
    endTime: new Date("1970-01-01T17:30:00Z"),
    durationCourse: 45,
    recreationHour: new Date("1970-01-01T10:00:00Z"),
    recreationDuration: 20,
  },
  {
    nameCreneau: "Horaire Samedi",
    startTime: new Date("1970-01-01T08:00:00Z"),
    endTime: new Date("1970-01-01T12:00:00Z"),
    durationCourse: 45,
    recreationHour: new Date("1970-01-01T10:00:00Z"),
    recreationDuration: 15,
  },
];

export async function initCreneaux() {
  console.log("Initialisation des creneaux horaires...");
  const branchId = await getSeedBranchId();
  let createdCount = 0;

  for (const creneau of creneauxData) {
    const existingCreneau = await Prisma.creneau.findFirst({
      where: {
        nameCreneau: creneau.nameCreneau,
        branchId,
      },
    });

    if (existingCreneau) {
      await Prisma.creneau.update({
        where: { id: existingCreneau.id },
        data: { ...creneau, branchId },
      });
    } else {
      await Prisma.creneau.create({
        data: { ...creneau, branchId },
      });
      createdCount++;
    }
  }

  console.log(`OK ${createdCount} nouveaux creneaux crees`);
}

export async function clearCreneaux() {
  console.log("Suppression des creneaux...");
  await Prisma.creneau.deleteMany({});
  console.log("OK creneaux supprimes");
}
