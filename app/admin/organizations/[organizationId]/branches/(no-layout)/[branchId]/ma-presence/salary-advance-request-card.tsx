"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_SALARY_ADVANCE_INSTALLMENTS,
  planAdvanceInstallments,
} from "@/lib/payroll/salary-advance";
import { CurrencyCode } from "@/prisma/generated/prisma/enums";
import {
  getMySalaryAdvanceAccessAction,
  requestSalaryAdvanceAction,
} from "../paie-enseignants/credits/salary-advance.action";

type AdvanceRow = {
  id: string;
  amount: number;
  installmentCount: number;
  currency: string;
  status: string;
  reason: string | null;
  createdAt: string;
  installments: Array<{
    sequence: number;
    year: number;
    month: number;
    amount: number;
    status: string;
  }>;
};

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Acceptée",
  SETTLED: "Soldée",
  REJECTED: "Refusée",
  CANCELLED: "Annulée",
};

function formatAmount(value: number, currency: string) {
  const code = currency || "USD";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: code,
    maximumFractionDigits: code === "USD" ? 2 : 0,
  }).format(value);
}

export default function SalaryAdvanceRequestCard() {
  const now = new Date();
  const [canRequest, setCanRequest] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [currency, setCurrency] = useState("");
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [amount, setAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState("3");
  const [firstMonth, setFirstMonth] = useState(now.getMonth() + 1);
  const [firstYear, setFirstYear] = useState(now.getFullYear());
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const [result, error] = await getMySalaryAdvanceAccessAction();
    if (error) {
      setLoaded(true);
      return;
    }
    setCanRequest(Boolean(result?.canRequest));
    setHasProfile(Boolean(result?.hasProfile));
    setCurrency(result?.currency ?? "");
    setAdvances((result?.advances ?? []) as AdvanceRow[]);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  const preview = useMemo(() => {
    const value = Number(amount);
    const count = Number(installmentCount);
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(count) || count < 1) {
      return [];
    }
    const code =
      currency === "CDF"
        ? CurrencyCode.CDF
        : currency === "AOA"
          ? CurrencyCode.AOA
          : CurrencyCode.USD;
    return planAdvanceInstallments({
      total: value,
      count,
      currency: code,
      firstYear,
      firstMonth,
    });
  }, [amount, currency, firstMonth, firstYear, installmentCount]);

  if (!loaded || !hasProfile) return null;

  async function submit() {
    setWorking(true);
    const [, error] = await requestSalaryAdvanceAction({
      amount: Number(amount),
      installmentCount: Number(installmentCount),
      firstYear,
      firstMonth,
      reason: reason.trim() || undefined,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Demande d’avance envoyée");
      setAmount("");
      setReason("");
      await load();
    }
    setWorking(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avance sur salaire</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canRequest ? (
          <p className="text-sm text-muted-foreground">
            Indiquez le montant dans la devise de base du taux actif
            {currency ? ` (${currency})` : ""} et le nombre de séances de
            remboursement (un mois = une séance). Après acceptation, le
            versement devient une dépense et chaque séance est déduite
            automatiquement du bulletin.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Le propriétaire doit vous autoriser à demander une avance depuis
            Crédits et avances sur salaire.
          </p>
        )}
        {canRequest ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                <span>Montant{currency ? ` (${currency})` : ""}</span>
                <Input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                <span>Séances (mois)</span>
                <Input
                  type="number"
                  min={1}
                  max={MAX_SALARY_ADVANCE_INSTALLMENTS}
                  value={installmentCount}
                  onChange={(event) => setInstallmentCount(event.target.value)}
                />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                <span>1re séance</span>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={firstMonth}
                  onChange={(event) => setFirstMonth(Number(event.target.value))}
                >
                  {MONTHS.map((monthName, index) => (
                    <option key={monthName} value={index + 1}>
                      {monthName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                <span>Année</span>
                <Input
                  type="number"
                  min={2000}
                  value={firstYear}
                  onChange={(event) => setFirstYear(Number(event.target.value))}
                />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground sm:col-span-2 lg:col-span-4">
                <span>Motif</span>
                <Textarea
                  rows={2}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
            </div>
            {preview.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {preview
                  .map(
                    (item) =>
                      `séance ${item.sequence} : ${MONTHS[item.month - 1]} ${item.year} · ${formatAmount(item.amount, currency)}`,
                  )
                  .join(" · ")}
              </p>
            ) : null}
            <Button onClick={() => void submit()} disabled={working || !amount}>
              Envoyer la demande
            </Button>
          </>
        ) : null}
        {advances.length > 0 ? (
          <ul className="space-y-2">
            {advances.map((row) => (
              <li key={row.id} className="rounded-lg border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{formatAmount(row.amount, row.currency)}</span>
                  <Badge variant="outline">
                    {STATUS_LABEL[row.status] ?? row.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {row.installmentCount} séance{row.installmentCount > 1 ? "s" : ""}
                  {row.reason ? ` · ${row.reason}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
