import { HomeNavbar } from "@/components/home-navbar";
import { NotFoundView } from "@/components/not-found-view";

export default function NotFoundPage() {
  return (
    <>
      <div className="bg-blue-950 text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-3 items-center gap-2 px-3 py-2 text-[10px] sm:px-6 sm:text-xs">
          <span className="text-left">🇨🇩 Marketing scolaire</span>
          <span className="text-center">🏫 Écoles, instituts & universités</span>
          <span className="text-right">📊 Résultats en ligne</span>
        </div>
      </div>
      <HomeNavbar />
      <NotFoundView />
    </>
  );
}
