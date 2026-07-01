"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IStudent } from "@/src/interfaces/Student";

interface DetailsStudentDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  student: IStudent;
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value || "N/A"}</p>
    </div>
  );
}

export function DetailsStudentDialog({
  student,
  ...props
}: DetailsStudentDialogProps) {
  const studentName = [student.nom, student.postnom, student.prenom]
    .filter(Boolean)
    .join(" ");
  const parentName = [
    student.parent?.nom,
    student.parent?.postnom,
    student.parent?.prenom,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Dialog {...props}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Details de l'eleve</DialogTitle>
        </DialogHeader>

        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {studentName || "Eleve"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {student.username || "Code non defini"}
              </p>
            </div>
            <Badge variant="outline">{student.category || "NORMAL"}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Sexe" value={student.sexe} />
            <Field
              label="Date de naissance"
              value={
                student.dateOfBirth
                  ? new Date(student.dateOfBirth).toLocaleDateString("fr-FR")
                  : undefined
              }
            />
            <Field label="Telephone" value={student.telephone} />
            <Field label="Email" value={student.email} />
            <Field label="Adresse" value={student.address} />
            <Field label="Parent" value={parentName} />
            <Field label="Telephone parent" value={student.parent?.telephone} />
            <Field label="Email parent" value={student.parent?.email} />
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
