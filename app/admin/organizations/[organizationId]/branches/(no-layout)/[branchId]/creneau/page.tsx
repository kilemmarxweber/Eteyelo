"use client";

import { useState } from "react";
import { IconBeach, IconPlus } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreneauUpForm } from "./components/creneau-form";
import { Layout, LayoutBody } from "@/components/custom/layout";
import CreneauList from "./components/CreneausTable";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

export default function Creneaus() {
  const [open, setOpen] = useState(false);
  const { refreshKey, refresh } = useRefresh();

  const handleCreneauAction = () => {
    refresh();
    setOpen(false);
  };

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <PageHeader
          title="Vacations"
          description="Configurez les périodes et la récréation (ex. 3 cours avant / 3 après au secondaire)."
          badge={
            <Badge variant="outline-primary" icon={<IconBeach size={14} />}>
              Vacations
            </Badge>
          }
          actions={
            <Button type="button" variant="default" onClick={() => setOpen(true)}>
              <IconPlus size={16} className="mr-2" />
              Ajouter une vacation
            </Button>
          }
        />

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Nouvelle vacation</DialogTitle>
              <DialogDescription>
                Utilisez un modèle secondaire ou primaire, puis ajustez les
                horaires si besoin.
              </DialogDescription>
            </DialogHeader>

            <CreneauUpForm
              key={open ? "creneau-create-open" : "creneau-create-closed"}
              mode="create"
              onCreated={handleCreneauAction}
            />
          </DialogContent>
        </Dialog>

        <Card variant="default" className="border p-1 md:p-6">
          <CreneauList refreshKey={String(refreshKey)} />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
