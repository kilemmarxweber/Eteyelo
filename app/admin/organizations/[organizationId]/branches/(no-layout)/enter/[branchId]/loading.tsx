import { BranchLoadingFallback } from "@/components/branch-loading-fallback";

export default function EnterBranchLoading() {
  return (
    <BranchLoadingFallback
      label="Ouverture de l'établissement..."
      className="min-h-screen"
    />
  );
}
