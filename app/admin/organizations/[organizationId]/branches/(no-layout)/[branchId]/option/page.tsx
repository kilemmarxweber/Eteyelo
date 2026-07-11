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
import { OptionUpForm } from "./components/option-form"; // Import du formulaire
import { Layout, LayoutBody } from "@/components/custom/layout";
import OptionList from "./components/OptionsTable";
import { useRefresh } from "@/src/hooks/RefreshContext";

export default function Options() {
  const [open, setOpen] = useState(false);
  const { refreshKey, refresh } = useRefresh(); // État pour gérer le rafraîchissement
  // Fonction de rappel pour rafraîchir la liste
  const handleOptionAction = () => {
    refresh();
    setOpen(false);
  };

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl dark:text-white">
            Liste des options
          </h1>
        </div>
        <div className="p-1">
          <div className=" ">
            <div>
              <Dialog open={open} onOpenChange={setOpen}>
                {/* Bouton pour ouvrir le formulaire */}
                <DialogTrigger asChild>
                  <Button variant="default">Créer</Button>
                </DialogTrigger>
                <DialogContent /* className="sm:max-w-[725px]" */>
                  <DialogHeader>
                    <DialogTitle>Creer une option</DialogTitle>
                    <DialogDescription>
                      Apporter des modifications à l'option ici. Cliquez sur
                      Enregistrer lorsque vous êtes fait.
                    </DialogDescription>
                  </DialogHeader>

                  <div>
                    {/* Formulaire de création de option */}
                    <OptionUpForm
                      mode="create"
                      onCreated={handleOptionAction}
                    />
                  </div>
                  <div className="grid gap-4 py-4">
                    {/* Formulaire de création d'option */}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {/* Liste des options */}
          <div className="mt-8 border p-1 md:p-6">
            <OptionList refreshKey={String(refreshKey)} />
          </div>
        </div>
      </LayoutBody>
    </Layout>
  );
}
