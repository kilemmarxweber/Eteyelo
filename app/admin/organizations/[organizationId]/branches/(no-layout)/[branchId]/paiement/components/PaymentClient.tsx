"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";

import PaiementsTable from "./PaiementsTable";
import PaymentsForm from "./PaymentsForm";
import CashierExpenseForm from "./CashierExpenseForm";
import CashierReport from "./CashierReport";
import UnpaidReport from "./UnpaidReport";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Props = {
  fraisList: any[];
  classEnrollList: any[];
};

export default function PaymentClient({ fraisList, classEnrollList }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const handleExpenseCreated = () => {
    setRefreshKey((k) => k + 1);
    setShowExpenseForm(false);
  };

  return (
    <>
      <div className="mt-2 space-y-4 p-1 md:p-6">
        <PaymentsForm
          fraisList={fraisList}
          classEnrollList={classEnrollList}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />

        <CashierReport
          refreshKey={refreshKey}
          onToggleExpenseForm={() => setShowExpenseForm(true)}
        />
        <UnpaidReport refreshKey={refreshKey} />
      </div>

      <div className="mt-4 rounded-xl border p-1 md:p-6">
        <PaiementsTable key={refreshKey} />
      </div>

      <Sheet open={showExpenseForm} onOpenChange={setShowExpenseForm}>
        <SheetContent
          side="right"
          className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
            <SheetTitle className="flex items-center gap-2">
              <HandCoins className="size-5 text-red-900" />
              Ajouter une dépense
            </SheetTitle>
            <SheetDescription>
              Enregistrez une sortie de caisse. Le solde net du rapport sera
              mis à jour.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <CashierExpenseForm
              layout="dialog"
              onCreated={handleExpenseCreated}
              onClose={() => setShowExpenseForm(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
