import { Layout, LayoutBody } from "@/components/custom/layout";
import AttendanceDashboard from "./component/AttendanceDashboard";
import AttendanceList from "./component/AttendanceList";

export default function AttendancePage() {
  return (
    <Layout>
      <LayoutBody className="bg-muted/20 p-6 space-y-6">
        <AttendanceDashboard />
        <AttendanceList />
      </LayoutBody>
    </Layout>
  );
}
