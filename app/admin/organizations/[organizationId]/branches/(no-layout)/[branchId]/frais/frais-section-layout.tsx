"use client";
import { OptionSidebar } from "./components/fraisSidebar";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconCopy, IconPlus, IconReportMoney, IconSchool, IconTrash } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FraisUpForm } from "./[classeId]/components/frais-form";
import { ReplicateFraisDialog } from "./[classeId]/components/replicate-Frais-dialog";
import { DeleteFraisAcrossClassesDialog } from "./[classeId]/components/delete-Frais-across-classes-dialog";
import { Button } from "@/components/custom/button";
import { getClassesByIdAction } from "../classe/classe.action";
import { useEffect, useState } from "react";
import { IClasse } from "@/src/interfaces/Classe";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { useParams } from "next/navigation";
import { NotFoundView } from "@/components/not-found-view";
import { useSession } from "@/lib/auth-client";
import { canAccessFinanceArea } from "@/lib/auth/session-roles";

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
  const [replicateDialogOpen, setReplicateDialogOpen] = useState(false);
  const [deleteAcrossDialogOpen, setDeleteAcrossDialogOpen] = useState(false);
  const handleFraisAction = () => {
    refresh();
    setAddDialogOpen(false);
  };
  const { data: session, isPending } = useSession();
  const [hasMounted, setHasMounted] = useState(false);
  const sessionReady = hasMounted && !isPending;
  const [classes, setClasses] = useState<IClasse | null>(null);
  const params = useParams();
  const classeId = params?.classeId as string;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!classeId) {
      setClasses(null);
      return;
    }

    const fetchClasses = async () => {
      try {
        const [rawClasses, err] = await getClassesByIdAction({
          id: classeId,
        });

        if (err) throw new Error("Failed");

        setClasses(rawClasses[0]);
      } catch (error) {
        console.error(error);
        setClasses(null);
      }
    };

    void fetchClasses();
  }, [classeId]);

  const hasClasse = !!classeId;

  if (sessionReady && !canAccessFinanceArea(session)) {
    return <NotFoundView />;
  }

  const canCreateFrais = canAccessFinanceArea(session);
  return (
    <Layout fadedBelow fixedHeight>
      <LayoutBody className="flex flex-col gap-0 pt-0 md:pt-0" fixedHeight>
        <PageHeader
          title={
            hasClasse
              ? `Frais - ${classes?.codeClasse || ""}`
              : "Gestion des frais scolaires"
          }
          description={
            hasClasse
              ? `Liste de frais de la ${classes?.codeClasse || ""}`
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
            canCreateFrais ? (
              <div className="flex flex-wrap items-center gap-2">
                {hasClasse ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      leftSection={<IconCopy size={16} />}
                      onClick={() => setReplicateDialogOpen(true)}
                    >
                      Reconduire
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      leftSection={<IconTrash size={16} />}
                      onClick={() => setDeleteAcrossDialogOpen(true)}
                    >
                      Supprimer
                    </Button>
                    <Sheet open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                      <SheetTrigger asChild>
                        <Button
                          size="sm"
                          variant="default"
                          leftSection={<IconPlus size={16} />}
                        >
                          Ajouter un frais
                        </Button>
                      </SheetTrigger>
                      <SheetContent
                        side="right"
                        className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
                      >
                        <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
                          <SheetTitle>Ajouter un frais</SheetTitle>
                          <SheetDescription>
                            Créez un nouveau frais scolaire pour{" "}
                            {classes?.nameClasse ||
                              classes?.codeClasse ||
                              "cette classe"}
                            .
                          </SheetDescription>
                        </SheetHeader>
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                          <FraisUpForm
                            mode="create"
                            layout="dialog"
                            onCreated={handleFraisAction}
                            classeId={classeId}
                          />
                        </div>
                      </SheetContent>
                    </Sheet>
                    <ReplicateFraisDialog
                      open={replicateDialogOpen}
                      onOpenChange={setReplicateDialogOpen}
                      sourceClasseId={classeId}
                      sourceClassLabel={
                        classes?.nameClasse || classes?.codeClasse
                      }
                    />
                    <DeleteFraisAcrossClassesDialog
                      open={deleteAcrossDialogOpen}
                      onOpenChange={setDeleteAcrossDialogOpen}
                      sourceClasseId={classeId}
                      sourceClassLabel={
                        classes?.nameClasse || classes?.codeClasse
                      }
                    />
                  </>
                ) : null}
              </div>
            ) : null
          }
        />

        <div className="grid min-h-0 flex-1 gap-4 pt-1 lg:grid-cols-[300px_minmax(0,1fr)]">
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
          <main className="min-h-0 min-w-0 overflow-auto">
            <div className="h-full animate-fade-in">{children}</div>
          </main>
        </div>
      </LayoutBody>
    </Layout>
  );
}
