"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { useRefresh } from "@/src/hooks/RefreshContext";

import { updateSchoolYearAction } from "../schoolYear.action";

import { useSchoolYearLabels } from "@/hooks/use-school-year-labels";

export const CurrentYear: React.FC<ISchoolYear> = ({
  id,
  nameYear,
  startYear,
  endYear,
  isCurrentYear,
}) => {
  const { labelLower } = useSchoolYearLabels();
  const [checked, setChecked] = useState(!!isCurrentYear);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { refresh } = useRefresh();

  useEffect(() => {
    setChecked(!!isCurrentYear);
  }, [isCurrentYear]);

  const handleSwitchChange = (newChecked: boolean) => {
    setPendingValue(newChecked);
    setConfirmOpen(true);
  };

  const handleCancel = () => {
    setConfirmOpen(false);
    setPendingValue(null);
    setChecked(!!isCurrentYear);
  };

  const handleConfirm = async () => {
    if (pendingValue === null) return;

    setSaving(true);
    setChecked(pendingValue);

    try {
      const [, err] = await updateSchoolYearAction({
        id,
        nameYear,
        startYear,
        endYear,
        isCurrentYear: pendingValue,
      });

      if (err) {
        throw new Error(err.message);
      }

      refresh();
      toast.success("Année courante mise à jour");
      setConfirmOpen(false);
      setPendingValue(null);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Erreur lors de la mise à jour de l'année";
      toast.error(message);
      setChecked(!!isCurrentYear);
    } finally {
      setSaving(false);
    }
  };

  const activating = pendingValue === true;

  return (
    <>
      <Switch checked={checked} onCheckedChange={handleSwitchChange} />

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activating
                ? `Définir l'${labelLower} courante ?`
                : `Retirer l'${labelLower} courante ?`}
            </DialogTitle>
            <DialogDescription>
              {activating
                ? `Définir ${nameYear} comme ${labelLower} courante ? Les inscriptions, frais, enseignements, horaires et notes utiliseront cette année par défaut. L'année courante actuelle sera désactivée.`
                : `Retirer ${nameYear} comme ${labelLower} courante ? Aucune année ne sera marquée comme courante tant qu'une autre n'est pas sélectionnée.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={saving}>
              {saving ? "Enregistrement..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
