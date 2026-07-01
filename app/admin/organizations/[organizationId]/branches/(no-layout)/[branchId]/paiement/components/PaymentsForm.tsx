"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  paiementSchema,
  ModePaiement,
  StatusPaiement,
} from "@/src/interfaces/Paiement";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, Printer } from "lucide-react";

import { createPaiementAction, getFraisWithBalance } from "../paiement.action";

import FamilySelector from "./FamilySelector";
import z from "zod";
import { MultiSelect } from "./MultiSelect";
import {
  FacturePaymentStudentData,
  generateFacturePaymentStudentPDF,
} from "@/components/FacturePaymentStudent";

type FormData = z.infer<typeof paiementSchema>;

interface Props {
  fraisList: any;
  classEnrollList: any;
  onPaymentCreated?: () => void;
}

function buildTransactionRef() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const day = now.getDate().toString().padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `TRNS-${year}-${day}-${rand}`;
}

const emptyAmount = undefined as unknown as number;

export default function PaymentsForm({
  fraisList,
  classEnrollList,
  onPaymentCreated,
}: Props) {
  const { register, handleSubmit, setValue, watch, reset } = useForm<FormData>({
    resolver: zodResolver(paiementSchema),
    defaultValues: {
      amount: emptyAmount,
      modePaiement: ModePaiement.ESPECES,
      status: StatusPaiement.VALIDE,
      fraisIds: [],
      classEnrollIds: [],
      parentId: "",
      notes: "",
    },
  });

  const [balances, setBalances] = useState<any[]>([]);
  const [selection, setSelection] = useState({
    parentId: "",
    classEnrollIds: [] as string[],
  });
  const [amountWarning, setAmountWarning] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [transactionRef, setTransactionRef] = useState(buildTransactionRef);
  const [schoolYearId, setSchoolYearId] = useState<string>("");
  const [familyResetKey, setFamilyResetKey] = useState(0);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptData, setReceiptData] =
    useState<FacturePaymentStudentData | null>(null);
  const [printMessage, setPrintMessage] = useState("");
  const rawAmount = watch("amount");
  const amount = Number.isFinite(Number(rawAmount)) ? Number(rawAmount) : 0;
  const fraisIds = watch("fraisIds") || [];

  const selectedClasseIds = useMemo(() => {
    if (!selection.classEnrollIds.length) return [];

    return Array.from(
      new Set(
        classEnrollList
          .filter((enrollment: any) =>
            selection.classEnrollIds.includes(enrollment.id),
          )
          .map((enrollment: any) => enrollment.classeId)
          .filter(Boolean),
      ),
    );
  }, [classEnrollList, selection.classEnrollIds]);

  // ================= TRANSACTION REF =================
  useEffect(() => {
    setTransactionRef(buildTransactionRef());
  }, []);

  // ================= BALANCES =================
  useEffect(() => {
    const fetch = async () => {
      if (!selection.classEnrollIds.length || !fraisIds.length) {
        setBalances([]);
        setDiscountValue(0);
        return;
      }

      const data = await getFraisWithBalance(
        selection.classEnrollIds,
        fraisIds,
        selection.parentId,
      );

      setBalances(data.items);
      setDiscountValue(data.discount);
    };

    fetch();
  }, [selection.classEnrollIds, fraisIds]);
  // 🔥 AUTO HIDE WARNING (30s)
  useEffect(() => {
    if (!amountWarning) return;

    const timer = setTimeout(() => {
      setAmountWarning(null);
    }, 10000); // 30 secondes

    return () => clearTimeout(timer);
  }, [amountWarning]);
  // ================= MAP =================
  const balanceMap = useMemo(() => {
    return Object.fromEntries((balances || []).map((b: any) => [b.fraisId, b]));
  }, [balances]);

  // ================= SUMMARY =================
  const summary = useMemo(() => {
    let totalDue = 0;
    let alreadyPaid = 0;

    const studentCount = selection.classEnrollIds.length || 1;

    for (const b of balances) {
      totalDue += Number(b.total ?? 0);
      alreadyPaid += Number(b.alreadyPaid ?? 0);
    }

    const totalGlobal = totalDue * studentCount;
    const alreadyPaidGlobal = alreadyPaid * studentCount;

    // ================= DISCOUNT =================
    const discountAmount = (totalGlobal * discountValue) / 100;

    // 🔥 STEP 1: TOTAL NET APRÈS REMISE
    const totalDueNet = Math.max(totalGlobal - discountAmount, 0);

    // 🔥 STEP 2: RESTE À PAYER
    const remaining = Math.max(totalDueNet - alreadyPaidGlobal, 0);

    return {
      transaction: transactionRef,
      totalDue: totalGlobal,
      totalDueNet, // ✅ IMPORTANT
      alreadyPaid: alreadyPaidGlobal,
      discount: discountValue,
      discountAmount,
      remaining,
      studentCount,
    };
  }, [balances, discountValue, selection.classEnrollIds, transactionRef]);

  // ================= 🏦 BANK SYSTEM: LOCKED STATES =================
  const isSolded = summary.remaining <= 0;
  const hasNoSelection = !selection.classEnrollIds.length || !fraisIds.length;

  const handlePrintReceipt = () => {
    if (!receiptData) return;

    generateFacturePaymentStudentPDF(receiptData);
    setPrintMessage("Recu genere. Vous pouvez lancer l'impression depuis le PDF.");
    toast.success("Recu genere avec succes");
  };

  // ================= SUBMIT =================
  const onSubmit = async (data: FormData) => {
    try {
      // 🏦 BANK CHECK 1: Already paid?
      if (isSolded) {
        toast.error("❌ Impossible: Ce dossier est déjà entièrement soldé.");
        return;
      }

      // 🏦 BANK CHECK 2: Selection complete?
      if (hasNoSelection) {
        toast.error(
          "❌ Impossible: Sélectionnez un élève et au moins un frais.",
        );
        return;
      }

      // 🏦 BANK CHECK 3: Valid amount?
      const inputAmount = Number.isFinite(Number(data.amount))
        ? Number(data.amount)
        : 0;
      if (!inputAmount || inputAmount <= 0) {
        toast.error("❌ Impossible: Montant doit être > 0");
        return;
      }

      setLoading(true);

      // 🏦 BANK CHECK 4: Amount cap + Refund calculation
      const finalAmount = Math.min(inputAmount, summary.remaining);
      const refundAmount = Math.max(inputAmount - summary.remaining, 0);

      // 💰 Show refund warning if applicable
      if (refundAmount > 0) {
        setAmountWarning(
          `💰 Montant saisi: ${inputAmount} | À payer: ${finalAmount} | Remboursement: ${refundAmount}`,
        );
      }

      const [res, err] = await createPaiementAction({
        ...data,
        parentId: selection.parentId,
        classEnrollIds: selection.classEnrollIds,
        transactionRef,
        amount: finalAmount,
      });

      if (err) {
        toast.error(`❌ ${err.message}`);
        return;
      }

      // 🏦 Backend says: Already paid (BANK SYSTEM)
      if (res?.isSolded || res?.message?.includes("déjà soldé")) {
        toast.warning(
          `⚠️ ${res?.message || "Ce dossier est déjà entièrement soldé"}`,
        );
        setSelection({ parentId: "", classEnrollIds: [] });
        return;
      }

      if (!res || res.totalPaid === 0) {
        toast.warning(`⚠️ ${res?.message || "Aucun paiement effectué"}`);
        return;
      }

      // 💰 Show success with refund info if applicable
      const successMsg =
        refundAmount > 0
          ? `✅ Paiement: ${finalAmount} | Remboursement: ${refundAmount}`
          : `✅ ${res?.message || "Paiement enregistré avec succès"}`;

      toast.success(successMsg);
      if (res.receipt) {
        setReceiptData(res.receipt);
        setPrintMessage("");
        setReceiptDialogOpen(true);
      }

      reset({
        amount: emptyAmount,
        modePaiement: ModePaiement.ESPECES,
        status: StatusPaiement.VALIDE,
        fraisIds: [],
        classEnrollIds: [],
        parentId: "",
        notes: "",
      });
      setSelection({ parentId: "", classEnrollIds: [] });
      setBalances([]);
      setDiscountValue(0);
      setAmountWarning(null);
      setSchoolYearId("");
      setTransactionRef(buildTransactionRef());
      setFamilyResetKey((key) => key + 1);

      onPaymentCreated && onPaymentCreated();
    } catch (e: any) {
      toast.error(`❌ Erreur: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  // ================= CURRENT YEAR FILTER SAFE =================
  const normalizedSchoolYearId = useMemo(() => {
    return schoolYearId?.trim() || "";
  }, [schoolYearId]);

  // ================= FILTER FRAIS BY SCHOOL YEAR =================
  const filteredFraisList = useMemo(() => {
    if (!normalizedSchoolYearId) return [];

    return fraisList.filter((f: any) => {
      const fYear = f?.schoolYearId?.trim?.() || "";

      return fYear === normalizedSchoolYearId;
    });
  }, [fraisList, normalizedSchoolYearId]);

  // ================= FILTER + CLASS + MAP OPTIONS =================
  const fraisOptions = useMemo(() => {
    if (!normalizedSchoolYearId) return [];

    return filteredFraisList
      .filter((f: any) => {
        // sécurité classe : on compare aux classeId des inscriptions sélectionnées
        if (!selection.classEnrollIds.length) return true;
        if (!selectedClasseIds.length) return false;

        return selectedClasseIds.includes(f.classeId);
      })
      .map((f: any) => ({
        label: `${f.nameFrais} (${f.montantFrais})`,
        value: f.id,
      }));
  }, [
    filteredFraisList,
    selectedClasseIds,
    selection.classEnrollIds,
    normalizedSchoolYearId,
  ]);
  const isSolde =
    summary.alreadyPaid >= summary.totalDue - summary.discountAmount;
  // ================= UI (INCHANGÉ) =================
  return (
    <>
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col lg:flex-row gap-3"
    >
      {/* LEFT */}
      <div className="hidden lg:flex lg:flex-col w-60 gap-3 border p-4 rounded-md">
        <Select
          value={watch("modePaiement")}
          onValueChange={(v) => setValue("modePaiement", v as ModePaiement)}
        >
          <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
            <SelectValue placeholder="Mode paiement" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(ModePaiement).map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 💰 INPUT MONTANT - LIBRE (auto-cappé au submit) */}
        <Input
          type="number"
          placeholder={
            !hasNoSelection && isSolded ? "✅ Déjà soldé" : "Montant à payer"
          }
          {...register("amount", { valueAsNumber: true })}
          className={
            !hasNoSelection && isSolded
              ? "opacity-50 cursor-not-allowed h-9 text-sm"
              : " h-9 text-sm sm:w-[200px]"
          }
        />

        <Select
          value={watch("status")}
          onValueChange={(v) => setValue("status", v as StatusPaiement)}
        >
          <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(StatusPaiement).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Textarea
          {...register("notes")}
          placeholder="Notes..."
          className="min-h-[45px] sm:w-[200px]"
        />

        {/* 💾 BOUTON SUBMIT */}
        <Button
          type="submit"
          className="mt-3 sm:w-[200px]"
          disabled={loading || (!hasNoSelection && isSolded)}
        >
          {!hasNoSelection && isSolded
            ? "✅ paiement soldé"
            : loading
              ? "Enregistrement..."
              : " Valider le paiement"}
        </Button>

        {/* 💰 REMINDER: Montant max */}
        {!hasNoSelection && !isSolded && (
          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-200">
            💡 Montant max: {summary.remaining}
          </div>
        )}
      </div>

      {/* CENTER */}
      <div className="flex-1 border p-3 rounded-md">
        <FamilySelector
          resetKey={familyResetKey}
          onChange={(data) => {
            setSelection(data);
            setSchoolYearId(data.schoolYearId); // ✅ IMPORTANT
            setValue("parentId", data.parentId);
            setValue("classEnrollIds", data.classEnrollIds);
          }}
        />
      </div>

      {/* RIGHT */}
      <div className="w-full lg:w-96 border p-3 rounded-md">
        <MultiSelect
          options={fraisOptions}
          value={watch("fraisIds") || []}
          onValueChange={(values) =>
            setValue("fraisIds", values, { shouldValidate: true })
          }
          placeholder="Sélectionner les frais"
          searchable
          closeOnSelect={false}
          maxCount={3}
        />

        <Card variant="default" className="mt-3">
          <CardContent>
            {/* HEADER */}
            <p className="font-bold ">📊 Récapitulatif</p>

            {/* MAIN INFO */}
            <p>
              💰 Total dû:{" "}
              <span className="font-semibold">{summary.totalDue}</span>
            </p>
            <p>
              ✅ Déjà payé:{" "}
              <span className="font-semibold">{summary.alreadyPaid}</span>
            </p>
            <p>
              🎁 Remise: {summary.discount}%{" "}
              <span className="font-semibold">(-{summary.discountAmount})</span>
            </p>

            {/* REMAINING */}
            <div className="border-t pt-2 mt-2">
              {/* NET AFTER DISCOUNT */}
              {fraisIds.length > 0 && (
                <p>
                  Net à payer:{" "}
                  <span className="font-bold text-green-700">
                    {summary.totalDueNet}
                  </span>
                </p>
              )}
              <p className="font-bold">
                {!hasNoSelection && isSolded
                  ? "✅ ENTIÈREMENT SOLDÉ"
                  : `Reste à payer: ${summary.remaining}`}
              </p>
            </div>

            {/* REFUND INFO */}
            {amount > summary.remaining && amount > 0 && (
              <div className="border-t pt-2 bg-yellow-50 p-2 rounded">
                <p className="text-yellow-800 text-xs font-bold">
                  💰 Calcul remboursement:
                </p>
                <p className="text-xs">
                  Montant saisi: <span className="font-bold">{amount}</span>
                </p>
                <p className="text-xs">
                  À payer:{" "}
                  <span className="font-bold text-green-700">
                    {summary.remaining}
                  </span>
                </p>
                <p className="text-xs text-yellow-700">
                  Remboursement:{" "}
                  <span className="font-bold">
                    {amount - summary.remaining}
                  </span>
                </p>
              </div>
            )}

            {/* WARNING */}
            {amountWarning && (
              <p className="text-orange-600 text-xs mt-2 bg-orange-50 p-1 rounded">
                ⚠️ {amountWarning}
              </p>
            )}

            {/* SOLDED ALERT */}
            {!hasNoSelection && isSolded && (
              <p className="text-green-600 text-xs mt-2 bg-green-50 p-1 rounded font-bold">
                ✓ Dossier soldé - Aucun paiement possible
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </form>
    <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
      <DialogContent title="Paiement enregistre" className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogDescription>
            Recu {receiptData?.invoiceNumber ?? ""} pret pour impression.
          </DialogDescription>
        </DialogHeader>

        {receiptData && (
          <div className="rounded-md border p-3 text-sm space-y-2">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Paiement cree avec succes
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2">
              <span className="text-muted-foreground">Eleve</span>
              <span>{receiptData.recipient.name}</span>
              <span className="text-muted-foreground">Classe</span>
              <span>{receiptData.recipient.class}</span>
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">
                {receiptData.items
                  .reduce((sum, item) => sum + Number(item.montant), 0)
                  .toFixed(2)}{" "}
                USD
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="min-h-5 text-xs text-green-700">
            {printMessage}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setReceiptDialogOpen(false)}
            >
              Fermer
            </Button>
            <Button type="button" onClick={handlePrintReceipt}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimer le recu
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
