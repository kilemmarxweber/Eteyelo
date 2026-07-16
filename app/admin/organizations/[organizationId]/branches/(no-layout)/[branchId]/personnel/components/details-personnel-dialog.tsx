"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { IPersonnel } from "@/src/interfaces/Personnel";

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
  const fullName = [personnel.nom, personnel.postnom, personnel.prenom]
    .filter(Boolean)
    .join(" ");

  const sexeLabel =
    personnel.sexe === "M"
      ? "Masculin"
      : personnel.sexe === "F"
        ? "Féminin"
        : personnel.sexe;

  return (
    <Dialog {...props}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Détails du personnel</DialogTitle>
        </DialogHeader>

        <Card className="space-y-4 border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {fullName || "Personnel"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {personnel.username || "Code non défini"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {personnel.role ? (
                <Badge variant="outline">{orgRoleLabel(personnel.role)}</Badge>
              ) : null}
              <Badge variant="secondary">
                {personnel.statusPersonnal ? "Actif" : "Inactif"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Sexe" value={sexeLabel} />
            <Field
              label="Date d'affectation"
              value={
                personnel.dateOfBirth
                  ? new Date(personnel.dateOfBirth).toLocaleDateString("fr-FR")
                  : undefined
              }
            />
            <Field label="Téléphone" value={personnel.telephone} />
            <Field label="Email" value={personnel.email} />
            <Field label="Adresse" value={personnel.address} />
            <Field
              label="Rôle"
              value={
                personnel.role ? orgRoleLabel(personnel.role) : "Non défini"
              }
            />
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
