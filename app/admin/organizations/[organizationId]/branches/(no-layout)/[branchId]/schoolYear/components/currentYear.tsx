"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { useRefresh } from "@/src/hooks/RefreshContext";

import { updateSchoolYearAction } from "../schoolYear.action";

export const CurrentYear: React.FC<ISchoolYear> = ({
  id,
  nameYear,
  startYear,
  endYear,
  isCurrentYear,
}) => {
  const [checked, setChecked] = useState(!!isCurrentYear);
  const { refresh } = useRefresh();

  useEffect(() => {
    setChecked(!!isCurrentYear);
  }, [isCurrentYear]);

  const handleSwitchChange = async (newChecked: boolean) => {
    const confirmed = window.confirm(
      newChecked
        ? `Definir ${nameYear} comme annee scolaire courante ?\n\nLes inscriptions, frais, enseignements, horaires et notes utiliseront cette annee par defaut. L'annee courante actuelle sera desactivee.`
        : `Retirer ${nameYear} comme annee scolaire courante ?\n\nAucune annee ne sera marquee comme courante tant qu'une autre n'est pas selectionnee.`,
    );

    if (!confirmed) {
      setChecked(!!isCurrentYear);
      return;
    }

    setChecked(newChecked);

    try {
      const [, err] = await updateSchoolYearAction({
        id,
        nameYear,
        startYear,
        endYear,
        isCurrentYear: newChecked,
      });

      if (err) {
        throw new Error(err.message);
      }

      refresh();
      toast.success("Annee courante mise a jour");
    } catch (error: any) {
      console.error("Erreur lors de la mise a jour de l'annee :", error);
      toast.error(error.message || "Erreur lors de la mise a jour de l'annee");
      setChecked(!!isCurrentYear);
    }
  };

  return <Switch checked={checked} onCheckedChange={handleSwitchChange} />;
};
