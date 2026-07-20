"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, Receipt, X } from "lucide-react";

import { createPaiementAction, getFraisWithBalance } from "../paiement.action";
import { getFraisAction } from "../../frais/frais.action";
import { getActiveExchangeRatesAction } from "../../settings/exchange-rate.action";
import {
  convertAmount,
  getBaseCurrency,
  getRateUsed,
  listSelectableCurrencies,
  roundCurrency,
  type ExchangeRatePair,
} from "@/lib/exchange-rate";
import { CurrencyCode } from "@/prisma/generated/prisma/enums";

import FamilySelector from "./FamilySelector";
import z from "zod";
import { MultiSelect } from "./MultiSelect";
import type { FacturePaymentStudentData } from "@/components/FacturePaymentStudent";
import { ReceiptPreviewDialog } from "@/components/reports/ReceiptPreviewDialog";

type FormData = z.infer<typeof paiementSchema>;

interface Props {
  fraisList: any;
  classEnrollList: any;
  onCreated?: () => void;
  onSuccess?: () => void;
}

function buildTransactionRef() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const day = now.getDate().toString().padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `TRNS-${year}-${day}-${rand}`;
}

const emptyAmount = undefined as unknown as number;

function formatAmount(value: number) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function parseAmountInput(value: string): number | null {
  if (value.trim() === "" || value === ".") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export default function PaymentsForm({
  fraisList,
  classEnrollList,
  onCreated,
  onSuccess,
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
  const [availableFrais, setAvailableFrais] = useState<any[]>(fraisList);
  const [familyResetKey, setFamilyResetKey] = useState(0);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptData, setReceiptData] =
    useState<FacturePaymentStudentData | null>(null);
  const [amountManuallyEdited, setAmountManuallyEdited] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const amountManuallyEditedRef = useRef(false);
  const lastAutoFillKeyRef = useRef("");
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRatePair[]>([]);
  const [receivedCurrency, setReceivedCurrency] = useState<CurrencyCode>(
    CurrencyCode.USD,
  );

  const baseCurrency = useMemo(
    () => getBaseCurrency(exchangeRates),
    [exchangeRates],
  );

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLargeScreen(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [data, err] = await getActiveExchangeRatesAction();
      if (cancelled || err || !data) return;
      setExchangeRates(data);
      const base = getBaseCurrency(data);
      setReceivedCurrency((current) => {
        const selectable = listSelectableCurrencies(data, base);
        return selectable.includes(current) ? current : base;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectableCurrencies = useMemo(
    () => listSelectableCurrencies(exchangeRates, baseCurrency),
    [exchangeRates, baseCurrency],
  );

  useEffect(() => {
    if (!selectableCurrencies.includes(receivedCurrency)) {
      setReceivedCurrency(baseCurrency);
    }
  }, [selectableCurrencies, receivedCurrency, baseCurrency]);

  const toBase = useCallback(
    (value: number, from: CurrencyCode) => {
      if (from === baseCurrency) return roundCurrency(value, baseCurrency);
      return convertAmount(value, from, baseCurrency, exchangeRates, baseCurrency);
    },
    [exchangeRates, baseCurrency],
  );

  const fromBase = useCallback(
    (baseAmount: number, to: CurrencyCode) => {
      if (to === baseCurrency) return roundCurrency(baseAmount, baseCurrency);
      return convertAmount(
        baseAmount,
        baseCurrency,
        to,
        exchangeRates,
        baseCurrency,
      );
    },
    [exchangeRates, baseCurrency],
  );
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

  useEffect(() => {
    setAvailableFrais(fraisList);
  }, [fraisList]);

  useEffect(() => {
    const initialYearId =
      fraisList.find((frais: any) => frais?.schoolYearId)?.schoolYearId ?? "";

    if (initialYearId) {
      setSchoolYearId((current) => current || initialYearId);
    }
  }, [fraisList]);

  useEffect(() => {
    if (!schoolYearId) return;

    let ignore = false;

    const loadFrais = async () => {
      const [data, err] = await getFraisAction({ schoolYearId });
      if (ignore || err || !data) return;
      setAvailableFrais(data);
    };

    void loadFrais();

    return () => {
      ignore = true;
    };
  }, [schoolYearId]);

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
  }, [selection.classEnrollIds, fraisIds, selection.parentId]);
  // 🔥 AUTO HIDE WARNING (30s)
  useEffect(() => {
    if (!amountWarning) return;

    const timer = setTimeout(() => {
      setAmountWarning(null);
    }, 10000); // 30 secondes

    return () => clearTimeout(timer);
  }, [amountWarning]);

  // ================= SUMMARY (aligné sur le moteur backend) =================
  const summary = useMemo(() => {
    const totalDue = balances.reduce(
      (sum, b) => sum + Number(b.total ?? 0),
      0,
    );
    const alreadyPaid = balances.reduce(
      (sum, b) => sum + Number(b.alreadyPaid ?? 0),
      0,
    );
    const remainingBeforeDiscount = balances.reduce(
      (sum, b) =>
        sum + Math.max(Number(b.total ?? 0) - Number(b.alreadyPaid ?? 0), 0),
      0,
    );

    const discountAmount = (remainingBeforeDiscount * discountValue) / 100;
    const remaining = Math.max(remainingBeforeDiscount - discountAmount, 0);

    return {
      totalDue,
      alreadyPaid,
      discount: discountValue,
      discountAmount,
      remaining,
      studentCount: selection.classEnrollIds.length,
      fraisCount: fraisIds.length,
    };
  }, [balances, discountValue, selection.classEnrollIds.length, fraisIds.length]);

  const selectedFraisDetails = useMemo(() => {
    const studentCount = selection.classEnrollIds.length || 1;

    return fraisIds.map((fraisId) => {
      const frais = availableFrais.find((f: any) => f.id === fraisId);
      const fraisBalances = balances.filter((b: any) => b.fraisId === fraisId);

      if (fraisBalances.length > 0) {
        const total = fraisBalances.reduce(
          (sum, b) => sum + Number(b.total ?? 0),
          0,
        );
        const alreadyPaid = fraisBalances.reduce(
          (sum, b) => sum + Number(b.alreadyPaid ?? 0),
          0,
        );
        const remaining = fraisBalances.reduce(
          (sum, b) =>
            sum + Math.max(Number(b.total ?? 0) - Number(b.alreadyPaid ?? 0), 0),
          0,
        );

        return {
          id: fraisId,
          name: frais?.nameFrais ?? "Frais",
          unitAmount: Number(frais?.montantFrais ?? fraisBalances[0]?.total ?? 0),
          total,
          alreadyPaid,
          remaining,
          studentCount: fraisBalances.length,
        };
      }

      const unitAmount = Number(frais?.montantFrais ?? 0);
      const total = unitAmount * studentCount;

      return {
        id: fraisId,
        name: frais?.nameFrais ?? "Frais",
        unitAmount,
        total,
        alreadyPaid: 0,
        remaining: total,
        studentCount,
      };
    });
  }, [fraisIds, balances, availableFrais, selection.classEnrollIds.length]);

  // ================= 🏦 BANK SYSTEM: LOCKED STATES =================
  const isSolded = summary.remaining <= 0;
  const hasNoSelection = !selection.classEnrollIds.length || !fraisIds.length;

  const selectionKey = useMemo(
    () =>
      `${selection.classEnrollIds.join(",")}|${fraisIds.join(",")}|${selection.parentId}`,
    [selection.classEnrollIds, fraisIds, selection.parentId],
  );

  useEffect(() => {
    if (hasNoSelection) {
      setValue("amount", emptyAmount);
      setAmountInput("");
      amountManuallyEditedRef.current = false;
      setAmountManuallyEdited(false);
      lastAutoFillKeyRef.current = "";
      return;
    }

    if (isSolded) {
      setValue("amount", 0);
      setAmountInput("0");
      return;
    }

    // Ne jamais écraser une saisie manuelle en cours
    if (amountManuallyEditedRef.current) return;

    // Auto-remplir une seule fois par sélection, une fois les soldes chargés
    if (lastAutoFillKeyRef.current === selectionKey) return;
    if (balances.length === 0) return;

    const remainingBase = summary.remaining;
    let displayAmount = remainingBase;
    try {
      displayAmount = fromBase(remainingBase, receivedCurrency);
    } catch {
      displayAmount = remainingBase;
    }
    setValue("amount", remainingBase, { shouldValidate: true });
    setAmountInput(remainingBase > 0 ? String(displayAmount) : "");
    lastAutoFillKeyRef.current = selectionKey;
  }, [
    hasNoSelection,
    isSolded,
    selectionKey,
    balances.length,
    summary.remaining,
    setValue,
    fromBase,
    receivedCurrency,
  ]);

  const handleAmountChange = (value: string) => {
    // Ref synchrone pour bloquer l'auto-remplissage avant le prochain render
    amountManuallyEditedRef.current = true;
    setAmountManuallyEdited(true);
    setAmountInput(value);

    const parsed = parseAmountInput(value);
    if (parsed == null) {
      setValue("amount", emptyAmount);
      return;
    }

    try {
      const baseAmount = toBase(parsed, receivedCurrency);
      setValue("amount", baseAmount, { shouldValidate: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Conversion impossible.",
      );
    }
  };

  const handleCurrencyChange = (next: CurrencyCode) => {
    if (next === receivedCurrency) return;

    const parsed = parseAmountInput(amountInput);
    setReceivedCurrency(next);

    if (parsed == null) {
      const currentBase = Number.isFinite(Number(rawAmount))
        ? Number(rawAmount)
        : null;
      if (currentBase != null && currentBase > 0) {
        try {
          setAmountInput(String(fromBase(currentBase, next)));
        } catch {
          /* ignore until rates ready */
        }
      }
      return;
    }

    try {
      const baseAmount = toBase(parsed, receivedCurrency);
      setValue("amount", baseAmount, { shouldValidate: true });
      setAmountInput(String(fromBase(baseAmount, next)));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Conversion impossible.",
      );
    }
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

      // 🏦 BANK CHECK 3: Valid amount? (devise de base)
      const inputAmountBase = Number.isFinite(Number(data.amount))
        ? Number(data.amount)
        : 0;
      if (!inputAmountBase || inputAmountBase <= 0) {
        toast.error("❌ Impossible: Montant doit être > 0");
        return;
      }

      setLoading(true);

      // 🏦 BANK CHECK 4: Amount cap + Refund calculation (devise de base)
      const finalAmountBase = Math.min(inputAmountBase, summary.remaining);
      const refundAmountBase = Math.max(inputAmountBase - summary.remaining, 0);

      let receivedAmount = finalAmountBase;
      let exchangeRateUsed: number | undefined = 1;
      try {
        if (receivedCurrency !== baseCurrency) {
          receivedAmount = fromBase(finalAmountBase, receivedCurrency);
          exchangeRateUsed =
            getRateUsed(receivedCurrency, baseCurrency, exchangeRates) ??
            undefined;
          if (exchangeRateUsed == null) {
            toast.error(
              `Taux de change inactif pour ${receivedCurrency} → ${baseCurrency}.`,
            );
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Conversion impossible.",
        );
        setLoading(false);
        return;
      }

      // 💰 Show refund warning if applicable
      if (refundAmountBase > 0) {
        setAmountWarning(
          `💰 Montant saisi: ${formatAmount(inputAmountBase)} ${baseCurrency} | À payer: ${formatAmount(finalAmountBase)} ${baseCurrency} | Remboursement: ${formatAmount(refundAmountBase)} ${baseCurrency}`,
        );
      }

      const [res, err] = await createPaiementAction({
        ...data,
        parentId: selection.parentId,
        classEnrollIds: selection.classEnrollIds,
        transactionRef,
        amount: finalAmountBase,
        receivedCurrency,
        receivedAmount,
        exchangeRateUsed,
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
        refundAmountBase > 0
          ? `✅ Paiement: ${formatAmount(finalAmountBase)} ${baseCurrency} | Remboursement: ${formatAmount(refundAmountBase)} ${baseCurrency}`
          : `✅ ${res?.message || "Paiement enregistré avec succès"}`;

      toast.success(successMsg);
      if (res.receipt) {
        setReceiptData(res.receipt);
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
        receivedCurrency: baseCurrency,
        receivedAmount: undefined,
        exchangeRateUsed: undefined,
      });
      setReceivedCurrency(baseCurrency);
      setSelection({ parentId: "", classEnrollIds: [] });
      setBalances([]);
      setDiscountValue(0);
      setAmountWarning(null);
      setAmountManuallyEdited(false);
      amountManuallyEditedRef.current = false;
      setAmountInput("");
      lastAutoFillKeyRef.current = "";
      setSchoolYearId("");
      setTransactionRef(buildTransactionRef());
      setFamilyResetKey((key) => key + 1);

      onCreated?.();
      onSuccess?.();
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
    if (!normalizedSchoolYearId) return availableFrais;

    return availableFrais.filter((f: any) => {
      const fYear = f?.schoolYearId?.trim?.() || "";

      return fYear === normalizedSchoolYearId;
    });
  }, [availableFrais, normalizedSchoolYearId]);

  // ================= FILTER + CLASS + MAP OPTIONS =================
  const fraisOptions = useMemo(() => {
    const source = normalizedSchoolYearId ? filteredFraisList : availableFrais;
    if (!source.length) return [];

    return source
      .filter((f: any) => {
        // sécurité classe : on compare aux classeId des inscriptions sélectionnées
        if (!selection.classEnrollIds.length) return true;
        if (!selectedClasseIds.length) return false;

        return selectedClasseIds.includes(f.classeId);
      })
      .map((f: any) => ({
        label: `${f.nameFrais} (${formatAmount(Number(f.montantFrais))} ${baseCurrency})`,
        value: f.id,
      }));
  }, [
    availableFrais,
    filteredFraisList,
    selectedClasseIds,
    selection.classEnrollIds,
    normalizedSchoolYearId,
    baseCurrency,
  ]);

  const handleFraisChange = (values: string[]) => {
    amountManuallyEditedRef.current = false;
    setAmountManuallyEdited(false);
    lastAutoFillKeyRef.current = "";
    setValue("fraisIds", values, { shouldValidate: true });
  };

  const removeFrais = (fraisId: string) => {
    amountManuallyEditedRef.current = false;
    setAmountManuallyEdited(false);
    lastAutoFillKeyRef.current = "";
    setValue(
      "fraisIds",
      fraisIds.filter((id) => id !== fraisId),
      { shouldValidate: true },
    );
  };

  const amountInputProps = {
    type: "text" as const,
    inputMode: "decimal" as const,
    placeholder:
      !hasNoSelection && isSolded
        ? "Déjà soldé"
        : `Montant payé (${receivedCurrency})`,
    value: amountInput,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      handleAmountChange(e.target.value),
    disabled: !hasNoSelection && isSolded,
    className: cn(
      "h-9 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
      !hasNoSelection && isSolded && "opacity-50 cursor-not-allowed",
    ),
  };

  const baseHint =
    receivedCurrency !== baseCurrency && amount > 0
      ? `≈ ${formatAmount(amount)} ${baseCurrency}`
      : null;

  const currencyToggle = (
    <div className="flex flex-wrap gap-1">
      {selectableCurrencies.map((currency) => (
        <Button
          key={currency}
          type="button"
          size="sm"
          variant={receivedCurrency === currency ? "default" : "outline"}
          className="h-8 px-2.5 text-xs"
          disabled={!hasNoSelection && isSolded}
          onClick={() => handleCurrencyChange(currency)}
        >
          {currency}
        </Button>
      ))}
    </div>
  );
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

        {/* Montant payé — panneau gauche (desktop) */}
        {isLargeScreen && (
          <>
            {currencyToggle}
            <Input
              {...amountInputProps}
              className={cn(amountInputProps.className, "sm:w-[200px]")}
            />
            {!hasNoSelection && !isSolded && (
              <p className="text-[11px] text-muted-foreground -mt-1">
                {baseHint
                  ? baseHint
                  : amountManuallyEdited
                    ? "Montant modifié manuellement"
                    : "Calculé automatiquement"}
              </p>
            )}
          </>
        )}

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
            ? "Paiement soldé"
            : loading
              ? "Enregistrement..."
              : "Valider le paiement"}
        </Button>
      </div>

      {/* CENTER */}
      <div className="flex-1 border p-3 rounded-md">
        <FamilySelector
          resetKey={familyResetKey}
          onChange={(data) => {
            amountManuallyEditedRef.current = false;
            setAmountManuallyEdited(false);
            lastAutoFillKeyRef.current = "";
            setSelection(data);
            setSchoolYearId(data.schoolYearId);
            setValue("parentId", data.parentId);
            setValue("classEnrollIds", data.classEnrollIds);
          }}
        />
      </div>

      {/* RIGHT */}
      <div className="w-full lg:w-96 border p-3 rounded-md space-y-3">
        <MultiSelect
          options={fraisOptions}
          value={watch("fraisIds") || []}
          onValueChange={handleFraisChange}
          placeholder="Sélectionner les frais"
          searchable
          closeOnSelect={false}
          hideSelected
        />

        {selectedFraisDetails.length > 0 && (
          <div className="rounded-md border bg-muted/30">
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">
                Frais sélectionnés ({selectedFraisDetails.length})
              </p>
            </div>
            <ul className="divide-y max-h-48 overflow-y-auto">
              {selectedFraisDetails.map((frais) => (
                <li
                  key={frais.id}
                  className="flex items-start justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{frais.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatAmount(frais.unitAmount)}
                      {frais.studentCount > 1 &&
                        ` × ${frais.studentCount} élèves`}
                    </p>
                    {frais.alreadyPaid > 0 && (
                      <p className="text-xs text-green-700">
                        Déjà payé : {formatAmount(frais.alreadyPaid)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground uppercase">
                      Reste
                    </span>
                    <span className="font-semibold text-primary">
                      {formatAmount(frais.remaining)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFrais(frais.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label={`Retirer ${frais.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Card variant="default">
          <CardContent className="space-y-3 pt-4">
            <p className="font-bold">Récapitulatif</p>

            {hasNoSelection ? (
              <p className="text-sm text-muted-foreground">
                Sélectionnez un élève et au moins un frais pour voir le
                récapitulatif.
              </p>
            ) : balances.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Calcul des soldes en cours…
              </p>
            ) : (
              <>
                {summary.studentCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {summary.studentCount} élève
                    {summary.studentCount > 1 ? "s" : ""} ·{" "}
                    {summary.fraisCount} frais
                  </p>
                )}

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <span className="text-muted-foreground">Total frais</span>
                  <span className="text-right font-medium">
                    {formatAmount(summary.totalDue)}
                  </span>

                  {summary.alreadyPaid > 0 && (
                    <>
                      <span className="text-muted-foreground">Déjà payé</span>
                      <span className="text-right font-medium text-green-700">
                        -{formatAmount(summary.alreadyPaid)}
                      </span>
                    </>
                  )}

                  {summary.discount > 0 && (
                    <>
                      <span className="text-muted-foreground">
                        Remise ({summary.discount}%)
                      </span>
                      <span className="text-right font-medium text-orange-600">
                        -{formatAmount(summary.discountAmount)}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex justify-between items-center border-t pt-2">
                  <span className="font-bold">
                    {isSolded ? "Entièrement soldé" : "Reste à payer"}
                  </span>
                  <span
                    className={cn(
                      "text-lg font-bold",
                      isSolded ? "text-green-600" : "text-primary",
                    )}
                  >
                    {formatAmount(summary.remaining)}
                  </span>
                </div>

                {!isSolded && amount > 0 && (
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground">Montant saisi</span>
                    <span className="font-semibold">
                      {formatAmount(amount)}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Montant payé — mobile/tablette */}
            {!isLargeScreen && !hasNoSelection && !isSolded && (
              <div className="border-t pt-3 space-y-2">
                <label className="text-sm font-medium">Montant payé</label>
                {currencyToggle}
                <Input {...amountInputProps} />
                <p className="text-[11px] text-muted-foreground">
                  {baseHint
                    ? baseHint
                    : amountManuallyEdited
                      ? "Montant modifié manuellement"
                      : "Calculé automatiquement"}
                </p>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || (!hasNoSelection && isSolded)}
                >
                  {!hasNoSelection && isSolded
                    ? "Paiement soldé"
                    : loading
                      ? "Enregistrement..."
                      : "Valider le paiement"}
                </Button>
              </div>
            )}

            {/* Remboursement si montant saisi > reste */}
            {!isSolded &&
              amount > summary.remaining &&
              amount > 0 &&
              balances.length > 0 && (
              <div className="border-t pt-2 bg-yellow-50 p-2 rounded space-y-1">
                <p className="text-yellow-800 text-xs font-bold">
                  Excédent — remboursement à prévoir
                </p>
                <div className="flex justify-between text-xs">
                  <span className="text-yellow-700">Remboursement</span>
                  <span className="font-bold text-yellow-700">
                    {formatAmount(amount - summary.remaining)}
                  </span>
                </div>
              </div>
            )}

            {amountWarning && (
              <p className="text-orange-600 text-xs bg-orange-50 p-2 rounded">
                {amountWarning}
              </p>
            )}

            {!hasNoSelection && isSolded && balances.length > 0 && (
              <p className="text-green-600 text-xs bg-green-50 p-2 rounded font-medium">
                Dossier soldé — aucun paiement possible
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </form>
    <ReceiptPreviewDialog
      open={receiptDialogOpen}
      onOpenChange={setReceiptDialogOpen}
      data={receiptData}
      title="Paiement enregistré"
      description={
        receiptData
          ? `Reçu ${receiptData.invoiceNumber} prêt pour impression.`
          : undefined
      }
      banner={
        <div className="flex items-center gap-2 font-medium text-green-700">
          <CheckCircle2 className="size-4" />
          Paiement créé avec succès
        </div>
      }
    />
    </>
  );
}
