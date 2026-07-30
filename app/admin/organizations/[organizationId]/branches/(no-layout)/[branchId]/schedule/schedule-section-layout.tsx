"use client";

import { IconReportMoney, IconSchool } from "@tabler/icons-react";
import { OptionSidebar } from "./components/CourseSidebar";
import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { useParams } from "next/navigation";
import { NotFoundView } from "@/components/not-found-view";
import { useEffect, useState } from "react";
import { IClasse } from "@/src/interfaces/Classe";
import { useSession } from "@/lib/auth-client";
import { Card } from "@/components/ui/card";
import { getScheduleClasseByIdAction } from "./schedule.action";
import {
  canAccessTeachingArea,
  canReadScheduleArea,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const [classes, setClasses] = useState<IClasse | null>(null);
  const params = useParams();
  const classeId = params?.classeId as string | undefined;

  const isCursusReader =
    hasSessionRole(session, [
      ORG_ROLE.STUDENT,
      "STUDENT",
      "student",
      ORG_ROLE.PARENT,
      "PARENT",
      "parent",
    ]) && !canAccessTeachingArea(session);

  useEffect(() => {
    if (!classeId || isCursusReader) return;

    const fetchClasses = async () => {
      try {
        const [rawClasses, err] = await getScheduleClasseByIdAction({
          id: classeId,
        });

        if (err) throw new Error("Failed");

        setClasses(rawClasses[0]);
      } catch (error) {
        console.error(error);
      }
    };

    void fetchClasses();
  }, [classeId, isCursusReader]);

  const hasClasse = Boolean(classeId);

  if (isPending) return null;
  if (!canReadScheduleArea(session)) {
    return <NotFoundView />;
  }

  // Élève / parent : lecture année via page index (sans sidebar admin).
  if (isCursusReader) {
    return <>{children}</>;
  }

  return (
    <BranchPageShell
      fixedHeight
      fadedBelow
      title={
        hasClasse
          ? ` Horaire des cours - ${classes?.codeClasse || ""}`
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
