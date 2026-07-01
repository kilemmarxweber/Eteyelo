import { auth } from "@/lib/auth";

import { redirect } from "next/navigation";
import ClientLayout from "./client-layout";
// import { startGradeCron } from "@/src/server/cron/gradeCron";
import AttendanceGuard from "./attendance/component/AttendanceGuard ";
import { headers } from "next/headers";
import { IdleLogout } from "@/lib/idle-logout";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  // startGradeCron();
  if (!session) {
    redirect("../auth/sign-in");
  }
  return (
    <ClientLayout>
      {" "}
      <IdleLogout />
      <AttendanceGuard />
      {children}
    </ClientLayout>
  );
}
