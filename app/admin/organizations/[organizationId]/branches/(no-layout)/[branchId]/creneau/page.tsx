"use client";
import { useState } from "react";
import { Button } from "@/components/custom/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreneauUpForm } from "./components/creneau-form";
import { Layout, LayoutBody } from "@/components/custom/layout";
import CreneauList from "./components/CreneausTable";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { Card } from "@/components/ui/card";

export default function Creneaus() {
  const [open, setOpen] = useState(false);
  const { refreshKey, refresh } = useRefresh();

  const handleCreneauAction = () => {
    refresh();
    setOpen(false);
  };

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl dark:text-white">
              Vacations
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Définissez les plages horaires utilisées par les classes.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="default">Ajouter une vacation</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Nouvelle vacation</DialogTitle>
                <DialogDescription>
                  Renseignez les horaires, la durée des cours et la récréation.
                </DialogDescription>
              </DialogHeader>

              <CreneauUpForm
                key={open ? "creneau-create-open" : "creneau-create-closed"}
                mode="create"
                onCreated={handleCreneauAction}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Card variant="default" className="border p-1 md:p-6">
          <CreneauList refreshKey={String(refreshKey)} />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
