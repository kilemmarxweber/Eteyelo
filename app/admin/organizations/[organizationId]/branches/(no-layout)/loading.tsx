import { BranchLoadingFallback } from "@/components/branch-loading-fallback";

/** Liste / création / édition d’établissements. */
export default function BranchesSectionLoading() {
  return (
    <BranchLoadingFallback
      className="mx-auto max-w-5xl py-6"
      label="Chargement des établissements"
    />
  );
}
