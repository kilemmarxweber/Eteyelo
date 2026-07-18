import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/ui/back-link";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { IconClipboardText } from "@tabler/icons-react";
import {
  buildSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";
import FicheExportActions from "./FicheExportActions";
import CancelInterventionButton from "./CancelInterventionButton";

export const dynamic = "force-dynamic";

type Note = {
  studentId: string;
  nom: string;
  studentSurname: string;
  studentusername: string;
  studentSexe: string;
  score: number;
  maxScore: number;
};

export default async function FichePage({
  params,
}: {
  params: Promise<{
    organizationId: string;
    branchId: string;
    id: string;
  }>;
}) {
  const { organizationId, branchId, id } = await params;

  const [fiche, branch] = await Promise.all([
    prisma.fiche.findFirst({
      where: { id, branchId },
      include: {
        teacher: {
          include: {
            branchMember: {
              include: {
                member: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: schoolReportBranchSelect,
    }),
  ]);

  if (!fiche || !branch) return notFound();
  const teacherUser = fiche.teacher?.branchMember?.member?.user;
  const reportContext = buildSchoolReportContext(branch, {
    academicYearLabel: fiche.anneeName,
  });

  const validationHref = `/admin/organizations/${organizationId}/branches/${branchId}/ficheCentrales/${fiche.lessonId}?classId=${fiche.classSectionId}&periodId=${fiche.periodId}&anneeId=${fiche.anneeId}`;

  let notes: Note[] = [];

  try {
    notes =
      typeof fiche.notes === "string" ? JSON.parse(fiche.notes) : fiche.notes;
  } catch (error) {
    console.error("Erreur parsing notes JSON", error);
  }

  const meta = [
    { label: "Matière", value: fiche.coursName },
    { label: "Enseignant", value: teacherUser?.name || "N/A" },
    { label: "Classe", value: fiche.classeName },
    { label: "Année", value: fiche.anneeName },
    { label: "Type", value: fiche.typeFiche },
    {
      label: "Date",
      value: new Date(fiche.dateCreated).toLocaleDateString("fr-FR"),
    },
    { label: "Période", value: fiche.periodeName },
  ];

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <PageHeader
          variant="compact"
          title="Fiche de cotation"
          description={`${fiche.coursName} · ${fiche.periodeName}`}
          badge={
            <Badge
              variant="outline-primary"
              icon={<IconClipboardText size={14} />}
            >
              Fiche
            </Badge>
          }
          breadcrumbs={
            <BackLink href={validationHref} label="Validation de fiche" />
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <FicheExportActions
                ficheInfo={{
                  coursName: fiche.coursName,
                  teacher: teacherUser?.name || "N/A",
                  anneeName: fiche.anneeName,
                  typeFiche: fiche.typeFiche,
                  periodeName: fiche.periodeName,
                  classeName: fiche.classeName,
                  dateCreated: new Date(fiche.dateCreated).toLocaleDateString(
                    "fr-FR",
                  ),
                }}
                notes={notes}
                reportContext={reportContext}
              />
              <CancelInterventionButton
                ficheId={fiche.id}
                typeFiche={fiche.typeFiche}
                coursName={fiche.coursName}
              />
            </div>
          }
        />

        <Card
          variant="elevated"
          padding="none"
          className="animate-fade-in overflow-hidden rounded-lg border"
        >
          <div className="grid gap-x-6 gap-y-3 border-b bg-muted/20 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3 lg:px-5">
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
                <CardTitle className="text-base">Notes des élèves</CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Cotation pour {fiche.coursName}
                </p>
              </div>
              <Badge variant="outline" className="w-fit shrink-0">
                {`${notes.length} note${notes.length > 1 ? "s" : ""}`}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {notes.length === 0 ? (
              <div className="flex w-full min-h-[180px] flex-col items-center justify-center gap-2 border-t border-dashed px-6 py-10">
                <p className="max-w-7xl text-center text-sm leading-relaxed text-muted-foreground text-balance">
                  Aucune note disponible pour cette fiche.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left">
                      <th className="w-12 px-3 py-2 text-center font-medium">
                        #
                      </th>
                      <th className="px-3 py-2 font-medium">Nom</th>
                      <th className="px-3 py-2 font-medium">Prénom</th>
                      <th className="px-3 py-2 font-medium">Username</th>
                      <th className="px-3 py-2 font-medium">Sexe</th>
                      <th className="px-3 py-2 text-center font-medium">
                        Score
                      </th>
                      <th className="px-3 py-2 text-center font-medium">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notes.map((n, index) => (
                      <tr
                        key={n.studentId}
                        className="border-b last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-3 py-1.5 text-center text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="px-3 py-1.5 font-medium">{n.nom}</td>
                        <td className="px-3 py-1.5">{n.studentSurname}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {n.studentusername}
                        </td>
                        <td className="px-3 py-1.5">{n.studentSexe}</td>
                        <td className="px-3 py-1.5 text-center font-semibold tabular-nums">
                          {n.score}
                        </td>
                        <td className="px-3 py-1.5 text-center tabular-nums text-muted-foreground">
                          {n.maxScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </LayoutBody>
    </Layout>
  );
}
