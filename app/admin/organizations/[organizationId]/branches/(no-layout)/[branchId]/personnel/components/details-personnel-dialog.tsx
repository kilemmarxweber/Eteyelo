"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { normalizeImageSrc } from "@/lib/utils";
import { IPersonnel } from "@/src/interfaces/Personnel";
import { PersonnelBadgePanel } from "./personnel-badge-panel";

interface DetailsPersonnelDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  personnel: IPersonnel;
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value || "N/A"}</p>
    </div>
  );
}

export function DetailsPersonnelDialog({
  personnel,
  ...props
}: DetailsPersonnelDialogProps) {
  const locale = useLocale();
  const t = useTranslations("users.staff.table");
  const tStaff = useTranslations("users.staff");
  const tPerson = useTranslations("common.person");
  const tCommon = useTranslations("common");

  const fullName = [personnel.nom, personnel.postnom, personnel.prenom]
    .filter(Boolean)
    .join(" ");

  const sexeLabel =
    personnel.sexe === "M"
      ? tPerson("male")
      : personnel.sexe === "F"
        ? tPerson("female")
        : personnel.sexe;

  return (
    <Dialog {...props}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{t("detailsTitle")}</DialogTitle>
        </DialogHeader>

        <Card className="space-y-4 border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-14 shrink-0">
                {personnel.image ? (
                  <AvatarImage
                    src={normalizeImageSrc(personnel.image)}
                    alt={fullName || tStaff("badge")}
                  />
                ) : null}
                <AvatarFallback>
                  {`${personnel.nom?.[0] ?? ""}${personnel.prenom?.[0] ?? ""}`.toUpperCase() ||
                    "PE"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">
                  {fullName || tStaff("badge")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {personnel.username || t("codeUndefined")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {personnel.role ? (
                <Badge variant="outline">{orgRoleLabel(personnel.role)}</Badge>
              ) : null}
              <Badge variant="secondary">
                {personnel.statusPersonnal
                  ? tCommon("active")
                  : tCommon("inactive")}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label={tPerson("gender")} value={sexeLabel} />
            <Field
              label={t("assignmentDate")}
              value={
                personnel.dateOfBirth
                  ? new Date(personnel.dateOfBirth).toLocaleDateString(locale)
                  : undefined
              }
            />
            <Field label={tPerson("phone")} value={personnel.telephone} />
            <Field label={tPerson("email")} value={personnel.email} />
            <Field label={tPerson("address")} value={personnel.address} />
            <Field
              label={t("role")}
              value={
                personnel.role
                  ? orgRoleLabel(personnel.role)
                  : t("roleUndefined")
              }
            />
          </div>

          <PersonnelBadgePanel
            personnelId={personnel.personnelId}
            open={Boolean(props.open)}
          />
        </Card>
      </DialogContent>
    </Dialog>
  );
}
