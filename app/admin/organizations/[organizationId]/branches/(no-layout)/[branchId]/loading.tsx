import { BranchLoadingFallback } from "@/components/branch-loading-fallback";

export default function BranchLoading() {
  return (
    <BranchLoadingFallback
      label="Chargement de l'établissement..."
      className="min-h-[calc(100vh-3.5rem)] md:min-h-screen"
    />
  );
}
