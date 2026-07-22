import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { BranchRole } from "@/prisma/generated/prisma/client";
import { prisma as Prisma } from "@/lib/prisma";
import { DEMO_PASSWORDS } from "./demoAccounts";
import { ensureSeedMember } from "./seedContext";

const personnelData = [
  {
    username: "pers.caissier",
    email: "caissier@eteyelo.cd",
    telephone: "+243812345801",
    nom: "Ilunga",
    postnom: "Mwamba",
    prenom: "Claire",
    dateOfBirth: new Date("1992-04-12"),
    sexe: "F",
    orgRole: "caissier",
    branchRole: BranchRole.CAISSIER,
  },
  {
    username: "pers.prefet",
    email: "prefet@eteyelo.cd",
    telephone: "+243812345802",
    nom: "Kabeya",
    postnom: "Ntumba",
    prenom: "Paul",
    dateOfBirth: new Date("1984-08-21"),
    sexe: "M",
    orgRole: "prefet",
    branchRole: BranchRole.DIRECTOR,
  },
  {
    username: "pers.superviseur",
    email: "superviseur@eteyelo.cd",
    telephone: "+243812345803",
    nom: "Mbuyi",
    postnom: "Kalonji",
    prenom: "Hélène",
    dateOfBirth: new Date("1989-11-03"),
    sexe: "F",
    orgRole: "superviseur",
    branchRole: BranchRole.ADMIN,
  },
];

export async function initPersonnel() {
  console.log("Initialisation du personnel...");

  const hashedPassword = await hashPassword(DEMO_PASSWORDS.teacher);
  let createdCount = 0;

  for (const person of personnelData) {
    const name = `${person.prenom} ${person.postnom} ${person.nom}`;

    const user = await Prisma.user.upsert({
      where: { username: person.username },
      update: {
        name,
        email: person.email,
        telephone: person.telephone,
        postnom: person.postnom,
        prenom: person.prenom,
        dateOfBirth: person.dateOfBirth,
        sexe: person.sexe,
        statusUser: true,
        role: "user",
      },
      create: {
        username: person.username,
        name,
        email: person.email,
        telephone: person.telephone,
        postnom: person.postnom,
        prenom: person.prenom,
        dateOfBirth: person.dateOfBirth,
        sexe: person.sexe,
        statusUser: true,
        role: "user",
        emailVerified: true,
      },
    });

    const existingAccount = await Prisma.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });

    if (existingAccount) {
      await Prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          accountId: user.id,
          password: hashedPassword,
          updatedAt: new Date(),
        },
      });
    } else {
      await Prisma.account.create({
        data: {
          id: randomUUID(),
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    const { branchMember } = await ensureSeedMember(
      user.id,
      person.orgRole,
      person.branchRole,
    );

    const existingPersonnel = await Prisma.personnel.findFirst({
      where: { branchMemberId: branchMember.id },
    });

    if (!existingPersonnel) {
      await Prisma.personnel.create({
        data: { branchMemberId: branchMember.id },
      });
      createdCount++;
    }
  }

  console.log(`OK ${createdCount} personnels créés`);
}

export async function clearPersonnel() {
  console.log("Suppression du personnel...");
  await Prisma.personnelAttendance.deleteMany({});
  await Prisma.personnel.deleteMany({});
  console.log("OK personnel supprimé");
}
