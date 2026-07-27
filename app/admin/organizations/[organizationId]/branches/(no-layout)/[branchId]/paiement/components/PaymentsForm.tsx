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
import { MontantInput } from "@/components/ui/montant-input";
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

import {
  createPaiementAction,
  getFraisWithBalance,
  getSelectableFraisForEnrollments,
  type SelectableFraisAggregate,
} from "../paiement.action";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import { pluralizeStudentLabelLower } from "@/lib/people-labels";
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
import { computeScopedDiscountAmount } from "@/lib/payment-discount";
import { CurrencyCode } from "@/prisma/generated/prisma/enums";

import FamilySelector from "./FamilySelector";
import z from "zod";
import { MultiSelect } from "./MultiSelect";
import type { FacturePaymentStudentData } from "@/components/FacturePaymentStudent";
import { ReceiptPreviewDialog } from "@/components/reports/ReceiptPreviewDialog";
import type { ISchoolYear } from "@/src/interfaces/SchoolYear";

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

export default function PaymentsForm({
  fraisList,
  classEnrollList: _classEnrollList,
  onCreated,
  onSuccess,
}: Props) {
  const peopleLabels = useBranchPeopleLabels();
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
  const [discountTypeFraisId, setDiscountTypeFraisId] = useState<string | null>(
    null,
  );
  const [discountTypeFraisName, setDiscountTypeFraisName] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [transactionRef, setTransactionRef] = useState(buildTransactionRef);
  const [schoolYearId, setSchoolYearId] = useState<string>("");
  const [schoolYears, setSchoolYears] = useState<ISchoolYear[]>([]);
  const [availableFrais, setAvailableFrais] = useState<any[]>(fraisList);
  /** Frais non soldés proposés pour la sélection courante (tri priorité). */
  const [selectableFrais, setSelectableFrais] = useState<
    SelectableFraisAggregate[]
  >([]);
  const [loadingSelectableFrais, setLoadingSelectableFrais] = useState(false);
  const [familyResetKey, setFamilyResetKey] = useState(0);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptData, setReceiptData] =
    useState<FacturePaymentStudentData | null>(null);
  const [amountManuallyEdited, setAmountManuallyEdited] = useState(false);
  /** Montant affiché dans la devise sélectionnée (saisie style frais). */
  const [displayAmount, setDisplayAmount] = useState<number | undefined>();
  const amountManuallyEditedRef = useRef(false);
  const lastAutoFillKeyRef = useRef("");
  /** Frais désélectionnés manuellement dans la session courante. */
  const userDeselectedFraisIdsRef = useRef<Set<string>>(new Set());
  const selectionParentIdRef = useRef("");
  const lastSelectableKeyRef = useRef("");
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
      // Toujours la devise de base du taux sélectionné (ex. AOA→USD → AOA).
      setReceivedCurrency(getBaseCurrency(data));
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

  // ================= TRANSACTION REF =================
  useEffect(() => {
    setTransactionRef(buildTransactionRef());
  }, []);

  useEffect(() => {
    setAvailableFrais(fraisList);
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

  // ================= SELECTABLE FRAIS (non soldés) =================
  const applySelectableResult = useCallback(
    (
      data: Awaited<ReturnType<typeof getSelectableFraisForEnrollments>>,
      options?: { autoSelect?: boolean },
    ) => {
      const autoSelect = options?.autoSelect ?? true;
      setSelectableFrais(data.frais);
      setDiscountValue(data.discount);
      setDiscountTypeFraisId(data.discountTypeFraisId ?? null);
      setDiscountTypeFraisName(data.discountTypeFraisName ?? null);

      const eligibleIds = data.frais.map((f) => f.id);
      const eligibleSet = new Set(eligibleIds);

      // Nettoyer les désélections qui ne sont plus éligibles
      for (const id of Array.from(userDeselectedFraisIdsRef.current)) {
        if (!eligibleSet.has(id)) {
          userDeselectedFraisIdsRef.current.delete(id);
        }
      }

      if (!autoSelect) {
        // Garder uniquement les frais encore éligibles
        const current = watch("fraisIds") || [];
        const pruned = current.filter((id) => eligibleSet.has(id));
        if (pruned.length !== current.length) {
          setValue("fraisIds", pruned, { shouldValidate: true });
        }
        return;
      }

      const nextIds = eligibleIds.filter(
        (id) => !userDeselectedFraisIdsRef.current.has(id),
      );
      setValue("fraisIds", nextIds, { shouldValidate: true });
    },
    [setValue, watch],
  );

  const reloadSelectableFrais = useCallback(
    async (
      classEnrollIds: string[],
      parentId: string,
      yearId: string,
      options?: { autoSelect?: boolean; force?: boolean },
    ) => {
      const key = `${classEnrollIds.join(",")}|${parentId}|${yearId?.trim() || ""}`;
      if (
        !options?.force &&
        key === lastSelectableKeyRef.current &&
        classEnrollIds.length > 0
      ) {
        return;
      }

      if (!classEnrollIds.length) {
        lastSelectableKeyRef.current = "";
        setSelectableFrais([]);
        setBalances([]);
        setDiscountValue(0);
        setDiscountTypeFraisId(null);
        setDiscountTypeFraisName(null);
        setValue("fraisIds", [], { shouldValidate: true });
        userDeselectedFraisIdsRef.current.clear();
        return;
      }

      lastSelectableKeyRef.current = key;
      setLoadingSelectableFrais(true);
      try {
        const data = await getSelectableFraisForEnrollments({
          classEnrollIds,
          parentId: parentId || undefined,
          schoolYearId: yearId || undefined,
        });
        applySelectableResult(data, options);
      } catch (error) {
        console.error(error);
        lastSelectableKeyRef.current = "";
        toast.error("Impossible de charger les frais disponibles.");
        setSelectableFrais([]);
      } finally {
        setLoadingSelectableFrais(false);
      }
    },
    [applySelectableResult, setValue],
  );

  // Recharger les frais éligibles si l'année change alors que des élèves sont sélectionnés
  useEffect(() => {
    if (!selection.classEnrollIds.length) return;
    void reloadSelectableFrais(
      selection.classEnrollIds,
      selection.parentId,
      schoolYearId,
      { autoSelect: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volontairement lié à schoolYearId
  }, [schoolYearId]);

  // ================= BALANCES =================
  useEffect(() => {
    const fetch = async () => {
      if (!selection.classEnrollIds.length || !fraisIds.length) {
        setBalances([]);
        return;
      }

      const data = await getFraisWithBalance(
        selection.classEnrollIds,
        fraisIds,
        selection.parentId,
      );

      // Épargner les soldés : ne garder que les lignes encore dues pour le récap
      const activeItems = data.items.filter(
        (item) => Math.max(Number(item.total) - Number(item.alreadyPaid), 0) > 0,
      );
      setBalances(activeItems);
      setDiscountValue(data.discount);
      setDiscountTypeFraisId(data.discountTypeFraisId ?? null);
      setDiscountTypeFraisName(data.discountTypeFraisName ?? null);
    };

    void fetch();
  }, [selection.classEnrollIds, fraisIds, selection.parentId]);

  // Prune fraisIds qui ne sont plus dans selectable (soldés)
  useEffect(() => {
    if (loadingSelectableFrais) return;
    if (!selection.classEnrollIds.length) return;

    const eligibleSet = new Set(selectableFrais.map((f) => f.id));
    const current = fraisIds;
    const pruned = current.filter((id) => eligibleSet.has(id));
    if (pruned.length !== current.length) {
      setValue("fraisIds", pruned, { shouldValidate: true });
    }
  }, [
    selectableFrais,
    fraisIds,
    selection.classEnrollIds.length,
    loadingSelectableFrais,
    setValue,
  ]);

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
    // Lignes actives uniquement (élèves soldés déjà exclus)
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

    const discountInfo = {
      percentage: discountValue,
      typeFraisId: discountTypeFraisId,
      typeFraisName: discountTypeFraisName,
    };
    const discountAmount = computeScopedDiscountAmount(
      balances.map((b) => ({
        base: Math.max(Number(b.total ?? 0), 0),
        typeFraisId: b.typeFraisId ?? null,
      })),
      discountInfo,
    );
    const remaining = Math.max(remainingBeforeDiscount - discountAmount, 0);
    const hasEligibleFraisSelected =
      !discountTypeFraisId ||
      balances.some((b) => b.typeFraisId === discountTypeFraisId);

    return {
      totalDue,
      alreadyPaid,
      remaining,
      discount: discountValue,
      discountAmount,
      discountTypeFraisId,
      discountTypeFraisName,
      hasEligibleFraisSelected,
      studentCount: selection.classEnrollIds.length,
      fraisCount: fraisIds.length,
    };
  }, [
    balances,
    discountValue,
    discountTypeFraisId,
    discountTypeFraisName,
    selection.classEnrollIds.length,
    fraisIds.length,
  ]);

  const selectedFraisDetails = useMemo(() => {
    return fraisIds.map((fraisId) => {
      const selectable = selectableFrais.find((f) => f.id === fraisId);
      const frais = availableFrais.find((f: any) => f.id === fraisId);
      const fraisBalances = balances.filter((b: any) => b.fraisId === fraisId);
      // Élèves encore dus uniquement
      const activeBalances = fraisBalances.filter(
        (b) => Math.max(Number(b.total ?? 0) - Number(b.alreadyPaid ?? 0), 0) > 0,
      );

      if (activeBalances.length > 0 || selectable) {
        const total =
          selectable?.totalDue ??
          activeBalances.reduce((sum, b) => sum + Number(b.total ?? 0), 0);
        const alreadyPaid =
          selectable?.alreadyPaid ??
          fraisBalances.reduce(
            (sum, b) => sum + Number(b.alreadyPaid ?? 0),
            0,
          );
        const remainingBrut = activeBalances.reduce(
          (sum, b) =>
            sum + Math.max(Number(b.total ?? 0) - Number(b.alreadyPaid ?? 0), 0),
          0,
        );
        const typeFraisId =
          selectable?.typeFraisId ??
          activeBalances[0]?.typeFraisId ??
          frais?.typeFraisId ??
          null;
        const feeDiscount = computeScopedDiscountAmount(
          activeBalances.map((b) => ({
            base: Math.max(Number(b.total ?? 0), 0),
            typeFraisId: b.typeFraisId ?? null,
          })),
          {
            percentage: discountValue,
            typeFraisId: discountTypeFraisId,
            typeFraisName: discountTypeFraisName,
          },
        );
        const remaining =
          selectable?.resteAffiche ??
          Math.max(remainingBrut - feeDiscount, 0);
        const dueEnrollmentCount =
          selectable?.dueEnrollmentCount ?? activeBalances.length;
        const selectedEnrollmentCount =
          selectable?.selectedEnrollmentCount ??
          selection.classEnrollIds.length;

        return {
          id: fraisId,
          name: selectable?.nameFrais ?? frais?.nameFrais ?? "Frais",
          unitAmount: Number(
            selectable?.montantFrais ??
              frais?.montantFrais ??
              activeBalances[0]?.total ??
              0,
          ),
          total,
          alreadyPaid,
          remaining,
          studentCount: dueEnrollmentCount,
          dueEnrollmentCount,
          selectedEnrollmentCount,
          typeFraisId,
          typeFraisName:
            selectable?.typeFraisName ??
            activeBalances[0]?.typeFraisName ??
            frais?.typeFrais?.nameType ??
            null,
          hasDiscount:
            discountValue > 0 &&
            (!discountTypeFraisId || typeFraisId === discountTypeFraisId),
        };
      }

      const unitAmount = Number(frais?.montantFrais ?? 0);

      return {
        id: fraisId,
        name: frais?.nameFrais ?? "Frais",
        unitAmount,
        total: unitAmount,
        alreadyPaid: 0,
        remaining: unitAmount,
        studentCount: 0,
        dueEnrollmentCount: 0,
        selectedEnrollmentCount: selection.classEnrollIds.length,
        typeFraisId: frais?.typeFraisId ?? null,
        typeFraisName: frais?.typeFrais?.nameType ?? null,
        hasDiscount:
          discountValue > 0 &&
          (!discountTypeFraisId ||
            frais?.typeFraisId === discountTypeFraisId),
      };
    });
  }, [
    fraisIds,
    balances,
    availableFrais,
    selectableFrais,
    selection.classEnrollIds.length,
    discountValue,
    discountTypeFraisId,
    discountTypeFraisName,
  ]);

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
      setDisplayAmount(undefined);
      amountManuallyEditedRef.current = false;
      setAmountManuallyEdited(false);
      lastAutoFillKeyRef.current = "";
      return;
    }

    if (isSolded) {
      setValue("amount", 0);
      setDisplayAmount(0);
      return;
    }

    // Nouvelle sélection : ne jamais préremplir — laisser vide jusqu'à saisie manuelle
    if (lastAutoFillKeyRef.current === selectionKey) return;
    lastAutoFillKeyRef.current = selectionKey;
    amountManuallyEditedRef.current = false;
    setAmountManuallyEdited(false);
    setValue("amount", emptyAmount);
    setDisplayAmount(undefined);
  }, [
    hasNoSelection,
    isSolded,
    selectionKey,
    setValue,
  ]);

  const handleAmountChange = (value: number | undefined) => {
    // Ref synchrone pour bloquer l'auto-remplissage avant le prochain render
    amountManuallyEditedRef.current = true;
    setAmountManuallyEdited(true);
    setDisplayAmount(value);

    if (value == null) {
      setValue("amount", emptyAmount);
      return;
    }

    try {
      const baseAmount = toBase(value, receivedCurrency);
      setValue("amount", baseAmount, { shouldValidate: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Conversion impossible.",
      );
    }
  };

  const handleCurrencyChange = (next: CurrencyCode) => {
    if (next === receivedCurrency) return;

    setReceivedCurrency(next);

    const currentBase = Number.isFinite(Number(rawAmount))
      ? Number(rawAmount)
      : null;

    if (currentBase != null && currentBase > 0) {
      try {
        setDisplayAmount(fromBase(currentBase, next));
      } catch {
        /* ignore until rates ready */
      }
      return;
    }

    if (displayAmount == null) return;

    try {
      const baseAmount = toBase(displayAmount, receivedCurrency);
      setValue("amount", baseAmount, { shouldValidate: true });
      setDisplayAmount(fromBase(baseAmount, next));
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
          `❌ Impossible: Sélectionnez ${peopleLabels.studentIndefinite} et au moins un frais.`,
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
      setDiscountTypeFraisId(null);
      setDiscountTypeFraisName(null);
      setAmountWarning(null);
      setAmountManuallyEdited(false);
      amountManuallyEditedRef.current = false;
      setDisplayAmount(undefined);
      lastAutoFillKeyRef.current = "";
      userDeselectedFraisIdsRef.current.clear();
      selectionParentIdRef.current = "";
      lastSelectableKeyRef.current = "";
      setSelectableFrais([]);
      // Conserver l'année scolaire (réémise par FamilySelector au reset)
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
  // (année gérée via schoolYearId + getSelectableFraisForEnrollments)

  // ================= FILTER FRAIS OPTIONS (non soldés uniquement) =================
  const fraisOptions = useMemo(() => {
    if (!selection.classEnrollIds.length) return [];

    return selectableFrais.map((f) => ({
      label: `${f.nameFrais} (${formatAmount(Number(f.montantFrais))} ${baseCurrency})`,
      value: f.id,
    }));
  }, [selectableFrais, selection.classEnrollIds.length, baseCurrency]);

  const handleFraisChange = (values: string[]) => {
    amountManuallyEditedRef.current = false;
    setAmountManuallyEdited(false);
    lastAutoFillKeyRef.current = "";

    const previous = new Set(fraisIds);
    const next = new Set(values);

    // Tracker les désélections / resélections manuelles
    for (const id of previous) {
      if (!next.has(id)) {
        userDeselectedFraisIdsRef.current.add(id);
      }
    }
    for (const id of next) {
      if (!previous.has(id)) {
        userDeselectedFraisIdsRef.current.delete(id);
      }
    }

    setValue("fraisIds", values, { shouldValidate: true });
  };

  const removeFrais = (fraisId: string) => {
    amountManuallyEditedRef.current = false;
    setAmountManuallyEdited(false);
    lastAutoFillKeyRef.current = "";
    userDeselectedFraisIdsRef.current.add(fraisId);
    setValue(
      "fraisIds",
      fraisIds.filter((id) => id !== fraisId),
      { shouldValidate: true },
    );
  };

  const amountInputProps = {
    value: displayAmount,
    onChange: handleAmountChange,
    placeholder:
      !hasNoSelection && isSolded
        ? "Déjà soldé"
        : `Montant payé (${receivedCurrency})`,
    disabled: !hasNoSelection && isSolded,
    className: cn(
      "h-9 text-sm",
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
          value={schoolYearId || undefined}
          onValueChange={setSchoolYearId}
        >
          <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
            <SelectValue placeholder="Année scolaire" />
          </SelectTrigger>
          <SelectContent>
            {schoolYears.map((year) => (
              <SelectItem key={year.id} value={year.id}>
                {year.nameYear}
                {year.isCurrentYear ? " (en cours)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
            <MontantInput
              {...amountInputProps}
              className={cn(amountInputProps.className, "sm:w-[200px]")}
            />
            {!hasNoSelection && !isSolded && (
              <p className="text-[11px] text-muted-foreground -mt-1">
                {baseHint
                  ? baseHint
                  : amountManuallyEdited
                    ? "Montant modifié manuellement"
                    : "Saisissez le montant payé"}
              </p>
            )}
          </>
        )}

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
          hideSchoolYearSelect
          schoolYearId={schoolYearId}
          onSchoolYearIdChange={setSchoolYearId}
          onSchoolYearsLoaded={setSchoolYears}
          onChange={(data) => {
            amountManuallyEditedRef.current = false;
            setAmountManuallyEdited(false);
            lastAutoFillKeyRef.current = "";

            const parentChanged =
              data.parentId !== selectionParentIdRef.current;
            if (parentChanged) {
              userDeselectedFraisIdsRef.current.clear();
              selectionParentIdRef.current = data.parentId;
            }

            setSelection({
              parentId: data.parentId,
              classEnrollIds: data.classEnrollIds,
            });
            setSchoolYearId(data.schoolYearId);
            setValue("parentId", data.parentId);
            setValue("classEnrollIds", data.classEnrollIds);

            void reloadSelectableFrais(
              data.classEnrollIds,
              data.parentId,
              data.schoolYearId || schoolYearId,
              { autoSelect: true },
            );
          }}
        />
      </div>

      {/* RIGHT */}
      <div className="w-full lg:w-96 border p-3 rounded-md space-y-3">
        <MultiSelect
          options={fraisOptions}
          value={watch("fraisIds") || []}
          onValueChange={handleFraisChange}
          placeholder={
            loadingSelectableFrais
              ? "Chargement des frais…"
              : selection.classEnrollIds.length
                ? "Sélectionner les frais"
                : `Sélectionnez ${peopleLabels.studentIndefinite} d'abord`
          }
          searchable
          closeOnSelect={false}
          hideSelected
          disabled={!selection.classEnrollIds.length || loadingSelectableFrais}
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
                      {frais.dueEnrollmentCount > 0 &&
                        frais.selectedEnrollmentCount > 1 &&
                        ` · ${frais.dueEnrollmentCount}/${frais.selectedEnrollmentCount} ${peopleLabels.studentPluralLower}`}
                      {frais.dueEnrollmentCount > 1 &&
                        frais.selectedEnrollmentCount <= 1 &&
                        ` × ${frais.dueEnrollmentCount} ${peopleLabels.studentPluralLower}`}
                    </p>
                    {frais.hasDiscount ? (
                      <p className="text-[11px] font-medium text-amber-700">
                        Remise {summary.discount}% applicable
                        {summary.discountTypeFraisName
                          ? ` (${summary.discountTypeFraisName})`
                          : ""}
                      </p>
                    ) : null}
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
                Sélectionnez {peopleLabels.studentIndefinite} et au moins un frais pour voir le
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
                    {summary.studentCount}{" "}
                    {pluralizeStudentLabelLower(peopleLabels, summary.studentCount)} ·{" "}
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
                        {summary.discountTypeFraisName
                          ? ` · ${summary.discountTypeFraisName}`
                          : ""}
                      </span>
                      <span className="text-right font-medium text-orange-600">
                        {summary.discountAmount > 0
                          ? `-${formatAmount(summary.discountAmount)}`
                          : "—"}
                      </span>
                      {summary.discountTypeFraisName &&
                      !summary.hasEligibleFraisSelected ? (
                        <p className="col-span-2 text-[11px] text-amber-700">
                          Sélectionnez un frais « {summary.discountTypeFraisName} »
                          pour appliquer la remise.
                        </p>
                      ) : null}
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
                <MontantInput {...amountInputProps} />
                <p className="text-[11px] text-muted-foreground">
                  {baseHint
                    ? baseHint
                    : amountManuallyEdited
                      ? "Montant modifié manuellement"
                      : "Saisissez le montant payé"}
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
