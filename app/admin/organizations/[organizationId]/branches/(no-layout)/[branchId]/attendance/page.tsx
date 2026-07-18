import { Layout, LayoutBody } from "@/components/custom/layout";
import AttendanceDashboard from "./component/AttendanceDashboard";
import AttendanceList from "./component/AttendanceList";
import StudentAttendanceReport from "./component/StudentAttendanceReport";

export default function AttendancePage() {
  return (
    <Layout>
      <LayoutBody className="bg-muted/20 p-6 space-y-6">
        <AttendanceDashboard />
        <StudentAttendanceReport />
        <AttendanceList />
      </LayoutBody>
    </Layout>
  );
}
