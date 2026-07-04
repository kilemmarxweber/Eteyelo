"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type RegisterStudentInput = {
  branchId: string;

  parentName: string;
  parentEmail: string;
  parentPhone?: string;

  studentName: string;
  studentEmail?: string;
  studentPhone?: string;

  provenanceEcole?: string;
  suppositionClasseName?: string;
  suppositionSection?: string;
  suppositionOption?: string;
};

export async function getActiveBranches() {
  return prisma.branch.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      ville: true,
      pays: true,
      image: true,
    },
  });
}

export async function registerStudentOnline(data: RegisterStudentInput) {
  if (
    !data.branchId ||
    !data.parentName ||
    !data.parentEmail ||
    !data.studentName
  ) {
    return {
      success: false,
      message: "Veuillez remplir les champs obligatoires.",
    };
  }

  const branch = await prisma.branch.findUnique({
    where: {
      id: data.branchId,
    },
    select: {
      id: true,
      name: true,
      organizationId: true,
    },
  });

  if (!branch) {
    return {
      success: false,
      message: "École introuvable.",
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const parentUser = await tx.user.create({
      data: {
        name: data.parentName,
        email: data.parentEmail,
        phone: data.parentPhone || null,
      },
    });

    const parentBranchMember = await tx.branchMember.create({
      data: {
        branchId: branch.id,
        userId: parentUser.id,
        role: "PARENT",
      },
    });

    const parent = await tx.parent.create({
      data: {
        branchMemberId: parentBranchMember.id,
      },
    });

    const studentUser = await tx.user.create({
      data: {
        name: data.studentName,
        email: data.studentEmail || null,
        phone: data.studentPhone || null,
      },
    });

    const studentBranchMember = await tx.branchMember.create({
      data: {
        branchId: branch.id,
        userId: studentUser.id,
        role: "STUDENT",
      },
    });

    const student = await tx.student.create({
      data: {
        parentId: parent.id,
        branchMemberId: studentBranchMember.id,
        provenanceEcole: data.provenanceEcole || null,
        suppositionClasseName: data.suppositionClasseName || null,
        suppositionSection: data.suppositionSection || null,
        suppositionOption: data.suppositionOption || null,
      },
    });

    return {
      parent,
      student,
      parentUser,
      studentUser,
    };
  });

  // Ici tu peux brancher Resend / Nodemailer.
  // Exemple logique :
  // await sendMailToAdmin(...)
  // await sendMailToParent(...)

  revalidatePath("/inscription-eleve");

  return {
    success: true,
    message: "Inscription envoyée avec succès.",
    data: result,
  };
}
