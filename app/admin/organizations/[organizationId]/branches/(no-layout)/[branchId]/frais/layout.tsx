"use client";
import { OptionSidebar } from "./components/fraisSidebar";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconReportMoney, IconSchool } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogTrigger } from "@/components/ui/dialog";
import { FraisUpForm } from "./[classeId]/components/frais-form";
import { Button } from "@/components/ui/button";
import { getClassesByIdAction } from "../classe/classe.action";
import { useEffect, useState } from "react";
import { IClasse } from "@/src/interfaces/Classe";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { useParams } from "next/navigation";
import { NotFoundView } from "@/components/not-found-view";
import { useSession } from "@/lib/auth-client";
import {
  canAccessTeachingArea,
  canManageOrganization,
} from "@/lib/auth/session-roles";
import Loading from "../loading";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FraisLayoutContent>{children}</FraisLayoutContent>;
}

function FraisLayoutContent({ children }: { children: React.ReactNode }) {
  const { refresh } = useRefresh();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const handleFraisAction = () => {
    refresh();
    setAddDialogOpen(false);
  };
  const { data: session, isPending } = useSession();
  const [classes, setClasses] = useState<IClasse | null>(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const classeId = params?.classeId as string;
  //const hasClasse = Boolean(classeId);
  useEffect(() => {
    if (!classeId) return;

    const fetchClasses = async () => {
      try {
        const [rawClasses, err] = await getClassesByIdAction({
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
  if (isPending) {
    return <Loading />;
  }

  if (!canAccessTeachingArea(session)) {
    return <NotFoundView />;
  }
  const canCreateFrais = canManageOrganization(session);
  return (
    <Layout fadedBelow fixedHeight>
      <LayoutBody className="flex flex-col space-y-6" fixedHeight>
        <PageHeader
          title={
            hasClasse
              ? `Frais - ${classes?.codeClasse || ""}`
              : "Gestion des frais scolaires"
          }
          description={
            hasClasse
              ? `Liste de Frais de la ${classes?.codeClasse || ""}`
              : "Gérer les frais scolaires par classe et suivre les paiements des élèves"
          }
          badge={
            <Badge
              variant="outline-primary"
              icon={<IconReportMoney size={14} />}
            >
              Finance
            </Badge>
          }
          actions={
            canCreateFrais && (
              <div className="flex flex-wrap items-center gap-2">
                {hasClasse && (
                  <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="default">Ajouter un frais</Button>
                    </DialogTrigger>
                    <DialogContent size="lg">
                      <DialogHeader>
                        <DialogTitle>Ajouter un frais</DialogTitle>
                        <DialogDescription>
                          Créez un nouveau frais scolaire pour la classe
                          sélectionnée.
                        </DialogDescription>
                      </DialogHeader>
                      <FraisUpForm
                        mode="create"
                        onCreated={handleFraisAction}
                        classeId={classeId}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            )
          }
        />

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="min-h-0">
            <Card
              variant="outline"
              padding="sm"
              className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border"
            >
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
                <IconSchool size={18} className="text-primary" />
                <h3 className="font-semibold text-foreground">Classes</h3>
              </div>
              <div className="min-h-0 flex-1">
                <OptionSidebar />
              </div>
            </Card>
          </aside>
          <main className="min-h-0 min-w-0 overflow-auto">
            <div className="animate-fade-in">{children}</div>
          </main>
        </div>
      </LayoutBody>
    </Layout>
  );
}
