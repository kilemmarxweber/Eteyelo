"use client";

import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Contour primaire visible, comme le champ Montant du paiement. */
export const searchInputHighlightClassName =
  "border-2 border-primary ring-2 ring-primary/25 hover:border-primary hover:ring-primary/40 focus-visible:border-primary focus-visible:ring-primary/50";

export function SearchInput({
  autoFocus = true,
  className,
  ...props
}: InputProps) {
  return (
    <Input
      autoFocus={autoFocus}
      className={cn(searchInputHighlightClassName, className)}
      {...props}
    />
  );
}
