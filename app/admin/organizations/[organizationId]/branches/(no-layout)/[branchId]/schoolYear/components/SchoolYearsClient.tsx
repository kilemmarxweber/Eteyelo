"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { IconCalendarEvent, IconPlus } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { SchoolYearUpForm } from "./SchoolYear-form";
import SchoolYearsList from "./SchoolYearsTable";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { prepareNextSchoolYearAction } from "../schoolYear.action";
import { canPrepareNextAcademicYear } from "@/lib/academic-year";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

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
      <LayoutBody className="space-y-4">
        <PageHeader
          title="Liste des annees scolaires"
          description="Gerez les annees scolaires actives et preparez la suivante."
          badge={
            <Badge
              variant="outline-primary"
              icon={<IconCalendarEvent size={14} />}
            >
              Annees scolaires
            </Badge>
          }
          actions={
            <>
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
              <Button type="button" variant="default" onClick={() => setOpen(true)}>
                <IconPlus size={16} className="mr-2" />
                Ajouter une annee
              </Button>
            </>
          }
        />

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle>Ajouter une annee scolaire</DialogTitle>
              <DialogDescription>
                Renseignez les informations de l'annee scolaire puis enregistrez.
              </DialogDescription>
            </DialogHeader>

            <SchoolYearUpForm
              mode="create"
              branchId={branchId}
              onCreated={handleCreated}
            />
          </DialogContent>
        </Dialog>

        <Card variant="elevated" padding="none" className="border p-1 md:p-6">
          <SchoolYearsList refreshKey={refreshKey} branchId={branchId} />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
