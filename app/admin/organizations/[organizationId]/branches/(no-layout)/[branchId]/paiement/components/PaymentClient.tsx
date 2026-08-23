"use client";

import { Suspense, useEffect, useState } from "react";
import { HandCoins, Wallet } from "lucide-react";

import PaymentsForm from "./PaymentsForm";
import CashierExpenseForm from "./CashierExpenseForm";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { shouldPreventDismissOutside } from "@/lib/radix-portal-dismiss";

type Props = {
  fraisList: any[];
  initialSearch?: string;
  initialEnrollmentId?: string;
};

export default function PaymentClient({
  fraisList,
  initialSearch = "",
  initialEnrollmentId = "",
}: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const focusCheckout = Boolean(initialSearch || initialEnrollmentId);
  const [showSecondary, setShowSecondary] = useState(!focusCheckout);

  useEffect(() => {
    if (!focusCheckout) return;
    const timer = window.setTimeout(() => setShowSecondary(true), 900);
    return () => window.clearTimeout(timer);
  }, [focusCheckout]);

  const handleExpenseCreated = () => {
    setRefreshKey((k) => k + 1);
    setShowExpenseForm(false);
  };

  return (
    <>
      <div className="space-y-5 pb-2">
        <section
          className={cn(
            "animate-fade-up overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm",
            "ring-1 ring-black/[0.02]",
          )}
        >
          <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-primary/[0.06] via-background to-background px-4 py-3.5 sm:px-5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="size-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight sm:text-base">
                Encaissement
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Recherchez un élève, cochez les frais, validez le paiement.
              </p>
            </div>
          </div>
          <div className="p-3 sm:p-5">
            <Suspense
              fallback={
                <div className="animate-pulse rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                  Chargement du formulaire…
                </div>
              }
            >
              <PaymentsForm
                fraisList={fraisList}
                initialSearch={initialSearch}
                initialEnrollmentId={initialEnrollmentId}
                onCreated={() => setRefreshKey((k) => k + 1)}
              />
            </Suspense>
          </div>
        </section>

        {showSecondary ? (
          <div className="space-y-5">
            <div className="animate-fade-up animate-delay-75">
              <CashierReportLazy
                refreshKey={refreshKey}
                onToggleExpenseForm={() => setShowExpenseForm(true)}
              />
            </div>
            <div className="animate-fade-up animate-delay-150">
              <UnpaidReportLazy refreshKey={refreshKey} />
            </div>
            <div className="animate-fade-up animate-delay-225 overflow-hidden rounded-2xl border border-border/70 bg-card p-3 shadow-sm ring-1 ring-black/[0.02] sm:p-5">
              <PaiementsTableLazy refreshKey={refreshKey} />
            </div>
          </div>
        ) : (
          <p className="animate-fade-in text-center text-xs text-muted-foreground">
            Préparation des rapports de caisse…
          </p>
        )}
      </div>

      <Sheet
        open={showExpenseForm}
        onOpenChange={(open) => {
          // Empêche la fermeture du sheet quand on ouvre/ferme le select catégorie
          if (!open && shouldPreventDismissOutside(null)) return;
          setShowExpenseForm(open);
        }}
      >
        <SheetContent
          side="right"
          className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
          onPointerDownOutside={(event) => {
            if (shouldPreventDismissOutside(event.target)) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (shouldPreventDismissOutside(event.target)) {
              event.preventDefault();
            }
          }}
          onFocusOutside={(event) => {
            if (shouldPreventDismissOutside(event.target)) {
              event.preventDefault();
            }
          }}
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
            <SheetTitle className="flex items-center gap-2">
              <HandCoins className="size-5 text-red-900" />
              Dépense ou sortie de fond
            </SheetTitle>
            <SheetDescription>
              Enregistrez une dépense ou sortie de fond. Le solde net du
              rapport sera mis à jour.
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

function CashierReportLazy({
  refreshKey,
  onToggleExpenseForm,
}: {
  refreshKey: number;
  onToggleExpenseForm: () => void;
}) {
  const [Comp, setComp] = useState<null | typeof import("./CashierReport").default>(
    null,
  );
  useEffect(() => {
    void import("./CashierReport").then((m) => setComp(() => m.default));
  }, []);
  if (!Comp) return null;
  return (
    <Comp refreshKey={refreshKey} onToggleExpenseForm={onToggleExpenseForm} />
  );
}

function UnpaidReportLazy({ refreshKey }: { refreshKey: number }) {
  const [Comp, setComp] = useState<null | typeof import("./UnpaidReport").default>(
    null,
  );
  useEffect(() => {
    void import("./UnpaidReport").then((m) => setComp(() => m.default));
  }, []);
  if (!Comp) return null;
  return <Comp refreshKey={refreshKey} />;
}

function PaiementsTableLazy({ refreshKey }: { refreshKey: number }) {
  const [Comp, setComp] = useState<
    null | typeof import("./PaiementsTable").default
  >(null);
  useEffect(() => {
    void import("./PaiementsTable").then((m) => setComp(() => m.default));
  }, []);
  if (!Comp) return null;
  return <Comp key={refreshKey} />;
}
