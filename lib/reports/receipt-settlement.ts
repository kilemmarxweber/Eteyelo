export type ReceiptSettlementStatus = "SOLDE" | "ACOMPTE" | "COMPLEMENT";

const SETTLED_EPS = 0.005;

export function resolveReceiptSettlementStatus(input: {
  remainingBefore: number;
  paidThisTime: number;
  alreadyPaidBefore: number;
}): ReceiptSettlementStatus {
  const remainingBefore = Math.max(Number(input.remainingBefore) || 0, 0);
  const paidThisTime = Math.max(Number(input.paidThisTime) || 0, 0);
  const alreadyPaidBefore = Math.max(Number(input.alreadyPaidBefore) || 0, 0);
  const remainingAfter = remainingBefore - paidThisTime;

  if (remainingAfter <= SETTLED_EPS) return "SOLDE";
  if (alreadyPaidBefore <= SETTLED_EPS) return "ACOMPTE";
  return "COMPLEMENT";
}

export function inferSettlementFromAmounts(
  due?: number | null,
  paid?: number | null,
): ReceiptSettlementStatus | null {
  const dueAmount = Number(due);
  const paidAmount = Number(paid);
  if (!Number.isFinite(dueAmount) || dueAmount <= 0) return null;
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) return null;
  if (paidAmount >= dueAmount - SETTLED_EPS) return "SOLDE";
  return "ACOMPTE";
}

export function formatReceiptSettlementStatus(
  status?: ReceiptSettlementStatus | null,
): string {
  switch (status) {
    case "SOLDE":
      return "Soldé";
    case "ACOMPTE":
      return "Acompte";
    case "COMPLEMENT":
      return "Complément";
    default:
      return "";
  }
}

export function receiptItemStatusLabel(item: {
  settlementStatus?: ReceiptSettlementStatus | null;
  price?: number | null;
  montant?: number | null;
}): string {
  const status =
    item.settlementStatus ??
    inferSettlementFromAmounts(item.price, item.montant);
  return formatReceiptSettlementStatus(status) || "-";
}

export function resolveOverallReceiptSettlementStatus(
  items: Array<{ settlementStatus?: ReceiptSettlementStatus | null }>,
): ReceiptSettlementStatus | undefined {
  const statuses = items
    .map((item) => item.settlementStatus)
    .filter((status): status is ReceiptSettlementStatus => Boolean(status));

  if (!statuses.length) return undefined;
  if (statuses.every((status) => status === "SOLDE")) return "SOLDE";
  if (statuses.some((status) => status === "COMPLEMENT")) return "COMPLEMENT";
  if (statuses.some((status) => status === "ACOMPTE")) return "ACOMPTE";
  return "SOLDE";
}
