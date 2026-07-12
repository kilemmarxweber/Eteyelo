"use client";

import { Button } from "@/components/custom/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PersonnelUpForm } from "./components/personnel-form";
import { Layout, LayoutBody } from "@/components/custom/layout";
import UserList from "./components/PersonnelsTable";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { IconUserPlus, IconUsers } from "@tabler/icons-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";

export default function Personnels() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);

  const handleUserAction = () => {
    setRefreshKey((prev) => prev + 1);
    setOpen(false); // 👈 UX important : ferme le dialog après création
  };

  return (
    <Layout>
      <LayoutBody className="space-y-2">
        <PageHeader
          title="Gestion des personnels"
          description="Gérer les informations des personnels administratifs et leurs contrats dans l'établissement"
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              Personnels
            </Badge>
          }
          actions={
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="default"
                  leftSection={<IconUserPlus size={16} />}
                >
                  Ajouter un personnel
                </Button>
              </DialogTrigger>

              <DialogContent size="lg">
                <DialogHeader>
                  <DialogTitle>Créer un personnel administratif</DialogTitle>
                  <DialogDescription>
                    Ajoutez un nouveau membre du personnel.
                  </DialogDescription>
                </DialogHeader>

                <PersonnelUpForm
                  mode="create"
                  onPersonnelCreated={handleUserAction}
                />
              </DialogContent>
            </Dialog>
          }
        />

        <Card
          variant="elevated"
          className="mt-0 border p-1 md:p-4 rounded-md shadow-sm"
        >
          <UserList key={refreshKey} refreshKey={refreshKey} />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
