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
import { Layout, LayoutBody } from "@/components/custom/layout";
import { SchoolYearUpForm } from "./SchoolYear-form";
import SchoolYearsList from "./SchoolYearsTable";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface Props {
  branchId: string;
}

export default function SchoolYearsClient({ branchId }: Props) {
  const [open, setOpen] = useState(false);
  const { refreshKey, refresh } = useRefresh();

  const handleCreated = () => {
    refresh();
    setOpen(false);
  };

  return (
    <Layout>
      <LayoutBody>
        <div className="flex items-center justify-between mb-0">
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl dark:text-white">
            Liste des Années scolaires
          </h1>
        </div>

        <div className="p-1">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="default">Ajouter</Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter une année scolaire</DialogTitle>

                <DialogDescription>
                  Apporter des modifications à l'année scolaire ici. Cliquez sur
                  Enregistrer lorsque vous êtes fait.
                </DialogDescription>
              </DialogHeader>

              <SchoolYearUpForm
                mode="create"
                branchId={branchId}
                onCreated={handleCreated}
              />
            </DialogContent>
          </Dialog>

          <div className="mt-8 border p-1 md:p-6 rounded-lg shadow-md">
            <SchoolYearsList key={refreshKey} branchId={branchId} />
          </div>
        </div>
      </LayoutBody>
    </Layout>
  );
}
