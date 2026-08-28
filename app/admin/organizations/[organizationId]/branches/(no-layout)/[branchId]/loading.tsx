import { BranchLoadingFallback } from "@/components/branch-loading-fallback";

/**
 * Fallback Next.js pendant la navigation RSC dans une branche.
 * L’overlay RouteChangeLoader (client-layout) couvre le clic / push ;
 * ce fichier évite un écran blanc dans la zone contenu.
 */
export default function BranchLoading() {
  return <BranchLoadingFallback label="Chargement" />;
}
