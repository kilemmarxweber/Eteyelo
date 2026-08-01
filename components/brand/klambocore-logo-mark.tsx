import Image from "next/image";

import { KLAMBOCORE_LOGO_TRANSPARENT_PATH } from "@/lib/brand/klambocore-image";
import { cn } from "@/lib/utils";

type KlambocoreLogoMarkProps = {
  className?: string;
  /** Affiche le K uniquement (masque le texte KLAMBOCORE / SARL en bas). */
  priority?: boolean;
};

/**
 * Marque Klambocore : crop sur la lettre K, PNG à fond transparent.
 */
export function KlambocoreLogoMark({
  className,
  priority = false,
}: KlambocoreLogoMarkProps) {
  return (
    <span
      className={cn(
        "relative inline-block h-11 w-11 shrink-0 overflow-hidden sm:h-12 sm:w-12",
        className,
      )}
      aria-hidden
    >
      <Image
        src={KLAMBOCORE_LOGO_TRANSPARENT_PATH}
        alt=""
        width={704}
        height={527}
        priority={priority}
        className="pointer-events-none absolute left-1/2 top-0 h-[165%] w-auto max-w-none -translate-x-1/2 select-none"
      />
    </span>
  );
}
