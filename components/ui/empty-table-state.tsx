"use client";

import { Search, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyTableStateProps {
  message?: string;
  searchTerm?: string;
  onClearSearch?: () => void;
}

export function EmptyTableState({ 
  message = "Aucune donnée trouvée", 
  searchTerm = "",
  onClearSearch 
}: EmptyTableStateProps) {
  if (searchTerm) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          Aucun résultat trouvé
        </h3>
        <p className="text-muted-foreground mb-4">
          Aucune donnée ne correspond à votre recherche "{searchTerm}"
        </p>
        {onClearSearch && (
          <Button variant="outline" onClick={onClearSearch}>
            Effacer la recherche
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">
        {message}
      </h3>
      <p className="text-muted-foreground">
        Commencez par ajouter des données pour les voir apparaître ici.
      </p>
    </div>
  );
} 