"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { prepareNextSchoolYearAction } from "../schoolYear.action";
import { canPrepareNextAcademicYear } from "@/lib/academic-year";

interface Props {
  branchId: string;
}

export default function SchoolYearsClient({ branchId }: Props) {
  const [open, setOpen] = useState(false);
  const [isPreparing, startPreparing] = useTransition();
  const { refreshKey, refresh } = useRefresh();

  const handleCreated = () => {
    refresh();
    setOpen(false);
  };

  const canPrepareNextYear = canPrepareNextAcademicYear();

  const handlePrepareNextYear = () => {
    startPreparing(async () => {
      const [schoolYear, err] = await prepareNextSchoolYearAction();

      if (err) {
        toast.error(err.message);
        return;
      }

      toast.success(
        schoolYear?.nameYear
          ? `Annee ${schoolYear.nameYear} preparee`
          : "Prochaine annee preparee",
      );
      refresh();
    });
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              loading={isPreparing}
              disabled={!canPrepareNextYear}
              title={
                canPrepareNextYear
                  ? undefined
                  : "Disponible a partir du mois d'aout"
              }
              onClick={handlePrepareNextYear}
            >
              Preparer la prochaine annee
            </Button>
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
          </div>

          <div className="mt-8 border p-1 md:p-6 rounded-lg shadow-md">
            <SchoolYearsList refreshKey={refreshKey} branchId={branchId} />
          </div>
        </div>
      </LayoutBody>
    </Layout>
  );
}
