"use client";

import * as React from "react";
import Image from "next/image";

import { cn, normalizeImageSrc } from "@/lib/utils";

type StudentListPhotoCellProps = {
  image?: string | null;
  nom?: string | null;
  prenom?: string | null;
  fullName: string;
  className?: string;
};

function getStudentPhotoUrl(image?: string | null) {
  const trimmed = image?.trim();
  if (!trimmed) return null;
  return normalizeImageSrc(trimmed);
}

function getStudentInitials(nom?: string | null, prenom?: string | null) {
  return `${nom?.[0] ?? ""}${prenom?.[0] ?? ""}`.toUpperCase() || "EL";
}

export function StudentListPhotoCell({
  image,
  nom,
  prenom,
  fullName,
  className,
}: StudentListPhotoCellProps) {
  const [failed, setFailed] = React.useState(false);
  const photoUrl = getStudentPhotoUrl(image);
  const initials = getStudentInitials(nom, prenom);
  const showPhoto = Boolean(photoUrl) && !failed;

  React.useEffect(() => {
    setFailed(false);
  }, [photoUrl]);

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="relative flex size-11 items-center justify-center overflow-hidden rounded-full border border-border bg-blue-50 ring-2 ring-white">
        {showPhoto && photoUrl ? (
          <Image
            src={photoUrl}
            alt={fullName || "Eleve"}
            fill
            className="object-cover"
            sizes="44px"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="text-sm font-black text-primary">{initials}</span>
        )}
      </div>
    </div>
  );
}
