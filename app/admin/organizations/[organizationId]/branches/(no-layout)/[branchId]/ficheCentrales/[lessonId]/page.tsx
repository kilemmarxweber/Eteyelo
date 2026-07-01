import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ValidateFicheButton from "./ValidateFicheButton";
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

  return (
    <div className="flex-1 p-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Voir et valider la fiche</CardTitle>
            <CardDescription>
              Calcul de la moyenne de toute la fiche par élève de la classe.
            </CardDescription>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {summary.ficheCoteId ? (
              <Button asChild variant="outline">
                <Link href={`${baseHref}/fiches/${summary.ficheCoteId}`}>
                  Voir la fiche globale
                </Link>
              </Button>
            ) : null}

            <ValidateFicheButton
              lessonId={lessonId}
              classId={classId}
              periodId={Number(periodId)}
              anneeId={anneeId}
              disabled={!summary.ficheCoteId}
              isValidated={summary.ficheCoteValidated}
            />
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div>
            <span className="font-medium">Classe :</span> {summary.className}
          </div>
          <div>
            <span className="font-medium">Cours :</span> {summary.subjectName}
          </div>
          <div>
            <span className="font-medium">Période :</span> {summary.periodName}
          </div>
          <div>
            <span className="font-medium">Année :</span> {summary.anneeName}
          </div>
          <div>
            <span className="font-medium">Interventions :</span>{" "}
            {summary.nombreIntervention}
          </div>
          <div>
            <span className="font-medium">Barème fiche globale :</span>{" "}
            {summary.ficheCoteMaxScore || "N/A"}
          </div>
          <div>
            <span className="font-medium">Fiche globale :</span>{" "}
            {summary.ficheCoteId ? "Disponible" : "Absente"}
          </div>
          <div>
            <span className="font-medium">État :</span>{" "}
            {summary.ficheCoteValidated ? "Déjà alimentée" : "À valider"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Moyennes par élève</CardTitle>
          <CardDescription>
            La colonne moyenne est celle qui sera reportée dans la fiche
            globale.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Nom</th>
                  <th className="px-3 py-2 text-left">Prénom</th>
                  <th className="px-3 py-2 text-left">Sexe</th>
                  <th className="px-3 py-2 text-right">Points</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">Moyenne</th>
                </tr>
              </thead>
              <tbody>
                {summary.students.map((student, index) => (
                  <tr
                    key={student.studentId}
                    className="border-b last:border-0"
                  >
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2 font-medium">{student.nom}</td>
                    <td className="px-3 py-2">{student.prenom}</td>
                    <td className="px-3 py-2">{student.sexe}</td>
                    <td className="px-3 py-2 text-right">
                      {student.totalPoints.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {student.totalMax.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {student.pourcentage.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {student.moyenne.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
