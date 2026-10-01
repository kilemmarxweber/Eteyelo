import "server-only";

import { prisma } from "@/lib/prisma";
import { AppNotificationType } from "@/prisma/generated/prisma/client";
import { getBaseCurrency } from "@/lib/exchange-rate";
import { sendParentPaymentNotificationEmail } from "@/lib/email/send-parent-payment-notification-email";
import type { ParentPaymentNotifyKind } from "@/lib/email/send-parent-payment-notification-email";
import { resolveNotificationChannels } from "@/lib/notification-channels";

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

type NotifyGroup = {
  parentUserId: string | null;
  email: string | null;
  phone: string | null;
  parentName: string;
  reference: string;
  total: number;
  students: string[];
  fees: string[];
};

type NotifySnapshot = {
  organizationId: string;
  branchId: string;
  kind: ParentPaymentNotifyKind;
  schoolName: string;
  currency: string;
  allowEmail: boolean;
  allowWhatsapp: boolean;
  groups: NotifyGroup[];
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

async function loadParentPaymentNotifySnapshot(input: {
  organizationId: string;
  branchId: string;
  kind: ParentPaymentNotifyKind;
  paymentIds: string[];
  currency?: string;
}): Promise<NotifySnapshot | null> {
  const uniqueIds = Array.from(new Set(input.paymentIds.filter(Boolean)));
  if (!uniqueIds.length) return null;

  const [org, branch, payments, rateRows, allow] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { name: true },
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
    resolveNotificationChannels(input.organizationId, "payment"),
  ]);

  if (!org || payments.length === 0) return null;
  if (!allow.email && !allow.whatsapp) return null;

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

  return {
    organizationId: input.organizationId,
    branchId: input.branchId,
    kind: input.kind,
    schoolName: branch?.name?.trim() || org.name,
    currency: input.currency?.trim() || getBaseCurrency(rateRows),
    allowEmail: allow.email,
    allowWhatsapp: allow.whatsapp,
    groups: Array.from(grouped.values()).map((group) => ({
      parentUserId: group.parentUserId,
      email: group.email,
      phone: group.phone,
      parentName: group.parentName,
      reference: group.reference,
      total: group.total,
      students: Array.from(group.students),
      fees: Array.from(group.fees),
    })),
  };
}

async function sendParentPaymentNotifyFromSnapshot(
  snapshot: NotifySnapshot,
): Promise<void> {
  if (!snapshot.groups.length) return;
  if (!snapshot.allowEmail && !snapshot.allowWhatsapp) return;

  const titles: Record<ParentPaymentNotifyKind, string> = {
    created: "Paiement enregistré",
    updated: "Paiement modifié",
    deleted: "Paiement annulé",
  };

  await Promise.all(
    snapshot.groups.map(async (group) => {
      try {
        const amountLabel = formatAmount(group.total, snapshot.currency);
        const studentNames = group.students.join(", ");
        const feeNames = group.fees.join(", ");

        await sendParentPaymentNotificationEmail({
          to: group.email,
          phone: group.phone,
          parentName: group.parentName,
          schoolName: snapshot.schoolName,
          kind: snapshot.kind,
          reference: group.reference,
          amountLabel,
          studentNames,
          feeNames,
          organizationId: snapshot.organizationId,
          branchId: snapshot.branchId,
        });

        if (!group.parentUserId) return;

        await prisma.appNotification.create({
          data: {
            branchId: snapshot.branchId,
            userId: group.parentUserId,
            type: AppNotificationType.PAYMENT,
            title: titles[snapshot.kind],
            body: `${amountLabel} — ${studentNames || group.reference}`,
          },
        });
      } catch (error) {
        // Un numéro sans WhatsApp / échec unitaire ne bloque pas les autres parents.
        console.warn(
          "[notifyParentOfPayment] skip destinataire",
          group.phone || group.email,
          error instanceof Error ? error.message : error,
        );
      }
    }),
  );
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

/**
 * Pour une suppression : charge le snapshot tant que le paiement existe,
 * puis envoie e-mail/WhatsApp en arrière-plan (ne bloque pas la réponse).
 */
export async function queueParentPaymentDeleteNotify(input: {
  organizationId: string;
  branchId: string;
  paymentIds: string[];
  currency?: string;
}): Promise<void> {
  if (!input.paymentIds.length) return;
  try {
    const snapshot = await loadParentPaymentNotifySnapshot({
      ...input,
      kind: "deleted",
    });
    if (!snapshot) return;
    void sendParentPaymentNotifyFromSnapshot(snapshot).catch((error) => {
      console.error(
        "[queueParentPaymentDeleteNotify]",
        error instanceof Error ? error.message : error,
      );
    });
  } catch (error) {
    console.error(
      "[queueParentPaymentDeleteNotify]",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function notifyParentOfPaymentNow(input: {
  organizationId: string;
  branchId: string;
  kind: ParentPaymentNotifyKind;
  paymentIds: string[];
  currency?: string;
}): Promise<void> {
  const snapshot = await loadParentPaymentNotifySnapshot(input);
  if (!snapshot) return;
  await sendParentPaymentNotifyFromSnapshot(snapshot);
}
