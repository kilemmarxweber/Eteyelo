"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
import { cn, normalizeImageSrc } from "@/lib/utils";

type MemberPhotoFieldProps = {
  previewUrl: string | null;
  onPickFile: (file: File) => void;
  disabled?: boolean;
  fullName?: string;
  className?: string;
};

function initialsFromName(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PH";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function MemberPhotoField({
  previewUrl,
  onPickFile,
  disabled = false,
  fullName,
  className,
}: MemberPhotoFieldProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [previewUrl]);

  const src = previewUrl?.trim()
    ? previewUrl.startsWith("blob:")
      ? previewUrl
      : normalizeImageSrc(previewUrl)
    : null;
  const showPhoto = Boolean(src) && !failed;
  const initials = initialsFromName(fullName);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPickFile(file);
  }

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <input
        id={fileInputId}
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        disabled={disabled}
        onChange={handleFileChange}
      />

      <div className="relative size-20 shrink-0">
        <label
          htmlFor={fileInputId}
          className={cn(
            "relative block size-full overflow-hidden rounded-xl border-2 border-dashed border-primary/40 bg-blue-50 outline-none transition-colors",
            disabled
              ? "cursor-not-allowed opacity-70"
              : "cursor-pointer hover:border-primary hover:bg-blue-100 focus-within:ring-2 focus-within:ring-ring",
          )}
          aria-label="Ajouter une photo"
          title="Cliquer pour ajouter une photo"
        >
          {showPhoto && src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={fullName || "Photo"}
              className="size-full object-cover"
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-base font-bold text-primary">
              {disabled ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                initials
              )}
            </div>
          )}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-primary/85 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">
            <Camera className="size-3" />
            Photo
          </span>
        </label>

        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setCameraOpen(true);
          }}
          className="absolute -bottom-1 -right-1 z-10 flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          aria-label="Prendre une photo"
          title="Prendre une photo"
        >
          <Camera className="size-3.5" />
        </button>
      </div>

      <div className="min-w-0 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Photo (facultatif)</p>
        <p className="mt-0.5 text-pretty leading-5">
          Cliquez sur le cadre ou l’icône appareil pour ajouter une photo, comme
          pour un élève.
        </p>
      </div>

      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title="Photo du membre"
        onCapture={(file) => {
          onPickFile(file);
        }}
      />
    </div>
  );
}
