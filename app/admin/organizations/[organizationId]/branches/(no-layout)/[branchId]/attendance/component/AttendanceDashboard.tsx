"use client";

import { CalendarCheck, Users, UserX, Clock3 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { AttendanceBarChart } from "./attendance-chart";
import { AttendancePieChart } from "./attendance-pie-chart";
import { StatCard } from "./statCard";

export default function AttendanceDashboard() {
  const t = useTranslations("attendance");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("stats.sessions")}
          value={125}
          change={t("stats.comparedLastMonth", { value: "23.5" })}
          icon={CalendarCheck}
          bgColor="bg-orange-50"
          iconColor="bg-orange-100 text-orange-500 border-orange-200"
        />

        <StatCard
          title={t("stats.present")}
          value={98}
          change={t("stats.comparedLastMonth", { value: "18.2" })}
          icon={Users}
          bgColor="bg-emerald-50"
          iconColor="bg-emerald-100 text-emerald-500 border-emerald-200"
        />

        <StatCard
          title={t("stats.absent")}
          value={18}
          change={t("stats.comparedLastMonth", { value: "6.1" })}
          icon={UserX}
          bgColor="bg-blue-50"
          iconColor="bg-blue-100 text-blue-500 border-blue-200"
        />

        <StatCard
          title={t("stats.late")}
          value={9}
          change={t("stats.comparedLastMonth", { value: "3.4" })}
          icon={Clock3}
          bgColor="bg-violet-50"
          iconColor="bg-violet-100 text-violet-500 border-violet-200"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 border-0 shadow-sm lg:col-span-2">
          <h3 className="mb-5 text-lg font-semibold">
            {t("dashboard.analysisTitle")}
          </h3>

          <AttendanceBarChart />
        </Card>

        <Card className="p-6 border-0 shadow-sm">
          <h3 className="mb-5 text-lg font-semibold">
            {t("dashboard.distributionTitle")}
          </h3>

          <AttendancePieChart />
        </Card>
      </div>
    </div>
  );
}
