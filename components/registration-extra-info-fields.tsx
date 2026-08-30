"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/paiement/components/MultiSelect";
import {
  FAMILY_EXTRA_FIELD_LABELS,
  REGISTRATION_LANGUAGE_OPTIONS,
  STUDENT_EXTRA_FIELD_LABELS,
  type FamilyExtraInfo,
  type StudentExtraInfo,
} from "@/lib/registration-extra-info";

type Props = {
  studentExtra: StudentExtraInfo;
  familyExtra: FamilyExtraInfo;
  onStudentChange: (key: keyof StudentExtraInfo, value: string) => void;
  onFamilyChange: (key: keyof FamilyExtraInfo, value: string) => void;
  /** Masquer le bloc famille (ex. centre de formation). */
  hideFamily?: boolean;
  /** Masquer le bloc élève (fiche parent). */
  hideStudent?: boolean;
  className?: string;
};

const STUDENT_TEXT_FIELDS = (
  Object.keys(STUDENT_EXTRA_FIELD_LABELS) as (keyof StudentExtraInfo)[]
).filter((key) => key !== "langue");

export function RegistrationExtraInfoFields({
  studentExtra,
  familyExtra,
  onStudentChange,
  onFamilyChange,
  hideFamily = false,
  hideStudent = false,
  className,
}: Props) {
  const langueValue = studentExtra.langue?.trim() ?? "";
  const selectedLanguages = langueValue
    ? langueValue
        .split(",")
        .map((language) => language.trim())
        .filter(Boolean)
    : [];

  const languageOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];

    for (const option of [
      ...REGISTRATION_LANGUAGE_OPTIONS,
      ...selectedLanguages,
    ]) {
      const key = option.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ value: option, label: option });
    }

    return options;
  }, [langueValue]);

  return (
    <div className={className ?? "space-y-5"}>
      {!hideStudent ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nationalité &amp; langue (élève)
          </p>
          <div className="grid grid-cols-1 gap-3">
            {STUDENT_TEXT_FIELDS.map((key) => (
              <div key={key} className="min-w-0 space-y-1.5">
                <Label className="text-xs">{STUDENT_EXTRA_FIELD_LABELS[key]}</Label>
                <Input
                  className="w-full max-w-full"
                  value={studentExtra[key] ?? ""}
                  onChange={(event) => onStudentChange(key, event.target.value)}
                  placeholder="Optionnel"
                />
              </div>
            ))}

            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs">{STUDENT_EXTRA_FIELD_LABELS.langue}</Label>
              <MultiSelect
                options={languageOptions}
                value={selectedLanguages}
                onValueChange={(next) =>
                  onStudentChange("langue", next.join(", "))
                }
                placeholder="Choisir une ou plusieurs langues"
                searchable
                maxCount={2}
                hideSelected
                selectedCountLabel={(count) =>
                  `${count} langue${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}`
                }
              />
            </div>
          </div>
        </div>
      ) : null}

      {!hideFamily ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Famille / origines (parent — partagé par tous les enfants)
          </p>
          <div className="grid grid-cols-1 gap-3">
            {(
              Object.keys(FAMILY_EXTRA_FIELD_LABELS) as (keyof FamilyExtraInfo)[]
            ).map((key) => (
              <div key={key} className="min-w-0 space-y-1.5">
                <Label className="text-xs">{FAMILY_EXTRA_FIELD_LABELS[key]}</Label>
                <Input
                  className="w-full max-w-full"
                  value={familyExtra[key] ?? ""}
                  onChange={(event) => onFamilyChange(key, event.target.value)}
                  placeholder="Optionnel"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
