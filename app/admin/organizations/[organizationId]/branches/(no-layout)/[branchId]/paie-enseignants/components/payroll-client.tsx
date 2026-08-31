"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconRefresh, IconFileInvoice, IconCheck, IconCash, IconSettings } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth-client";
import {
  canComputePayroll,
  canPayPayroll,
  canValidatePayroll,
} from "@/lib/auth/session-roles";
import {
  getTeacherPayslipsAction,
  payTeacherPayslipAction,
  recalculateTeacherPayslipsAction,
  getPayrollPolicyAction,
  updatePayrollPolicyAction,
  validateTeacherPayslipAction,
} from "../payroll.action";

type PayslipRow = {
  id: string;
  teacherId: string;
  teacherName: string;
  employmentKind: string;
  year: number;
  month: number;
  currency: string;
  gross: number;
  deductions: number;
  net: number;
  status: string;
  sessions: number;
};

type Policy = {
  secondarySessionMinutes: number;
  primarySessionMinutes: number;
  secondaryHourlyRate: number;
  secondaryMatriculePrimePercent: number;
  secondaryNonMatriculeSessionRate: number;
  primaryMatriculeMonthly: number;
  primaryNonMatriculeMonthly: number;
  lateGraceMinutes: number;
  notifyByEmail: boolean;
};

function formatAmount(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(value);
}

function statusLabel(status: string) {
  return (
    {
      DRAFT: "Brouillon",
      VALIDATED: "Validé",
      PAID: "Payé",
      CANCELLED: "Annulé",
    }[status] ?? status
  );
}

export default function PayrollClient() {
  const params = useParams<{ organizationId: string; branchId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<PayslipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [result, error] = await getTeacherPayslipsAction({ year, month });
    if (error) toast.error(error.message);
    else setRows((result ?? []) as PayslipRow[]);
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void getPayrollPolicyAction().then(([result, error]) => {
      if (!error && result) setPolicy(result as Policy);
    });
  }, []);

  const isManager = useMemo(() => canComputePayroll(session), [session]);
  const canValidate = useMemo(() => canValidatePayroll(session), [session]);
  const canPay = useMemo(() => canPayPayroll(session), [session]);

  async function recalculate() {
    setWorking(true);
    const [result, error] = await recalculateTeacherPayslipsAction({ year, month });
    if (error) toast.error(error.message);
    else {
      if (result?.missingExchangeRate) {
        toast.warning(
          "Aucun taux sélectionné : les brouillons utilisent USD. Configurez le taux avant validation.",
        );
      }
      toast.success(`${result?.count ?? 0} bulletin(s) généré(s)`);
      await load();
    }
    setWorking(false);
  }

  async function savePolicy() {
    if (!policy) return;
    setWorking(true);
    const [, error] = await updatePayrollPolicyAction(policy);
    if (error) toast.error(error.message);
    else toast.success("Barème enregistré");
    setWorking(false);
  }

  async function mutate(
    action: (input: { payslipId: string }) => Promise<[unknown, { message: string } | null]>,
    success: string,
    id: string,
  ) {
    setWorking(true);
    const [, error] = await action({ payslipId: id });
    if (error) toast.error(error.message);
    else {
      toast.success(success);
      await load();
    }
    setWorking(false);
  }

  return (
    <Card>
      <CardHeader className="gap-4">
        <CardTitle>Bulletins mensuels</CardTitle>
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-[9rem_8rem_minmax(0,1fr)] lg:items-end">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground" htmlFor="payroll-year">
            <span>Année</span>
            <Input
              id="payroll-year"
              type="number"
              inputSize="sm"
              value={year}
              min={2000}
              max={2200}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground" htmlFor="payroll-month">
            <span>Mois</span>
            <Input
              id="payroll-month"
              type="number"
              inputSize="sm"
              value={month}
              min={1}
              max={12}
              onChange={(event) => setMonth(Number(event.target.value))}
            />
          </label>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => void load()}
              disabled={loading}
            >
              <IconRefresh size={16} />
              Actualiser
            </Button>
            {isManager ? (
              <Button
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => void recalculate()}
                disabled={working}
              >
                <IconRefresh size={16} />
                Recalculer les brouillons
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun bulletin pour cette période. Lancez un recalcul après la clôture des présences.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Enseignant</th>
                  <th className="p-2">Statut</th>
                  <th className="p-2">Brut</th>
                  <th className="p-2">Retenues</th>
                  <th className="p-2">Net</th>
                  <th className="p-2">Bulletin</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{row.teacherName || "Enseignant"}</td>
                    <td className="p-2">{row.employmentKind === "MATRICULE" ? "Matriculé" : "Non matriculé"}</td>
                    <td className="p-2">{formatAmount(row.gross, row.currency)}</td>
                    <td className="p-2 text-destructive">{formatAmount(row.deductions, row.currency)}</td>
                    <td className="p-2 font-semibold">{formatAmount(row.net, row.currency)}</td>
                    <td className="p-2"><Badge variant="outline">{statusLabel(row.status)}</Badge></td>
                    <td className="flex flex-wrap gap-1 p-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/admin/organizations/${params.organizationId}/branches/${params.branchId}/paie-enseignants/${row.id}`,
                          )
                        }
                      >
                        <IconFileInvoice size={15} />
                        Détail
                      </Button>
                      {canValidate && row.status === "DRAFT" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={working}
                          onClick={() => void mutate(validateTeacherPayslipAction, "Bulletin validé", row.id)}
                        >
                          <IconCheck size={15} />
                          Valider
                        </Button>
                      ) : null}
                      {canPay && row.status === "VALIDATED" ? (
                        <Button
                          size="sm"
                          disabled={working}
                          onClick={() => void mutate(payTeacherPayslipAction, "Bulletin marqué payé", row.id)}
                        >
                          <IconCash size={15} />
                          Payer
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {policy ? (
        <CardContent className="border-t pt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">Barème de la branche</p>
              <p className="text-xs text-muted-foreground">
                Les montants utilisent la devise de base de l’organisation.
              </p>
            </div>
            {isManager ? (
              <Button size="sm" variant="outline" onClick={() => void savePolicy()} disabled={working}>
                <IconSettings size={15} /> Enregistrer
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["secondarySessionMinutes", "Secondaire : durée (min)"],
              ["primarySessionMinutes", "Primaire : durée (min)"],
              ["secondaryHourlyRate", "Secondaire matriculé : taux horaire"],
              ["secondaryMatriculePrimePercent", "Prime école (%)"],
              ["secondaryNonMatriculeSessionRate", "Secondaire non matriculé : séance"],
              ["primaryMatriculeMonthly", "Primaire matriculé : forfait"],
              ["primaryNonMatriculeMonthly", "Primaire non matriculé : forfait"],
              ["lateGraceMinutes", "Franchise retard (min)"],
            ] as Array<[keyof Policy, string]>).map(([key, label]) => (
              <label key={key} className="space-y-1 text-xs text-muted-foreground">
                <span>{label}</span>
                <Input
                  type="number"
                  value={policy[key] as number}
                  disabled={!isManager || working}
                  onChange={(event) =>
                    setPolicy((current) =>
                      current ? { ...current, [key]: Number(event.target.value) } : current,
                    )
                  }
                />
              </label>
            ))}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
