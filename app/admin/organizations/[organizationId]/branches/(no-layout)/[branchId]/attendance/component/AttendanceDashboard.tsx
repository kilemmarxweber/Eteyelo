import { CalendarCheck, Users, UserX, Clock3 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { AttendanceBarChart } from "./attendance-chart";
import { AttendancePieChart } from "./attendance-pie-chart";
import { StatCard } from "./statCard";

export default function AttendanceDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Sessions"
          value={125}
          change="+23.5% comparé au mois passé"
          icon={CalendarCheck}
          bgColor="bg-orange-50"
          iconColor="bg-orange-100 text-orange-500 border-orange-200"
        />

        <StatCard
          title="Présents"
          value={98}
          change="+18.2% comparé au mois passé"
          icon={Users}
          bgColor="bg-emerald-50"
          iconColor="bg-emerald-100 text-emerald-500 border-emerald-200"
        />

        <StatCard
          title="Absents"
          value={18}
          change="-6.1% comparé au mois passé"
          icon={UserX}
          bgColor="bg-blue-50"
          iconColor="bg-blue-100 text-blue-500 border-blue-200"
        />

        <StatCard
          title="Retards"
          value={9}
          change="+3.4% comparé au mois passé"
          icon={Clock3}
          bgColor="bg-violet-50"
          iconColor="bg-violet-100 text-violet-500 border-violet-200"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 border-0 shadow-sm lg:col-span-2">
          <h3 className="mb-5 text-lg font-semibold">Analyse des présences</h3>

          <AttendanceBarChart />
        </Card>

        <Card className="p-6 border-0 shadow-sm">
          <h3 className="mb-5 text-lg font-semibold">Répartition</h3>

          <AttendancePieChart />
        </Card>
      </div>
    </div>
  );
}
