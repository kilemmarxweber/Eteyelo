"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { BranchPageShell } from "@/components/layout/branch-page-shell";
import TeacherAttendanceReport from "../attendance/component/TeacherAttendanceReport";
import PersonnelAttendanceReport from "../attendance/component/PersonnelAttendanceReport";
import { MyPresenceSection } from "../dashboard-presence-section";
import { getMyDashboardPresenceAction } from "../dashboard-presence.action";
import SalaryAdvanceRequestCard from "./salary-advance-request-card";

export default function MyPresencePage() {
  const t = useTranslations("dashboard.presence");
  const [showTeacher, setShowTeacher] = useState(false);
  const [showPersonnel, setShowPersonnel] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const [data] = await getMyDashboardPresenceAction();
      setShowTeacher(Boolean(data?.teacher));
      setShowPersonnel(Boolean(data?.personnel));
      setLoaded(true);
    })();
  }, []);

  return (
    <BranchPageShell
      title={t("pageTitle")}
      description={t("pageDescription")}
      contentClassName="space-y-6"
    >
      <MyPresenceSection />
      <SalaryAdvanceRequestCard />
      {showTeacher ? <TeacherAttendanceReport selfOnly /> : null}
      {showPersonnel ? <PersonnelAttendanceReport selfOnly /> : null}
      {loaded && !showTeacher && !showPersonnel ? (
        <p className="text-sm text-muted-foreground">{t("noProfile")}</p>
      ) : null}
    </BranchPageShell>
  );
}
