"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { updateSchoolYearAction } from "../schoolYear.action";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface CurrentYearProps extends ISchoolYear {
  refresh: () => void;
}

export const CurrentYear: React.FC<ISchoolYear> = ({
  id,
  nameYear,
  startYear,
  endYear,
  isCurrentYear,
}) => {
  const [checked, setChecked] = useState(!!isCurrentYear);
  const { refresh } = useRefresh();

  const handleSwitchChange = async (newChecked: boolean) => {
    setChecked(newChecked);

    try {
      await updateSchoolYearAction({
        id,
        nameYear,
        startYear,
        endYear,
        isCurrentYear: newChecked,
      });
      refresh();
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'année :", error);
    }
  };

  return <Switch checked={checked} onCheckedChange={handleSwitchChange} />;
};
