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
import { ParentUpForm } from "./components/parent-form";
import { Layout, LayoutBody } from "@/components/custom/layout";
import UserList from "./components/ParentsTable";
import { Badge } from "@/components/ui/badge";
import { IconUsers } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default function Parents() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const handleUserAction = () => {
    setRefreshKey((prev) => prev + 1);
    setOpen(false); // ✅ close dialog after submit
  };

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <PageHeader
          title="Gestion des Tuteurs"
          description="Gérer les informations des Tuteurs et leurs contrats dans l'établissement"
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              Tuteurs
            </Badge>
          }
          actions={
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="default">Ajouter un Tuteur</Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 rounded-2xl">
                {/* Header */}
                <DialogHeader className="p-6 pb-2">
                  <DialogTitle>Créer un parent</DialogTitle>
                  <DialogDescription>
                    Remplissez les informations du parent.
                  </DialogDescription>
                </DialogHeader>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                  <ParentUpForm
                    mode="create"
                    onCreated={handleUserAction}
                  />
                </div>
              </DialogContent>
            </Dialog>
          }
        />
        {/* Liste des parents */}
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
