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
import { useLocale, useTranslations } from "next-intl";

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
  classEnrollList?: any;
  onCreated?: () => void;
  onSuccess?: () => void;
  initialSearch?: string;
  initialEnrollmentId?: string;
}

function buildTransactionRef() {
  const now = new Date();
  const date = [
    now.getFullYear().toString().slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `TRNS-${date}-${rand}`;
}

const emptyAmount = undefined as unknown as number;

function formatAmount(value: number, locale = "fr-FR") {
  return value.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function PaymentsForm({
  fraisList,
  classEnrollList: _classEnrollList,
  onCreated,
  onSuccess,
  initialSearch = "",
  initialEnrollmentId = "",
}: Props) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const peopleLabels = useBranchPeopleLabels();
  const numberLocale = locale.startsWith("en")
    ? "en-GB"
    : locale.startsWith("pt")
      ? "pt-PT"
      : "fr-FR";
  const fmt = (value: number) => formatAmount(value, numberLocale);
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
        toast.error(t("loadFeesFailed"));
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
          name: selectable?.nameFrais ?? frais?.nameFrais ?? t("feeFallback"),
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
        name: frais?.nameFrais ?? t("feeFallback"),
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
        error instanceof Error ? error.message : t("conversionFailed"),
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
        error instanceof Error ? error.message : t("conversionFailed"),
      );
    }
  };

  // ================= SUBMIT =================
  const onSubmit = async (data: FormData) => {
    try {
      // 🏦 BANK CHECK 1: Already paid?
      if (isSolded) {
        toast.error(t("alreadyFullySettled"));
        return;
      }

      // 🏦 BANK CHECK 2: Selection complete?
      if (hasNoSelection) {
        toast.error(
          t("selectStudentAndFee", { student: peopleLabels.studentIndefinite }),
        );
        return;
      }

      // 🏦 BANK CHECK 3: Valid amount? (devise de base)
      const inputAmountBase = Number.isFinite(Number(data.amount))
        ? Number(data.amount)
        : 0;
      if (!inputAmountBase || inputAmountBase <= 0) {
        toast.error(t("amountMustBePositive"));
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
              t("exchangeRateInactive", {
                from: receivedCurrency,
                to: baseCurrency,
              }),
            );
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("conversionFailed"),
        );
        setLoading(false);
        return;
      }

      // 💰 Show refund warning if applicable
      if (refundAmountBase > 0) {
        setAmountWarning(
          t("amountWarning", {
            entered: fmt(inputAmountBase),
            due: fmt(finalAmountBase),
            refund: fmt(refundAmountBase),
            currency: baseCurrency,
          }),
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
        toast.warning(res?.message || t("alreadyFullySettled"));
        setSelection({ parentId: "", classEnrollIds: [] });
        return;
      }

      if (!res || res.totalPaid === 0) {
        toast.warning(res?.message || t("noPaymentMade"));
        return;
      }

      // 💰 Show success with refund info if applicable
      const successMsg =
        refundAmountBase > 0
          ? t("paymentWithRefund", {
              paid: fmt(finalAmountBase),
              refund: fmt(refundAmountBase),
              currency: baseCurrency,
            })
          : res?.message || t("paymentSuccess");

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
      toast.error(t("genericError", { message: e.message }));
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
      label: `${f.nameFrais} (${fmt(Number(f.montantFrais))} ${baseCurrency})`,
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
        ? t("alreadySettled")
        : t("amountPaidPlaceholder", { currency: receivedCurrency }),
    disabled: !hasNoSelection && isSolded,
    className: cn(
      "h-9 text-sm border-2 border-primary ring-2 ring-primary/25 hover:border-primary hover:ring-primary/40 focus-visible:border-primary focus-visible:ring-primary/50",
      !hasNoSelection &&
        isSolded &&
        "cursor-not-allowed border-input opacity-50 ring-0 hover:border-input hover:ring-0",
    ),
  };

  const baseHint =
    receivedCurrency !== baseCurrency && amount > 0
      ? t("approxBase", { amount: fmt(amount), currency: baseCurrency })
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
  // ================= UI =================
  return (
    <>
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 lg:flex-row lg:items-stretch"
    >
      {/* LEFT */}
      <div className="hidden w-64 shrink-0 flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 lg:flex">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("settings")}
        </p>
        <Select
          value={schoolYearId || undefined}
          onValueChange={setSchoolYearId}
        >
          <SelectTrigger className="h-9 w-full text-sm transition-colors hover:border-primary/40">
            <SelectValue placeholder={t("schoolYearPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {schoolYears.map((year) => (
              <SelectItem key={year.id} value={year.id}>
                {year.nameYear}
                {year.isCurrentYear ? ` ${t("yearInProgress")}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={watch("modePaiement")}
          onValueChange={(v) => setValue("modePaiement", v as ModePaiement)}
        >
          <SelectTrigger className="h-9 w-full text-sm transition-colors hover:border-primary/40">
            <SelectValue placeholder={t("paymentMode")} />
          </SelectTrigger>
          <SelectContent>
            {Object.values(ModePaiement).map((m) => (
              <SelectItem key={m} value={m}>
                {t(`modes.${m}` as never)}
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
              className={cn(amountInputProps.className, "w-full")}
            />
            {!hasNoSelection && !isSolded && (
              <p className="text-[11px] text-muted-foreground -mt-1">
                {baseHint
                  ? baseHint
                  : amountManuallyEdited
                    ? t("amountEditedManually")
                    : t("enterPaidAmount")}
              </p>
            )}
          </>
        )}

        <Textarea
          {...register("notes")}
          placeholder={t("notesPlaceholder")}
          className="min-h-[45px] w-full resize-none bg-background/80"
        />

        {/* 💾 BOUTON SUBMIT */}
        <Button
          type="submit"
          className="mt-1 w-full shadow-sm transition-transform active:scale-[0.98]"
          disabled={loading || (!hasNoSelection && isSolded)}
        >
          {!hasNoSelection && isSolded
            ? t("submitSettled")
            : loading
              ? t("submitting")
              : t("submitValidate")}
        </Button>
      </div>

      {/* CENTER */}
      <div className="min-w-0 flex-1 rounded-xl border border-border/70 bg-background p-3 shadow-sm sm:p-4">
        <FamilySelector
          key={`family-${initialSearch}-${initialEnrollmentId}`}
          resetKey={familyResetKey}
          hideSchoolYearSelect
          initialSearch={initialSearch}
          initialEnrollmentId={initialEnrollmentId}
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
      <div className="w-full space-y-3 rounded-xl border border-border/70 bg-muted/15 p-3 sm:p-4 lg:w-[22rem] lg:shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("feesAndSummary")}
        </p>
        <MultiSelect
          options={fraisOptions}
          value={watch("fraisIds") || []}
          onValueChange={handleFraisChange}
          placeholder={
            loadingSelectableFrais
              ? t("loadingFees")
              : selection.classEnrollIds.length
                ? t("selectFees")
                : t("selectStudentFirst", {
                    student: peopleLabels.studentIndefinite,
                  })
          }
          searchable
          closeOnSelect={false}
          hideSelected
          disabled={!selection.classEnrollIds.length || loadingSelectableFrais}
        />

        {selectedFraisDetails.length > 0 && (
          <div className="animate-fade-in overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2.5">
              <Receipt className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">
                {t("selectedFees", { count: selectedFraisDetails.length })}
              </p>
            </div>
            <ul className="max-h-48 divide-y overflow-y-auto">
              {selectedFraisDetails.map((frais) => (
                <li
                  key={frais.id}
                  className="flex items-start justify-between gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{frais.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(frais.unitAmount)}
                      {frais.dueEnrollmentCount > 0 &&
                        frais.selectedEnrollmentCount > 1 &&
                        ` · ${frais.dueEnrollmentCount}/${frais.selectedEnrollmentCount} ${peopleLabels.studentPluralLower}`}
                      {frais.dueEnrollmentCount > 1 &&
                        frais.selectedEnrollmentCount <= 1 &&
                        ` × ${frais.dueEnrollmentCount} ${peopleLabels.studentPluralLower}`}
                    </p>
                    {frais.hasDiscount ? (
                      <p className="text-[11px] font-medium text-amber-700">
                        {t("discountApplicable", { percent: summary.discount })}
                        {summary.discountTypeFraisName
                          ? ` (${summary.discountTypeFraisName})`
                          : ""}
                      </p>
                    ) : null}
                    {frais.alreadyPaid > 0 && (
                      <p className="text-xs text-green-700">
                        {t("alreadyPaidColon", {
                          amount: fmt(frais.alreadyPaid),
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {t("remaining")}
                    </span>
                    <span className="font-semibold text-primary">
                      {fmt(frais.remaining)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFrais(frais.id)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={t("removeFee", { name: frais.name })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Card
          variant="default"
          className="overflow-hidden border-border/60 shadow-sm transition-shadow hover:shadow-md"
        >
          <CardContent className="space-y-3 pt-4">
            <p className="font-bold">{t("summary")}</p>

            {hasNoSelection ? (
              <p className="text-sm text-muted-foreground">
                {t("summaryEmpty", {
                  student: peopleLabels.studentIndefinite,
                })}
              </p>
            ) : balances.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("computingBalances")}
              </p>
            ) : (
              <>
                {summary.studentCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("summaryCounts", {
                      students: `${summary.studentCount} ${pluralizeStudentLabelLower(peopleLabels, summary.studentCount)}`,
                      fees: summary.fraisCount,
                    })}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <span className="text-muted-foreground">{t("totalFees")}</span>
                  <span className="text-right font-medium">
                    {fmt(summary.totalDue)}
                  </span>

                  {summary.alreadyPaid > 0 && (
                    <>
                      <span className="text-muted-foreground">{t("alreadyPaid")}</span>
                      <span className="text-right font-medium text-green-700">
                        -{fmt(summary.alreadyPaid)}
                      </span>
                    </>
                  )}

                  {summary.discount > 0 && (
                    <>
                      <span className="text-muted-foreground">
                        {t("discountPercent", { percent: summary.discount })}
                        {summary.discountTypeFraisName
                          ? ` · ${summary.discountTypeFraisName}`
                          : ""}
                      </span>
                      <span className="text-right font-medium text-orange-600">
                        {summary.discountAmount > 0
                          ? `-${fmt(summary.discountAmount)}`
                          : "—"}
                      </span>
                      {summary.discountTypeFraisName &&
                      !summary.hasEligibleFraisSelected ? (
                        <p className="col-span-2 text-[11px] text-amber-700">
                          {t("selectFeeForDiscount", {
                            name: summary.discountTypeFraisName,
                          })}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-2.5">
                  <span className="font-bold">
                    {isSolded ? t("fullySettled") : t("remainingToPay")}
                  </span>
                  <span
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      isSolded ? "text-green-600" : "text-primary",
                    )}
                  >
                    {fmt(summary.remaining)}
                  </span>
                </div>

                {!isSolded && amount > 0 && (
                  <div className="flex justify-between border-t pt-2 text-sm">
                    <span className="text-muted-foreground">{t("enteredAmount")}</span>
                    <span className="font-semibold tabular-nums">
                      {fmt(amount)}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Montant payé — mobile/tablette */}
            {!isLargeScreen && !hasNoSelection && !isSolded && (
              <div className="space-y-2 border-t pt-3">
                <label className="text-sm font-medium">{t("amountPaid")}</label>
                {currencyToggle}
                <MontantInput {...amountInputProps} />
                <p className="text-[11px] text-muted-foreground">
                  {baseHint
                    ? baseHint
                    : amountManuallyEdited
                      ? t("amountEditedManually")
                      : t("enterPaidAmount")}
                </p>
                <Button
                  type="submit"
                  className="w-full shadow-sm transition-transform active:scale-[0.98]"
                  disabled={loading || (!hasNoSelection && isSolded)}
                >
                  {!hasNoSelection && isSolded
                    ? t("submitSettled")
                    : loading
                      ? t("submitting")
                      : t("submitValidate")}
                </Button>
              </div>
            )}

            {/* Remboursement si montant saisi > reste */}
            {!isSolded &&
              amount > summary.remaining &&
              amount > 0 &&
              balances.length > 0 && (
              <div className="space-y-1 rounded-lg border border-amber-200/80 bg-amber-50 p-2.5 animate-fade-in">
                <p className="text-xs font-bold text-yellow-800">
                  {t("excessTitle")}
                </p>
                <div className="flex justify-between text-xs">
                  <span className="text-yellow-700">{t("refund")}</span>
                  <span className="font-bold text-yellow-700">
                    {fmt(amount - summary.remaining)}
                  </span>
                </div>
              </div>
            )}

            {amountWarning && (
              <p className="rounded-lg bg-orange-50 p-2 text-xs text-orange-600 animate-fade-in">
                {amountWarning}
              </p>
            )}

            {!hasNoSelection && isSolded && balances.length > 0 && (
              <p className="rounded-lg bg-green-50 p-2 text-xs font-medium text-green-600 animate-fade-in">
                {t("folderSettled")}
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
      autoPrint
      autoPrintCopies={2}
      title={t("receiptTitle")}
      description={
        receiptData
          ? t("receiptReady", { number: receiptData.invoiceNumber })
          : undefined
      }
      banner={
        <div className="flex items-center gap-2 font-medium text-green-700">
          <CheckCircle2 className="size-4" />
          {t("paymentCreated")}
        </div>
      }
    />
    </>
  );
}
