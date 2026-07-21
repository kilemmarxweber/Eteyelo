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
  requiresOptionForClass,
  requiresSectionForClass,
} from "@/lib/class-structure";
import {
  CTEB_SECTION_CODE,
  getOrganizedSectionOptionTree,
} from "@/lib/class-catalog";
import { normalizeBranchType } from "@/lib/academic-structure";
import type { ManagedBranchType } from "@/lib/academic-structure";
import {
  getPublicLevelFieldLabels,
  usesBranchAcademicTree,
} from "@/lib/public-establishment-labels";

export type BranchSectionOptionNode = {
  codeSection: string;
  nameSection: string;
  options: { codeOption: string; nameOption: string }[];
};

export type LevelSectionOptionValue = {
  level: string;
  sectionName: string;
  optionName: string;
};

type Props = {
  typebranch: ManagedBranchType | string;
  value: LevelSectionOptionValue;
  onChange: (next: LevelSectionOptionValue) => void;
  /** Sections / options configurées sur la branche (centre, université). */
  branchTree?: BranchSectionOptionNode[];
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
  branchTree,
  multiLevel = false,
  required = true,
}: Props) {
  const branchType = normalizeBranchType(typebranch);
  const primary = isPrimaryBranch(typebranch);
  const secondary = branchType === "SECONDAIRE";
  const usesBranchTree = usesBranchAcademicTree(branchType);
  const fieldLabels = getPublicLevelFieldLabels(branchType);
  const levels = getClassLevelsForBranch(typebranch);

  const showSection =
    (usesBranchTree && Boolean(value.level)) ||
    (secondary && requiresSectionForClass(typebranch, value.level));
  const showOption =
    !primary &&
    (usesBranchTree ||
      requiresOptionForClass(typebranch, value.level) ||
      (secondary && isCtebLevel(value.level)));

  const tree = useMemo(() => {
    if (usesBranchTree) {
      return branchTree ?? [];
    }
    if (primary) return [];
    if (isCtebLevel(value.level)) {
      return getOrganizedSectionOptionTree({
        includeCteb: true,
        includeFilieres: false,
      });
    }
    if (isHumanitesLevel(value.level)) {
      return getOrganizedSectionOptionTree({
        includeCteb: false,
        includeFilieres: true,
      });
    }
    if (branchType === "UNIVERSITE" || branchType === "CENTRE_FORMATION") {
      return getOrganizedSectionOptionTree({
        includeCteb: false,
        includeFilieres: true,
      });
    }
    return getOrganizedSectionOptionTree();
  }, [primary, value.level, branchType, usesBranchTree, branchTree]);

  const selectedSection = tree.find((s) => s.nameSection === value.sectionName);
  const options = selectedSection?.options ?? [];

  function setLevel(level: string) {
    if (primary) {
      onChange({ level, sectionName: "", optionName: "" });
      return;
    }
    if (secondary && isCtebLevel(level)) {
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
          {fieldLabels.level} {required ? "*" : ""}
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
        {secondary && isCtebLevel(value.level) ? (
          <p className="text-xs text-muted-foreground">
            7ᵉ / 8ᵉ année : Tronc commun (Éducation de Base CTEB).
          </p>
        ) : null}
      </div>

      {showSection ? (
        <div className="space-y-2">
          <Label>
            {fieldLabels.section} {required ? "*" : ""}
          </Label>
          <Select
            value={value.sectionName || undefined}
            onValueChange={(sectionName) =>
              onChange({ ...value, sectionName, optionName: "" })
            }
            disabled={!value.level || tree.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  tree.length === 0
                    ? `Aucun ${fieldLabels.section.toLowerCase()} disponible`
                    : `Choisir un ${fieldLabels.section.toLowerCase()}`
                }
              />
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
      ) : null}

      {showOption ? (
        <div className={`space-y-2 ${showSection ? "md:col-span-2" : ""}`}>
          <Label>
            {fieldLabels.option} {required ? "*" : ""}
          </Label>
          <Select
            value={value.optionName || undefined}
            onValueChange={(optionName) => onChange({ ...value, optionName })}
            disabled={
              (showSection && !value.sectionName) ||
              (secondary && isCtebLevel(value.level)) ||
              options.length === 0
            }
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  showSection && !value.sectionName
                    ? `Choisir d'abord un ${fieldLabels.section.toLowerCase()}`
                    : options.length === 0
                      ? `Aucun ${fieldLabels.option.toLowerCase()} disponible`
                      : `Choisir un ${fieldLabels.option.toLowerCase()}`
                }
              />
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
            tree.find((s) => s.codeSection === CTEB_SECTION_CODE)?.nameSection &&
          secondary &&
          isCtebLevel(value.level) ? (
            <p className="text-xs text-muted-foreground">
              Option Tronc commun appliquée automatiquement.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
