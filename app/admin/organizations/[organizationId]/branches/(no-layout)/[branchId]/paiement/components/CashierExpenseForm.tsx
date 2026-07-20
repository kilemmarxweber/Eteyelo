"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cashierExpenseSchema } from "@/src/interfaces/Paiement";
import { createCashierExpenseAction } from "../paiement.action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import z from "zod";

type FormData = z.infer<typeof cashierExpenseSchema>;

interface Props {
  onCreated?: () => void;
  onSuccess?: () => void;
  onClose?: () => void;
}

export default function CashierExpenseForm({
  onCreated,
  onSuccess,
  onClose,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(cashierExpenseSchema),
    defaultValues: {
      amount: 0,
      description: "",
      category: "",
    },
  });

  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = async (data: FormData) => {
    setServerError(null);

    const [res, err] = await createCashierExpenseAction(data);

    if (err) {
      setServerError(
        err.message ?? "Erreur lors de la création de la dépense.",
      );
      toast.error(err.message ?? "Erreur lors de la création de la dépense.");
      return;
    }

    toast.success("Dépense enregistrée avec succès");
    reset();
    onCreated?.();
    onSuccess?.();
  };

  return (
    <Card className="rounded-xl border p-4">
      <CardHeader>
        <CardTitle>Dépense caisse</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <Input
            type="number"
            step="0.01"
            placeholder="Montant (devise de base de l'organisation)"
            {...register("amount", { valueAsNumber: true })}
          />
          <Input
            placeholder="Catégorie (ex: fournitures, transport)"
            {...register("category")}
          />
          <Textarea
            placeholder="Description ou note"
            rows={4}
            {...register("description")}
          />
        </div>

        {serverError ? (
          <div className="text-sm text-destructive">{serverError}</div>
        ) : null}

        <Button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className="w-full"
        >
          Enregistrer la dépense
        </Button>
      </CardContent>
    </Card>
  );
}
