import { getAttendanceSessionById } from "../../attendance.action";
import SessionDetail from "../../component/SessionDetail";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const [session, error] = await getAttendanceSessionById({ id });

    if (error || !session) {
      return <div>Session introuvable</div>;
    }

    // Ne passer que des données plain (évite l'erreur RSC de sérialisation).
    const payload = JSON.parse(JSON.stringify(session));

    return <SessionDetail session={payload} />;
  } catch (error) {
    console.error("[attendance/session]", error);
    return <div>Impossible de charger cette session de présence.</div>;
  }
}
