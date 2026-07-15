"use client";
import { IconReportMoney, IconSchool } from "@tabler/icons-react";
import { OptionSidebar } from "./components/CourseSidebar";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { useParams } from "next/navigation";
import { NotFoundView } from "@/components/not-found-view";
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
    return <NotFoundView />;
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
      </LayoutBody>
    </Layout>
  );
}
