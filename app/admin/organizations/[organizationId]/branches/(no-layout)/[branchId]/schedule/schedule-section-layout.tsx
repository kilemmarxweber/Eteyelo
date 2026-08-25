"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { IconReportMoney, IconSchool } from "@tabler/icons-react";

import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IClasse } from "@/src/interfaces/Classe";

import { OptionSidebar } from "./components/CourseSidebar";
import { getScheduleClasseByIdAction } from "./schedule.action";

export default function ScheduleSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [classe, setClasse] = useState<IClasse | null>(null);
  const params = useParams();
  const classeId = params?.classeId as string | undefined;

  useEffect(() => {
    if (!classeId) {
      setClasse(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const [rawClasses, err] = await getScheduleClasseByIdAction({
          id: classeId,
        });
        if (cancelled || err) return;
        setClasse(rawClasses[0] ?? null);
      } catch (error) {
        console.error(error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [classeId]);

  return (
    <BranchPageShell
      fixedHeight
      fadedBelow
      title={
        classeId
          ? `Horaire des cours${classe?.codeClasse ? ` - ${classe.codeClasse}` : ""}`
          : "Planifier horaire des cours"
      }
      badge={
        <Badge variant="outline-primary" icon={<IconReportMoney size={14} />}>
          Horaires
        </Badge>
      }
      contentClassName="flex min-h-0 flex-col"
    >
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col">
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b px-3 py-3">
              <IconSchool size={18} className="text-primary" />
              <h3 className="font-semibold text-foreground">Classes</h3>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <OptionSidebar />
            </div>
          </Card>
        </aside>
        <main className="min-h-0 min-w-0 overflow-hidden">
          <div className="h-full animate-fade-in">{children}</div>
        </main>
      </div>
    </BranchPageShell>
  );
}
