import { assertAttendanceSchoolReportsPage } from "@/lib/auth/data-scope";
import AttendanceList from "../component/AttendanceList";

export default async function AttendanceHistoryPage() {
  await assertAttendanceSchoolReportsPage();
  return <AttendanceList />;
}
