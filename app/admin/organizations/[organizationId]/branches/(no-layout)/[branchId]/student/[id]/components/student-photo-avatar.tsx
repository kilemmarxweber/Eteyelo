"use client";

import * as React from "react";
import Image from "next/image";
import { Camera, Loader2 } from "lucide-react";

import { cn, normalizeImageSrc } from "@/lib/utils";
import type { StudentPhotoUploadState } from "./use-student-photo-upload";

type StudentPhotoAvatarProps = {
  fullName: string;
  initials: string;
  upload: StudentPhotoUploadState;
  className?: string;
};

export function StudentPhotoAvatar({
  fullName,
  initials,
  upload,
  className,
}: StudentPhotoAvatarProps) {
  const {
    fileInputId,
    isUploading,
    photoUrl,
    canAddPhoto,
    openCamera,
    handlePhotoError,
  } = upload;

  const avatarContent = photoUrl ? (
    <Image
      src={normalizeImageSrc(photoUrl)}
      alt={fullName}
      fill
      className="object-cover"
      onError={handlePhotoError}
    />
  ) : (
    <div className="flex h-full items-center justify-center text-base font-bold text-primary">
      {initials}
    </div>
  );

  return (
    <div className={cn("relative size-14 shrink-0", className)}>
      {canAddPhoto ? (
        <>
          <label
            htmlFor={fileInputId}
            className={cn(
              "relative block size-full cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-primary/40 bg-blue-50 outline-none transition-colors hover:border-primary hover:bg-blue-100 focus-within:ring-2 focus-within:ring-ring",
              isUploading && "pointer-events-none opacity-70",
            )}
            aria-label="Ajouter une photo"
            title="Cliquer pour ajouter une photo"
          >
            {avatarContent}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-primary/85 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">
              {isUploading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <>
                  <Camera className="size-3" />
                  Photo
                </>
              )}
            </span>
          </label>

          <button
            type="button"
            disabled={isUploading}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openCamera();
            }}
            className="absolute -bottom-1 -right-1 z-10 flex size-6 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            aria-label="Prendre une photo"
            title="Prendre une photo"
          >
            <Camera className="size-3" />
          </button>
        </>
      ) : (
        <div className="relative size-full overflow-hidden rounded-lg border-2 border-primary/20 bg-blue-50">
          {avatarContent}
        </div>
      )}
    </div>
  );
}
