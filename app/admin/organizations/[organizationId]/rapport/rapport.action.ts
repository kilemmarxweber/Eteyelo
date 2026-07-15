"use server";

import { prisma } from "@/lib/prisma";
import { guardOrganizationAccess } from "@/lib/auth/require-organization-permission";

type ReportParams = {
  organizationId: string;
  branchId?: string;
};

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
  }).format(date);
}

export async function getOrganizationReportData({
  organizationId,
  branchId,
}: ReportParams) {
  const guard = await guardOrganizationAccess(organizationId);
  if (!guard.ok) {
    throw new Error(guard.message);
  }

  const branchWhere = branchId
    ? { id: branchId, organizationId }
    : { organizationId };

  const branches = await prisma.branch.findMany({
    where: {
      organizationId,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });

  const selectedBranchId = branchId || branches[0]?.id || "";

  const branchFilter = selectedBranchId
    ? { branchId: selectedBranchId }
    : { branch: { organizationId } };

  const [
    students,
    payments,
    expenses,
    attendances,
    classes,
    teachers,
    parents,
  ] = await Promise.all([
    prisma.student.findMany({
      where: {
        branchMember: branchFilter,
      },
      include: {
        branchMember: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
          },
        },
        classEnrollment: {
          include: {
            classe: true,
            schoolYear: true,
          },
        },
      },
    }),

    prisma.familyPayment.findMany({
      where: branchFilter,
      select: {
        amount: true,
        status: true,
        createdAt: true,
      },
    }),

    prisma.cashierExpense.findMany({
      where: branchFilter,
      select: {
        amount: true,
        category: true,
        createdAt: true,
      },
    }),

    prisma.studentAttendance.findMany({
      where: branchFilter,
      select: {
        status: true,
        recordedAt: true,
      },
    }),

    prisma.classe.findMany({
      where: selectedBranchId
        ? { branchId: selectedBranchId }
        : { branch: { organizationId } },
      select: {
        id: true,
        nameClasse: true,
        classEnrollment: true,
      },
      orderBy: {
        nameClasse: "asc",
      },
    }),

    prisma.branchMember.count({
      where: {
        ...branchFilter,
        role: "TEACHER",
      },
    }),

    prisma.branchMember.count({
      where: {
        ...branchFilter,
        role: "PARENT",
      },
    }),
  ]);

  const totalPayments = payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0,
  );

  const boys = students.filter(
    (student) => student.branchMember.member.user.sexe === "M",
  ).length;

  const girls = students.filter(
    (student) => student.branchMember.member.user.sexe === "F",
  ).length;

  const activeStudents = students.filter(
    (student) => student.statusStudent === true,
  ).length;

  const inactiveStudents = students.length - activeStudents;

  const studentsByClass = classes.map((classe) => ({
    name: classe.nameClasse,
    total: classe.classEnrollment.length,
  }));

  const attendanceStats = [
    {
      name: "Présents",
      value: attendances.filter((item) => item.status === "PRESENT").length,
    },
    {
      name: "Absents",
      value: attendances.filter((item) => item.status === "ABSENT").length,
    },
    {
      name: "Retards",
      value: attendances.filter((item) => item.status === "LATE").length,
    },
    {
      name: "Excusés",
      value: attendances.filter((item) => item.status === "EXCUSED").length,
    },
  ];

  const paymentByMonth = new Map<
    string,
    {
      month: string;
      paiements: number;
      depenses: number;
    }
  >();

  payments.forEach((payment) => {
    const month = monthLabel(payment.createdAt);
    const current = paymentByMonth.get(month) ?? {
      month,
      paiements: 0,
      depenses: 0,
    };

    current.paiements += Number(payment.amount);
    paymentByMonth.set(month, current);
  });

  expenses.forEach((expense) => {
    const month = monthLabel(expense.createdAt);
    const current = paymentByMonth.get(month) ?? {
      month,
      paiements: 0,
      depenses: 0,
    };

    current.depenses += Number(expense.amount);
    paymentByMonth.set(month, current);
  });

  return {
    branches,
    selectedBranchId,
    summary: {
      totalStudents: students.length,
      activeStudents,
      inactiveStudents,
      boys,
      girls,
      teachers,
      parents,
      totalPayments,
      totalExpenses,
      balance: totalPayments - totalExpenses,
    },
    studentsByClass,
    attendanceStats,
    genderStats: [
      { name: "Garçons", value: boys },
      { name: "Filles", value: girls },
    ],
    statusStats: [
      { name: "Actifs", value: activeStudents },
      { name: "Inactifs", value: inactiveStudents },
    ],
    financeByMonth: Array.from(paymentByMonth.values()),
  };
}
