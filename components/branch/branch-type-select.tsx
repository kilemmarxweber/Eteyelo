"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BRANCH_TYPES, type ManagedBranchType } from "@/lib/academic-structure";
import { getBranchTypeLabel } from "@/lib/branch-capabilities";

const BRANCH_TYPE_LABELS: Record<ManagedBranchType, string> = {
  PRIMAIRE: "Primaire",
  SECONDAIRE: "Secondaire",
  ATELIER: "Atelier",
  CENTRE_FORMATION: "Centre de formation",
  UNIVERSITE: "Universite",
};

type BranchTypeSelectProps = {
  value: ManagedBranchType;
  onValueChange: (value: ManagedBranchType) => void;
  disabled?: boolean;
  className?: string;
};

export function BranchTypeSelect({
  value,
  onValueChange,
  disabled,
  className,
}: BranchTypeSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange(next as ManagedBranchType)}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? "h-9 rounded-xl"}>
        <SelectValue placeholder="Selectionner le type" />
      </SelectTrigger>
      <SelectContent>
        {BRANCH_TYPES.map((type) => (
          <SelectItem key={type} value={type}>
            {BRANCH_TYPE_LABELS[type] ?? getBranchTypeLabel(type)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { BRANCH_TYPE_LABELS };
