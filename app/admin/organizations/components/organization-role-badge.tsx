"use client";

import { Badge } from "@/components/ui/badge";

export function OrganizationRoleBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      size="sm"
      shape="pill"
      className={className}
    >
      {label}
    </Badge>
  );
}
