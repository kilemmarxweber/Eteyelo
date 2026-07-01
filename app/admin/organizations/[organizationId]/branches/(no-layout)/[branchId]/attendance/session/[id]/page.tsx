import { getAttendanceSessionById } from "../../attendance.action";
import SessionDetail from "../../component/SessionDetail";

export default async function Page({ params }: any) {
  const [session] = await getAttendanceSessionById({ id: params.id });

  if (!session) return <div>Session introuvable</div>;

  return <SessionDetail session={session} />;
}
