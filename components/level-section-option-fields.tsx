"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getClassLevelLabel,
  getClassLevelsForBranch,
  isCtebLevel,
  isHumanitesLevel,
  isPrimaryBranch,
} from "@/lib/class-structure";
import {
  CTEB_SECTION_CODE,
  getOrganizedSectionOptionTree,
} from "@/lib/class-catalog";
import type { ManagedBranchType } from "@/lib/academic-structure";

export type LevelSectionOptionValue = {
  level: string;
  sectionName: string;
  optionName: string;
};

type Props = {
  typebranch: ManagedBranchType | string;
  value: LevelSectionOptionValue;
  onChange: (next: LevelSectionOptionValue) => void;
  /** Affiche plusieurs niveaux (candidature enseignant) — value.level peut être CSV. */
  multiLevel?: boolean;
  required?: boolean;
};

/**
 * Sélecteurs organisés Niveau → Section → Option selon le type de branche.
 */
export function LevelSectionOptionFields({
  typebranch,
  value,
  onChange,
  multiLevel = false,
  required = true,
}: Props) {
  const primary = isPrimaryBranch(typebranch);
  const levels = getClassLevelsForBranch(typebranch);

  const tree = useMemo(() => {
    if (primary) return [];
    if (isCtebLevel(value.level)) {
      return getOrganizedSectionOptionTree({
        includeCteb: true,
        includeFilieres: false,
      });
    }
    if (isHumanitesLevel(value.level) || !value.level) {
      return getOrganizedSectionOptionTree({
        includeCteb: false,
        includeFilieres: true,
      });
    }
    return getOrganizedSectionOptionTree();
  }, [primary, value.level]);

  const selectedSection = tree.find((s) => s.nameSection === value.sectionName);
  const options = selectedSection?.options ?? [];

  function setLevel(level: string) {
    if (primary) {
      onChange({ level, sectionName: "", optionName: "" });
      return;
    }
    if (isCtebLevel(level)) {
      const cteb = getOrganizedSectionOptionTree({
        includeCteb: true,
        includeFilieres: false,
      })[0];
      onChange({
        level,
        sectionName: cteb?.nameSection ?? "Éducation de Base (CTEB)",
        optionName: cteb?.options[0]?.nameOption ?? "Tronc commun",
      });
      return;
    }
    onChange({ level, sectionName: "", optionName: "" });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>
          Niveau {required ? "*" : ""}
        </Label>
        <Select
          value={value.level || undefined}
          onValueChange={setLevel}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choisir un niveau" />
          </SelectTrigger>
          <SelectContent>
            {levels.map((level) => (
              <SelectItem key={level} value={level}>
                {getClassLevelLabel(typebranch, level)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {multiLevel ? (
          <p className="text-xs text-muted-foreground">
            Indiquez le niveau principal ciblé (vous pouvez préciser d&apos;autres
            niveaux dans les matières).
          </p>
        ) : null}
      </div>

      {!primary && (
        <>
          <div className="space-y-2">
            <Label>Section (filière) {required ? "*" : ""}</Label>
            <Select
              value={value.sectionName || undefined}
              onValueChange={(sectionName) =>
                onChange({ ...value, sectionName, optionName: "" })
              }
              disabled={!value.level || isCtebLevel(value.level)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une section" />
              </SelectTrigger>
              <SelectContent>
                {tree.map((section) => (
                  <SelectItem
                    key={section.codeSection}
                    value={section.nameSection}
                  >
                    {section.nameSection}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Option {required ? "*" : ""}</Label>
            <Select
              value={value.optionName || undefined}
              onValueChange={(optionName) =>
                onChange({ ...value, optionName })
              }
              disabled={
                !value.sectionName ||
                isCtebLevel(value.level) ||
                options.length === 0
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une option" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.codeOption} value={option.nameOption}>
                    {option.nameOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {value.sectionName ===
              tree.find((s) => s.codeSection === CTEB_SECTION_CODE)
                ?.nameSection && (
              <p className="text-xs text-muted-foreground">
                7ᵉ / 8ᵉ année : Tronc commun (Éducation de Base CTEB).
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
