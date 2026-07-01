import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FicheExportActions from "./FicheExportActions";

/* ================= TYPES ================= */

type Note = {
  studentId: string;
  nom: string;
  studentSurname: string;
  studentusername: string;
  studentSexe: string;
  score: number;
  maxScore: number;
};

/* ================= PAGE ================= */

export default async function FichePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  /* ================= FETCH FICHE ================= */
  const fiche = await prisma.fiche.findUnique({
    where: { id },
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
  });

  if (!fiche) return notFound();
  const teacherUser = fiche.teacher?.branchMember?.member?.user;

  /* ================= PARSE NOTES JSON ================= */
  let notes: Note[] = [];

  try {
    notes =
      typeof fiche.notes === "string" ? JSON.parse(fiche.notes) : fiche.notes;
  } catch (error) {
    console.error("Erreur parsing notes JSON", error);
  }

  return (
    <div className="p-6 space-y-6">
      {/* ================= HEADER ================= */}
      <Card>
        <CardHeader>
          <div className="flex w-full items-center justify-between">
            {/* LEFT */}
            <CardTitle className="text-left">Fiche de cotation</CardTitle>

            {/* RIGHT */}
            <FicheExportActions
              ficheInfo={{
                coursName: fiche.coursName,
                teacher: teacherUser?.name || "N/A",
                anneeName: fiche.anneeName,
                typeFiche: fiche.typeFiche,
                periodeName: fiche.periodeName,
                dateCreated: new Date(fiche.dateCreated).toLocaleDateString(
                  "fr-FR",
                ),
              }}
              notes={notes}
            />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Matière :</span> {fiche.coursName}
          </div>
          <div>
            <span className="font-medium">Teacher :</span>{" "}
            {teacherUser?.name || "N/A"}
          </div>
          <div>
            <span className="font-medium">Année :</span> {fiche.anneeName}
          </div>
          <div>
            <span className="font-medium">Type :</span> {fiche.typeFiche}
          </div>
          <div>
            <span className="font-medium">Date :</span>{" "}
            {new Date(fiche.dateCreated).toLocaleDateString("fr-FR")}
          </div>
          <div>
            <span className="font-medium">Periode :</span> {fiche.periodeName}
          </div>
        </CardContent>
      </Card>

      {/* ================= NOTES TABLE ================= */}
      <Card>
        <CardHeader>
          <CardTitle>Notes des étudiants</CardTitle>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-muted-foreground">
              Aucune note disponible pour cette fiche.
            </p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted text-left">
                  <th className="border p-2 text-center w-12">#</th>
                  <th className="border p-2">Nom</th>
                  <th className="border p-2">Prénom</th>
                  <th className="border p-2">Username</th>
                  <th className="border p-2">Sexe</th>
                  <th className="border p-2 text-center">Score</th>
                  <th className="border p-2 text-center">Max</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((n, index) => (
                  <tr key={n.studentId} className="hover:bg-muted/50">
                    <td className="border p-2 text-center font-medium">
                      {index + 1}
                    </td>
                    <td className="border p-2">{n.nom}</td>
                    <td className="border p-2">{n.studentSurname}</td>
                    <td className="border p-2">{n.studentusername}</td>
                    <td className="border p-2">{n.studentSexe}</td>
                    <td className="border p-2 text-center font-medium">
                      {n.score}
                    </td>
                    <td className="border p-2 text-center">{n.maxScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
