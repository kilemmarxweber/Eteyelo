import { getServerTranslator } from "@/lib/i18n-server";
import { getAttendanceSessionById } from "../../attendance.action";
import SessionDetail from "../../component/SessionDetail";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getServerTranslator("attendance");

  try {
    const [session, error] = await getAttendanceSessionById({ id });

    if (error || !session) {
      return <div>{t("history.empty")}</div>;
    }

    const payload = JSON.parse(JSON.stringify(session));

    return <SessionDetail session={payload} />;
  } catch (error) {
    console.error("[attendance/session]", error);
    return <div>{t("export.loadFailed")}</div>;
  }
}
