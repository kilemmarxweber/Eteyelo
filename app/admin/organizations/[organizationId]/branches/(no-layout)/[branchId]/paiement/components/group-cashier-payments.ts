export const PAYMENT_METHOD_ORDER = [
  "ESPECES",
  "MPESA",
  "AIRTEL_MONEY",
  "ORANGE_MONEY",
  "CARTE",
  "BANQUE",
] as const;

export const UNKNOWN_CASHIER_KEY = "__unknown__";

export type CashierPaymentRow = {
  id: string;
  amount: number;
  transactionRef: string;
  studentName: string;
  method?: string | null;
  createdAt: string;
  createdByUserId?: string | null;
  cashierName?: string | null;
  frais?: { nameFrais: string } | null;
};

export type CashierPaymentCashierGroup<T extends CashierPaymentRow> = {
  cashierKey: string;
  cashierName: string;
  payments: T[];
  total: number;
};

export type CashierPaymentMethodGroup<T extends CashierPaymentRow> = {
  method: string;
  payments: T[];
  total: number;
  cashiers: CashierPaymentCashierGroup<T>[];
};

function methodOrderIndex(method: string) {
  const index = (PAYMENT_METHOD_ORDER as readonly string[]).indexOf(method);
  return index === -1 ? PAYMENT_METHOD_ORDER.length : index;
}

export function normalizeCashierPaymentMethod(method?: string | null) {
  const value = method?.trim();
  return value && value.length > 0 ? value : "AUTRE";
}

export function formatCashierDateTime(
  value: string | Date,
  locale?: string,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const datePart = date.toLocaleDateString(locale);
  const timePart = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} ${timePart}`;
}

export function cashierGroupKey(payment: Pick<CashierPaymentRow, "createdByUserId">) {
  const id = payment.createdByUserId?.trim();
  return id && id.length > 0 ? id : UNKNOWN_CASHIER_KEY;
}

export function cashierDisplayName(
  payment: Pick<CashierPaymentRow, "cashierName">,
): string {
  return payment.cashierName?.trim() ?? "";
}

export function groupCashierPaymentsByMethod<T extends CashierPaymentRow>(
  payments: T[],
): CashierPaymentMethodGroup<T>[] {
  const methodMap = new Map<
    string,
    Map<string, { name: string; items: T[] }>
  >();
  const sorted = [...payments].sort((a, b) => {
    const methodA = normalizeCashierPaymentMethod(a.method);
    const methodB = normalizeCashierPaymentMethod(b.method);
    const byMethod = methodOrderIndex(methodA) - methodOrderIndex(methodB);
    if (byMethod !== 0) return byMethod;
    if (methodA !== methodB) return methodA.localeCompare(methodB, "fr");

    const keyA = cashierGroupKey(a);
    const keyB = cashierGroupKey(b);
    if (keyA === UNKNOWN_CASHIER_KEY && keyB !== UNKNOWN_CASHIER_KEY) return 1;
    if (keyB === UNKNOWN_CASHIER_KEY && keyA !== UNKNOWN_CASHIER_KEY) return -1;
    const nameA = cashierDisplayName(a);
    const nameB = cashierDisplayName(b);
    const byCashier = nameA.localeCompare(nameB, "fr", { sensitivity: "base" });
    if (byCashier !== 0) return byCashier;
    if (keyA !== keyB) return keyA.localeCompare(keyB);

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  for (const payment of sorted) {
    const method = normalizeCashierPaymentMethod(payment.method);
    const cashierKey = cashierGroupKey(payment);
    const cashierName = cashierDisplayName(payment);
    let cashiers = methodMap.get(method);
    if (!cashiers) {
      cashiers = new Map();
      methodMap.set(method, cashiers);
    }
    let group = cashiers.get(cashierKey);
    if (!group) {
      group = { name: cashierName, items: [] };
      cashiers.set(cashierKey, group);
    } else if (!group.name && cashierName) {
      group.name = cashierName;
    }
    group.items.push(payment);
  }

  return Array.from(methodMap.entries()).map(([method, cashiers]) => {
    const cashierGroups: CashierPaymentCashierGroup<T>[] = Array.from(
      cashiers.entries(),
    ).map(([cashierKey, group]) => ({
      cashierKey,
      cashierName: group.name,
      payments: group.items,
      total: group.items.reduce((sum, payment) => sum + payment.amount, 0),
    }));
    const items = cashierGroups.flatMap((group) => group.payments);
    return {
      method,
      payments: items,
      total: items.reduce((sum, payment) => sum + payment.amount, 0),
      cashiers: cashierGroups,
    };
  });
}
