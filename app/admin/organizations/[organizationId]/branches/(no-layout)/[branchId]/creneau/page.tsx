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
import { CreneauUpForm } from "./components/creneau-form"; // Import du formulaire
import { Layout, LayoutBody } from "@/components/custom/layout";
import CreneauList from "./components/CreneausTable";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { Card } from "@/components/ui/card";

export default function Creneaus() {
  const [open, setOpen] = useState(false);
  const { refreshKey, refresh } = useRefresh(); // État pour gérer le rafraîchissement
  // Fonction de rappel pour rafraîchir la liste
  const handleCreneauAction = () => {
    refresh();
    setOpen(false);
  };

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl dark:text-white">
            Liste des vacations
          </h1>
        </div>
        <div className="p-1">
          <div className=" ">
            <div>
              <Dialog open={open} onOpenChange={setOpen}>
                {/* Bouton pour ouvrir le formulaire */}
                <DialogTrigger asChild>
                  <Button variant="default">Ajouter</Button>
                </DialogTrigger>
                <DialogContent /* className="sm:max-w-[725px]" */>
                  <DialogHeader>
                    <DialogTitle>Ajouter une vacation</DialogTitle>
                    <DialogDescription>
                      Apporter des modifications au vacation ici. Cliquez sur
                      Enregistrer lorsque vous êtes fait.
                    </DialogDescription>
                  </DialogHeader>

                  <div>
                    {/* Formulaire de création de creneau */}
                    <CreneauUpForm
                      mode="create"
                      onCreated={handleCreneauAction}
                    />
                  </div>
                  <div className="grid gap-4 py-4">
                    {/* Formulaire de création d'creneau */}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {/* Liste des créneaux horaire*/}
          <Card variant="default" className="mt-8 border p-1 md:p-6">
            <CreneauList key={refreshKey} />{" "}
            {/* Rafraîchissement de la liste */}
          </Card>
        </div>
      </LayoutBody>
    </Layout>
  );
}
