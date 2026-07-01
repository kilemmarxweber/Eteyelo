"use client";
import { IconReportMoney, IconSchool } from "@tabler/icons-react";
import { OptionSidebar } from "./components/CourseSidebar";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { redirect, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IClasse } from "@/src/interfaces/Classe";
import { useSession } from "@/lib/auth-client";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { Card } from "@/components/ui/card";
import { getScheduleClasseByIdAction } from "./schedule.action";
import { canReadScheduleArea } from "@/lib/auth/session-roles";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { refreshKey, refresh } = useRefresh(); // État pour gérer le rafraîchissement
  // Fonction de rappel pour rafraîchir la liste
  const handleFraisAction = () => {
    refresh();
  };

  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<IClasse | null>(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const classeId = params?.classeId as string;
  //const hasClasse = Boolean(classeId);
  const handleEnrollmentAction = () => {
    refresh();
    setOpen(false); // 🔥 fermeture du dialog ici
  };
  useEffect(() => {
    if (!classeId) return;

    const fetchClasses = async () => {
      try {
        const [rawClasses, err] = await getScheduleClasseByIdAction({
          id: classeId,
        });

        if (err) throw new Error("Failed");

        setClasses(rawClasses[0]);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchClasses();
  }, [classeId]);

  const hasClasse = !!classeId;
  if (isPending) return null;
  if (!canReadScheduleArea(session)) {
    redirect("/not-authorized");
  }
  return (
    <Layout fadedBelow fixedHeight>
      <LayoutBody className="flex flex-col space-y-6" fixedHeight>
        <PageHeader
          title={
            hasClasse
              ? ` Horaire des cours - ${classes?.codeClasse || ""}`
              : "Planifier horaire des cours"
          }
          badge={
            <Badge
              variant="outline-primary"
              icon={<IconReportMoney size={14} />}
            >
              Horaires
            </Badge>
          }
        />
        <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:gap-8">
          <aside className="lg:w-70 lg:flex-shrink-0">
            <Card
              variant="outline"
              padding="sm"
              className="sticky top-4 overflow-hidden rounded-md border"
            >
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
                <IconSchool size={18} className="text-primary" />
                <h3 className="font-semibold text-foreground">
                  Options - Classes
                </h3>
              </div>
              <OptionSidebar />
            </Card>
          </aside>
          <main className="flex-1 min-w-0">
            <div className="animate-fade-in">{children}</div>
          </main>
        </div>
      </LayoutBody>
    </Layout>
  );
}
