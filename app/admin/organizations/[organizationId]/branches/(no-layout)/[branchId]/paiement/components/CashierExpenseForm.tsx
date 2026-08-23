"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cashierExpenseSchema } from "@/src/interfaces/Paiement";
import { createCashierExpenseAction } from "../paiement.action";
import { Button } from "@/components/custom/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import z from "zod";
import {
  CASHIER_EXPENSE_CATEGORIES,
  loadCustomExpenseCategories,
  saveCustomExpenseCategory,
} from "./cashier-expense-categories";

type FormData = z.infer<typeof cashierExpenseSchema>;

interface Props {
  onCreated?: () => void;
  onSuccess?: () => void;
  onClose?: () => void;
  layout?: "default" | "dialog";
}

export default function CashierExpenseForm({
  onCreated,
  onSuccess,
  onClose,
  layout = "default",
}: Props) {
  const isDialog = layout === "dialog";
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    resolver: zodResolver(cashierExpenseSchema),
    defaultValues: {
      amount: undefined as unknown as number,
      description: "",
      category: "",
    },
  });

  const [serverError, setServerError] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const category = watch("category") ?? "";

  useEffect(() => {
    setCustomCategories(loadCustomExpenseCategories());
  }, []);

  const categoryOptions = useMemo(() => {
    const merged = [...CASHIER_EXPENSE_CATEGORIES, ...customCategories];
    const unique = Array.from(
      new Map(merged.map((item) => [item.toLowerCase(), item])).values(),
    );
    return unique.map((item) => ({
      value: item,
      label: item,
      search: item,
    }));
  }, [customCategories]);

  const handleCategoryChange = (value: string) => {
    setValue("category", value, { shouldValidate: true, shouldDirty: true });
  };

  const handleCreateCategory = (label: string) => {
    const next = label.trim();
    if (!next) return;
    const updated = saveCustomExpenseCategory(next);
    setCustomCategories(updated);
    setValue("category", next, { shouldValidate: true, shouldDirty: true });
    toast.success(`Catégorie « ${next} » ajoutée`);
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);

    const normalizedCategory = (data.category ?? "").trim();
    if (!normalizedCategory) {
      toast.error("Choisissez ou ajoutez une catégorie.");
      return;
    }

    const [, err] = await createCashierExpenseAction({
      ...data,
      category: normalizedCategory,
    });

    if (err) {
      setServerError(
        err.message ?? "Erreur lors de l'enregistrement de la sortie de fond.",
      );
      toast.error(
        err.message ?? "Erreur lors de l'enregistrement de la sortie de fond.",
      );
      return;
    }

    toast.success("Dépense / sortie de fond enregistrée");
    reset({
      amount: undefined as unknown as number,
      description: "",
      category: "",
    });
    onCreated?.();
    onSuccess?.();
    onClose?.();
  };

  const labelClass = isDialog
    ? "text-xs font-medium text-muted-foreground"
    : "text-sm font-medium";
  const controlClass = isDialog
    ? "h-9 rounded-md px-3 text-sm font-normal"
    : undefined;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn(isDialog ? "grid gap-y-2" : "space-y-4")}
    >
      <div
        className={cn(
          "grid",
          isDialog ? "gap-x-4 gap-y-2 sm:grid-cols-2" : "gap-3",
        )}
      >
        <div className={cn(isDialog ? "space-y-0.5" : "space-y-1.5")}>
          <Label htmlFor="expense-amount" className={labelClass}>
            Montant
          </Label>
          <Input
            id="expense-amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            className={controlClass}
            {...register("amount", { valueAsNumber: true })}
          />
          {errors.amount ? (
            <p className="text-xs text-destructive">{errors.amount.message}</p>
          ) : null}
        </div>

        <div className={cn(isDialog ? "space-y-0.5" : "space-y-1.5")}>
          <Label htmlFor="expense-category" className={labelClass}>
            Catégorie
          </Label>
          <SearchableSelect
            id="expense-category"
            searchable
            options={categoryOptions}
            value={category || undefined}
            onValueChange={handleCategoryChange}
            onCreate={handleCreateCategory}
            createLabel={(query) => `+ Ajouter « ${query} »`}
            placeholder="Rechercher ou choisir…"
            searchPlaceholder="Rechercher une catégorie…"
            emptyMessage="Aucune catégorie. Tapez pour en créer une."
            triggerClassName={cn(controlClass, "w-full")}
          />
          {errors.category ? (
            <p className="text-xs text-destructive">
              {errors.category.message}
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            isDialog ? "space-y-0.5 sm:col-span-2" : "space-y-1.5",
          )}
        >
          <Label htmlFor="expense-description" className={labelClass}>
            Description
          </Label>
          <Textarea
            id="expense-description"
            placeholder="Précisez le motif de la dépense ou sortie de fond"
            rows={isDialog ? 4 : 4}
            className={isDialog ? "min-h-24 resize-none" : undefined}
            {...register("description")}
          />
          {errors.description ? (
            <p className="text-xs text-destructive">
              {errors.description.message}
            </p>
          ) : null}
        </div>
      </div>

      {isDialog ? (
        <p className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground">
          Le montant est enregistré dans la devise de base de
          l&apos;organisation. Tapez dans la catégorie pour rechercher ou
          ajouter.
        </p>
      ) : null}

      {serverError ? (
        <div className="text-sm text-destructive">{serverError}</div>
      ) : null}

      <Button
        type="submit"
        size={isDialog ? "default" : undefined}
        loading={isSubmitting}
        className={cn(
          "w-full font-medium",
          isDialog && "mt-2 h-11 text-base",
        )}
      >
        Enregistrer la sortie de fond
      </Button>
    </form>
  );
}
