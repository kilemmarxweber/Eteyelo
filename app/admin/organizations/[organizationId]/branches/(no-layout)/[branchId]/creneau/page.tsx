"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";

import { useState } from "react";
import { IconBeach, IconPlus } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CreneauUpForm } from "./components/creneau-form";
import CreneauList from "./components/CreneausTable";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Creneaus() {
  const [open, setOpen] = useState(false);
  const { refreshKey, refresh } = useRefresh();

  const handleCreneauAction = () => {
    refresh();
    setOpen(false);
  };

  return (
    <BranchPageShell
      title="Vacations"
      description="Configurez les séances et la récréation (ex. 3 + 3 au secondaire)."
      badge={
        <Badge variant="outline-primary" icon={<IconBeach size={14} />}>
          Vacations
        </Badge>
      }
      actions={
        <Button
          type="button"
          size="sm"
          variant="default"
          leftSection={<IconPlus size={16} />}
          onClick={() => setOpen(true)}
        >
          Ajouter une vacation
        </Button>
      }
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
            <SheetTitle>Nouvelle vacation</SheetTitle>
            <SheetDescription>
              Choisissez un modèle, puis ajustez les horaires si besoin.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <CreneauUpForm
              key={open ? "creneau-create-open" : "creneau-create-closed"}
              mode="create"
              layout="dialog"
              onCreated={handleCreneauAction}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Card variant="default" className="border p-1 md:p-6">
        <CreneauList refreshKey={String(refreshKey)} />
      </Card>
    </BranchPageShell>
  );
}
