"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cashierExpenseSchema } from "@/src/interfaces/Paiement";
import { createCashierExpenseAction } from "../paiement.action";
import { Button } from "@/components/custom/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import z from "zod";

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

  const onSubmit = async (data: FormData) => {
    setServerError(null);

    const [, err] = await createCashierExpenseAction(data);

    if (err) {
      setServerError(
        err.message ?? "Erreur lors de la création de la dépense.",
      );
      toast.error(err.message ?? "Erreur lors de la création de la dépense.");
      return;
    }

    toast.success("Dépense enregistrée avec succès");
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
      <div className={cn("grid", isDialog ? "gap-x-4 gap-y-2 sm:grid-cols-2" : "gap-3")}>
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
          <Input
            id="expense-category"
            placeholder="Ex. fournitures, transport"
            className={controlClass}
            {...register("category")}
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
            placeholder="Description ou note"
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
          Le montant est enregistré dans la devise de base de l&apos;organisation.
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
        Enregistrer la dépense
      </Button>
    </form>
  );
}
