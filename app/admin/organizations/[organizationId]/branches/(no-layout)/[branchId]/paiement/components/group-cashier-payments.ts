export const PAYMENT_METHOD_ORDER = [
  "ESPECES",
  "MPESA",
  "AIRTEL_MONEY",
  "ORANGE_MONEY",
  "CARTE",
  "BANQUE",
] as const;

export type CashierPaymentRow = {
  id: string;
  amount: number;
  transactionRef: string;
  studentName: string;
  method?: string | null;
  createdAt: string;
  frais?: { nameFrais: string } | null;
};

export type CashierPaymentMethodGroup<T extends CashierPaymentRow> = {
  method: string;
  payments: T[];
  total: number;
};

function methodOrderIndex(method: string) {
  const index = (PAYMENT_METHOD_ORDER as readonly string[]).indexOf(method);
  return index === -1 ? PAYMENT_METHOD_ORDER.length : index;
}

export function normalizeCashierPaymentMethod(method?: string | null) {
  const value = method?.trim();
  return value && value.length > 0 ? value : "AUTRE";
}

export function groupCashierPaymentsByMethod<T extends CashierPaymentRow>(
  payments: T[],
): CashierPaymentMethodGroup<T>[] {
  const map = new Map<string, T[]>();
  const sorted = [...payments].sort((a, b) => {
    const methodA = normalizeCashierPaymentMethod(a.method);
    const methodB = normalizeCashierPaymentMethod(b.method);
    const byMethod = methodOrderIndex(methodA) - methodOrderIndex(methodB);
    if (byMethod !== 0) return byMethod;
    if (methodA !== methodB) return methodA.localeCompare(methodB, "fr");
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  for (const payment of sorted) {
    const method = normalizeCashierPaymentMethod(payment.method);
    const list = map.get(method);
    if (list) {
      list.push(payment);
    } else {
      map.set(method, [payment]);
    }
  }

  return Array.from(map.entries()).map(([method, items]) => ({
    method,
    payments: items,
    total: items.reduce((sum, payment) => sum + payment.amount, 0),
  }));
}
