"use client";
import { useState } from "react";
import { Button } from "@/components/custom/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CoursUpForm } from "./cours-form"; // Import du formulaire
import { Layout, LayoutBody } from "@/components/custom/layout";
import CoursList from "./coursTable";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { IconUsers } from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";

export default function Cours() {
  const [open, setOpen] = useState(false);
  const { refreshKey, refresh } = useRefresh(); // État pour gérer le rafraîchissement
  const { data: session } = useSession();
  const canCreate = canManageOrganization(session);
  // Fonction de rappel pour rafraîchir la liste
  const handleCoursAction = () => {
    refresh();
    setOpen(false);
  };

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <PageHeader
          title="Gestion des Cours"
          description="Gérer les informations des Cours et leurs contrats dans l'établissement"
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              Cours
            </Badge>
          }
          actions={
            <Dialog open={open} onOpenChange={setOpen}>
              {/* Bouton pour ouvrir le formulaire */}
              {canCreate && (
                <DialogTrigger asChild>
                  <Button variant="default">Ajouter un cours</Button>
                </DialogTrigger>
              )}
              <DialogContent /* className="sm:max-w-[725px]" */>
                <DialogHeader>
                  <DialogTitle>Creer un cours</DialogTitle>
                  <DialogDescription>
                    Apporter des modifications au cours ici. Cliquez sur
                    Enregistrer lorsque vous êtes fait.
                  </DialogDescription>
                </DialogHeader>

                <div>
                  {/* Formulaire de création de cours */}
                  <CoursUpForm
                    mode="create"
                    onCreated={handleCoursAction}
                  />
                </div>
                <div className="grid gap-4 py-4">
                  {/* Formulaire de création d'cours */}
                </div>
              </DialogContent>
            </Dialog>
          }
        />
        {/* Liste des cours */}
        <Card
          variant="elevated"
          className="mt-8 border rounded-md shadow-sm p-1 md:p-6"
        >
          <CoursList key={refreshKey} /> {/* Rafraîchissement de la liste */}
        </Card>
      </LayoutBody>
    </Layout>
  );
}
