import "server-only";

import { prisma } from "@/lib/prisma";
import { AppNotificationType } from "@/prisma/generated/prisma/client";
import { getBaseCurrency } from "@/lib/exchange-rate";
import { sendParentPaymentNotificationEmail } from "@/lib/email/send-parent-payment-notification-email";
import type { ParentPaymentNotifyKind } from "@/lib/email/send-parent-payment-notification-email";

const linkedUserInclude = {
  branchMember: {
    include: {
      member: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              telephone: true,
              prenom: true,
              name: true,
              postnom: true,
            },
          },
        },
      },
    },
  },
} as const;

type LinkedUser = {
  id: string;
  email: string | null;
  telephone: string | null;
  prenom: string | null;
  name: string | null;
  postnom: string | null;
};

function getLinkedUser(record: {
  branchMember?: { member?: { user?: LinkedUser | null } | null } | null;
} | null): LinkedUser | null {
  return record?.branchMember?.member?.user ?? null;
}

function fullName(user: LinkedUser | null) {
  if (!user) return "";
  return [user.prenom, user.name, user.postnom].filter(Boolean).join(" ").trim();
}

function formatAmount(amount: number, currency: string) {
  const rounded =
    currency === "USD" ? amount.toFixed(2) : String(Math.round(amount));
  return `${rounded} ${currency}`;
}

/** Notifie le parent sans bloquer la caisse (e-mail, WhatsApp, cloche). */
export function notifyParentOfPayment(input: {
  organizationId: string;
  branchId: string;
  kind: ParentPaymentNotifyKind;
  paymentIds: string[];
  currency?: string;
}): void {
  if (!input.paymentIds.length) return;
  void notifyParentOfPaymentNow(input).catch((error) => {
    console.error(
      "[notifyParentOfPayment]",
      error instanceof Error ? error.message : error,
    );
  });
}

export async function notifyParentOfPaymentNow(input: {
  organizationId: string;
  branchId: string;
  kind: ParentPaymentNotifyKind;
  paymentIds: string[];
  currency?: string;
}): Promise<void> {
  const uniqueIds = Array.from(new Set(input.paymentIds.filter(Boolean)));
  if (!uniqueIds.length) return;

  const [org, branch, payments, rateRows] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { notifyParentOnPayment: true, name: true },
    }),
    prisma.branch.findFirst({
      where: { id: input.branchId, organizationId: input.organizationId },
      select: { name: true },
    }),
    prisma.familyPayment.findMany({
      where: { id: { in: uniqueIds }, branchId: input.branchId },
      include: {
        frais: { select: { nameFrais: true } },
        parent: { include: linkedUserInclude },
        classEnrollment: {
          include: {
            student: { include: linkedUserInclude },
          },
        },
      },
    }),
    prisma.exchangeRate.findMany({
      where: { organizationId: input.organizationId, isActive: true },
      select: {
        fromCurrency: true,
        toCurrency: true,
        rate: true,
        isActive: true,
        isSelected: true,
      },
    }),
  ]);

  if (!org?.notifyParentOnPayment || payments.length === 0) return;

  const schoolName = branch?.name?.trim() || org.name;
  const currency = input.currency?.trim() || getBaseCurrency(rateRows);
  const grouped = new Map<
    string,
    {
      parentUserId: string | null;
      email: string | null;
      phone: string | null;
      parentName: string;
      reference: string;
      total: number;
      students: Set<string>;
      fees: Set<string>;
    }
  >();

  for (const payment of payments) {
    const parentUser = getLinkedUser(payment.parent);
    const studentUser = getLinkedUser(payment.classEnrollment?.student ?? null);
    const groupKey =
      parentUser?.id ||
      parentUser?.email ||
      parentUser?.telephone ||
      payment.transactionRef;

    const current = grouped.get(groupKey) ?? {
      parentUserId: parentUser?.id ?? null,
      email: parentUser?.email ?? null,
      phone: parentUser?.telephone ?? null,
      parentName: fullName(parentUser) || "Parent",
      reference: payment.transactionRef,
      total: 0,
      students: new Set<string>(),
      fees: new Set<string>(),
    };

    current.total += Number(payment.amount) || 0;
    const studentName = fullName(studentUser);
    if (studentName) current.students.add(studentName);
    if (payment.frais?.nameFrais) current.fees.add(payment.frais.nameFrais);
    grouped.set(groupKey, current);
  }

  const titles: Record<ParentPaymentNotifyKind, string> = {
    created: "Paiement enregistré",
    updated: "Paiement modifié",
    deleted: "Paiement annulé",
  };

  await Promise.all(
    Array.from(grouped.values()).map(async (group) => {
      const amountLabel = formatAmount(group.total, currency);
      const studentNames = Array.from(group.students).join(", ");
      const feeNames = Array.from(group.fees).join(", ");

      await sendParentPaymentNotificationEmail({
        to: group.email,
        phone: group.phone,
        parentName: group.parentName,
        schoolName,
        kind: input.kind,
        reference: group.reference,
        amountLabel,
        studentNames,
        feeNames,
        organizationId: input.organizationId,
      });

      if (!group.parentUserId) return;

      await prisma.appNotification.create({
        data: {
          branchId: input.branchId,
          userId: group.parentUserId,
          type: AppNotificationType.PAYMENT,
          title: titles[input.kind],
          body: `${amountLabel} — ${studentNames || group.reference}`,
        },
      });
    }),
  );
}
