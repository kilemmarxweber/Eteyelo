"use client";

import { useMemo } from "react";
import { ReportDataTable } from "@/components/reports/report-section";
import type { FinanceStudentDetail } from "@/lib/reports/org/finance";

type Props = {
  studentDetails: FinanceStudentDetail[];
  money: (value: number) => string;
};

export function FinanceStudentDetailsTable({ studentDetails, money }: Props) {
  const tableRows = useMemo(() => {
    const flat = studentDetails.flatMap((s) => {
      const classeLabel = `${s.classeCode} — ${s.classeName}`;
      if (s.fees.length === 0) {
        return [
          {
            matricule: s.matricule,
            nom: s.nom,
            postnom: s.postnom,
            prenom: s.prenom,
            classeLabel,
            annee: s.annee,
            nameFrais: "—",
            due: 0,
            paid: 0,
            reste: 0,
            studentId: s.studentId,
          },
        ];
      }
      return s.fees.map((f) => ({
        matricule: s.matricule,
        nom: s.nom,
        postnom: s.postnom,
        prenom: s.prenom,
        classeLabel,
        annee: s.annee,
        nameFrais: f.nameFrais,
        due: f.due,
        paid: f.paid,
        reste: f.reste,
        studentId: s.studentId,
      }));
    });

    const studentIds = new Set(flat.map((r) => r.studentId));
    const totals = {
      due: flat.reduce((s, r) => s + r.due, 0),
      paid: flat.reduce((s, r) => s + r.paid, 0),
      reste: flat.reduce((s, r) => s + r.reste, 0),
      count: studentIds.size,
    };

    return [
      ...flat.map((r) => [
        r.matricule,
        r.nom,
        r.postnom,
        r.prenom,
        r.classeLabel,
        r.annee,
        r.nameFrais,
        money(r.due),
        money(r.paid),
        money(r.reste),
      ]),
      [
        "",
        "",
        "",
        `TOTAUX (${totals.count} élève${totals.count > 1 ? "s" : ""})`,
        "",
        "",
        "",
        money(totals.due),
        money(totals.paid),
        money(totals.reste),
      ],
    ];
  }, [studentDetails, money]);

  return (
    <ReportDataTable
      title="Détails — Par élève (frais : dû / payé / reste)"
      columns={[
        "Matricule",
        "Nom",
        "Postnom",
        "Prénom",
        "Classe",
        "Année",
        "Frais",
        "Dû",
        "Payé",
        "Reste",
      ]}
      rows={tableRows}
    />
  );
}
