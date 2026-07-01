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
import { SectionUpForm } from "./components/section-form"; // Import du formulaire
import { Layout, LayoutBody } from "@/components/custom/layout";
import SectionList from "./components/SectionsTable";
import { useRefresh } from "@/src/hooks/RefreshContext";

export default function Sections() {
  const { refreshKey, refresh } = useRefresh(); // État pour gérer le rafraîchissement
  // Fonction de rappel pour rafraîchir la liste
  const handleSectionAction = () => {
    refresh();
  };

  return (
    <Layout>
      <LayoutBody className="mb-0 space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl dark:text-white">
            Liste des sections
          </h1>
        </div>
        <div className="p-1 ">
          <div className=" ">
            <div>
              <Dialog>
                {/* Bouton pour ouvrir le formulaire */}
                <DialogTrigger asChild>
                  <Button variant="default">Créer</Button>
                </DialogTrigger>
                <DialogContent /* className="sm:max-w-[725px]" */>
                  <DialogHeader>
                    <DialogTitle>Creer un section</DialogTitle>
                    <DialogDescription>
                      Apporter des modifications au section ici. Cliquez sur
                      Enregistrer lorsque vous êtes fait.
                    </DialogDescription>
                  </DialogHeader>

                  <div>
                    {/* Formulaire de création de section */}
                    <SectionUpForm
                      mode="create"
                      onSectionAction={handleSectionAction}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {/* Liste des sections */}
          <div className="mt-4 border p-1 md:p-6  rounded-lg shadow-md">
            <SectionList key={refreshKey} />{" "}
            {/* Rafraîchissement de la liste */}
          </div>
        </div>
      </LayoutBody>
    </Layout>
  );
}
