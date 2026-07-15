import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconClipboardCheck } from "@tabler/icons-react";
import ValidateFicheButton from "./ValidateFicheButton";
import CancelFicheButton from "./CancelFicheButton";
import InterventionsDetailButton from "./InterventionsDetailButton";
import { getFicheCentraleSummary } from "../fichecentrale.action";

export default async function FicheCentraleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{
    organizationId: string;
    branchId: string;
    lessonId: string;
  }>;
  searchParams: Promise<{
    classId?: string;
    periodId?: string;
    anneeId?: string;
  }>;
}) {
  const { organizationId, branchId, lessonId } = await params;
  const { classId, periodId, anneeId } = await searchParams;
  const baseHref = `/admin/organizations/${organizationId}/branches/${branchId}`;
  const listHref = `${baseHref}/ficheCentrales`;

  if (!classId || !periodId || !anneeId) {
    return notFound();
  }

  const summary = await getFicheCentraleSummary({
    lessonId,
    classId,
    periodId: Number(periodId),
    anneeId,
  });

  if (!summary) {
    return notFound();
  }

  const meta = [
    { label: "Classe", value: summary.className },
    { label: "Cours", value: summary.subjectName },
    { label: "Période", value: summary.periodName },
    { label: "Année", value: summary.anneeName },
    {
      label: "Interventions",
      value: String(summary.nombreIntervention),
    },
    {
      label: "Barème",
      value: summary.ficheCoteMaxScore
        ? String(summary.ficheCoteMaxScore)
        : "N/A",
    },
    {
      label: "Fiche globale",
      value: summary.ficheCoteId ? "Disponible" : "Absente",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        variant="compact"
        title="Validation de fiche"
        description={`${summary.subjectName} · ${summary.className} · ${summary.periodName}`}
        badge={
          <Badge
            variant="outline-primary"
            icon={<IconClipboardCheck size={14} />}
          >
            Centrale
          </Badge>
        }
        breadcrumbs={
          <BackLink href={listHref} label="Fiches centrales" />
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {summary.ficheCoteValidated ? (
              <StatusBadge status="active" label="Déjà alimentée" />
            ) : (
              <StatusBadge status="pending" label="À valider" />
            )}

            {summary.nombreIntervention !== 1 ? (
              <InterventionsDetailButton
                interventions={summary.interventions}
                baseHref={baseHref}
              />
            ) : null}

            {summary.ficheCoteId ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`${baseHref}/fiches/${summary.ficheCoteId}`}>
                  Voir la fiche globale
                </Link>
              </Button>
            ) : null}

            <CancelFicheButton
              lessonId={lessonId}
              classId={classId}
              periodId={Number(periodId)}
              anneeId={anneeId}
              nombreIntervention={summary.nombreIntervention}
              isValidated={summary.ficheCoteValidated}
              listHref={listHref}
            />

            <ValidateFicheButton
              lessonId={lessonId}
              classId={classId}
              periodId={Number(periodId)}
              anneeId={anneeId}
              disabled={!summary.ficheCoteId}
              isValidated={summary.ficheCoteValidated}
            />
          </div>
        }
      />

      <Card
        variant="elevated"
        padding="none"
        className="animate-fade-in overflow-hidden rounded-lg border"
      >
        <div className="grid gap-x-6 gap-y-3 border-b bg-muted/20 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4 lg:px-5">
          {meta.map((item) => (
            <div key={item.label} className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p
                className="mt-0.5 truncate text-sm font-semibold"
                title={item.value}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <CardHeader className="space-y-0 border-b bg-muted/10 px-4 py-3 lg:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">Moyennes par élève</CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Reportées dans la fiche globale à la validation
              </p>
            </div>
            <Badge variant="outline" className="w-fit shrink-0">
              {`${summary.students.length} élève${summary.students.length > 1 ? "s" : ""}`}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {summary.students.length === 0 ? (
            <div className="flex w-full min-h-[180px] flex-col items-center justify-center gap-2 border-t border-dashed px-6 py-10">
              <p className="max-w-7xl text-center text-sm leading-relaxed text-muted-foreground text-balance">
                Aucun élève pour cette fiche.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left">
                    <th className="w-12 px-3 py-2 text-center font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Nom</th>
                    <th className="px-3 py-2 font-medium">Prénom</th>
                    <th className="px-3 py-2 font-medium">Sexe</th>
                    <th className="px-3 py-2 text-right font-medium">Points</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">%</th>
                    <th className="px-3 py-2 text-right font-medium">Moyenne</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.students.map((student, index) => (
                    <tr
                      key={student.studentId}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-1.5 text-center text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="px-3 py-1.5 font-medium">{student.nom}</td>
                      <td className="px-3 py-1.5">{student.prenom}</td>
                      <td className="px-3 py-1.5">{student.sexe}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {student.totalPoints.toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {student.totalMax.toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {student.pourcentage.toFixed(2)}%
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                        {student.moyenne.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
