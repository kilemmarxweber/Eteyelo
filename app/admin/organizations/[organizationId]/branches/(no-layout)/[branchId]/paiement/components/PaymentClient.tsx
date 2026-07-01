"use client";

import { useState } from "react";
import PaiementsTable from "./PaiementsTable";
import PaymentsForm from "./PaymentsForm";
import CashierExpenseForm from "./CashierExpenseForm";
import CashierReport from "./CashierReport";
type Props = {
  fraisList: any[];
  classEnrollList: any[];
};
export default function PaymentClient({ fraisList, classEnrollList }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  return (
    <>
      <div className="mt-2 p-1 md:p-6 space-y-4">
        <div
          className={`grid gap-4 ${showExpenseForm ? "xl:grid-cols-[2fr_1fr]" : "xl:grid-cols-1"}`}
        >
          <PaymentsForm
            fraisList={fraisList}
            classEnrollList={classEnrollList}
            onPaymentCreated={() => setRefreshKey((k) => k + 1)}
          />
          {showExpenseForm && (
            <CashierExpenseForm
              onExpenseCreated={() => setRefreshKey((k) => k + 1)}
              onClose={() => setShowExpenseForm(false)}
            />
          )}
        </div>

        <CashierReport
          refreshKey={refreshKey}
          onToggleExpenseForm={() => setShowExpenseForm(!showExpenseForm)}
          showExpenseForm={showExpenseForm}
        />
      </div>
      <div className="mt-4 border rounded-xl p-1 md:p-6">
        <PaiementsTable key={refreshKey} />
      </div>
    </>
  );
}
