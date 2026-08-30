"use client";

import * as React from "react";
import { Camera, Eye, ImageIcon, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MAX_IMAGE_UPLOAD_BYTES, uploadFile } from "@/lib/upload-file";
import { cn, normalizeImageSrc } from "@/lib/utils";
import { updateTeacherPhotoAction } from "../teacher.action";

type TeacherPhotoAvatarProps = {
  teacherId: string;
  fullName: string;
  initials: string;
  initialImage: string | null;
  canManage: boolean;
};

export function TeacherPhotoAvatar({
  teacherId,
  fullName,
  initials,
  initialImage,
  canManage,
}: TeacherPhotoAvatarProps) {
  const router = useRouter();
  const inputId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = React.useState(initialImage?.trim() || null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setPhotoUrl(initialImage?.trim() || null);
    setFailed(false);
  }, [initialImage]);

  const savePhoto = React.useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Choisissez une image (JPEG, PNG, WebP…).");
        return;
      }
      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        toast.error("Image trop volumineuse (max. 5 Mo).");
        return;
      }

      setIsUploading(true);
      try {
        const uploaded = await uploadFile(file);
        if (!uploaded.ok) {
          toast.error(uploaded.message);
          return;
        }
        const [result, error] = await updateTeacherPhotoAction({
          teacherId,
          imageUrl: uploaded.url,
        });
        if (error) throw new Error(error.message);
        if (!result?.ok) {
          throw new Error(result?.message ?? "Impossible d'enregistrer la photo.");
        }
        setPhotoUrl(uploaded.url);
        setFailed(false);
        toast.success(result.message);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Impossible d'enregistrer la photo.",
        );
      } finally {
        setIsUploading(false);
      }
    },
    [router, teacherId],
  );

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void savePhoto(file);
  }

  const src = photoUrl ? normalizeImageSrc(photoUrl) : null;
  const showPhoto = Boolean(src) && !failed;

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        disabled={!canManage || isUploading}
        onChange={handleFileChange}
      />
      <div className="relative shrink-0">
        <button
          type="button"
          className={cn(
            "relative block size-[4.75rem] overflow-hidden rounded-full border-2 border-background bg-primary/15 shadow-md",
            canManage && "cursor-pointer hover:ring-2 hover:ring-primary/50",
          )}
          onClick={() => {
            if (showPhoto) setPreviewOpen(true);
            else if (canManage) inputRef.current?.click();
          }}
          disabled={isUploading}
          aria-label={showPhoto ? "Voir la photo" : "Ajouter une photo"}
          title={showPhoto ? "Voir la photo" : "Ajouter une photo"}
        >
          {showPhoto && src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={fullName}
              className="size-full object-cover"
              onError={() => setFailed(true)}
            />
          ) : (
            <span className="flex size-full items-center justify-center text-lg font-semibold text-primary">
              {isUploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                initials
              )}
            </span>
          )}
        </button>

        {canManage ? (
          <label
            htmlFor={inputId}
            className="absolute -bottom-1 -right-1 z-10 flex size-7 cursor-pointer items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            aria-label="Modifier la photo"
            title="Modifier la photo"
          >
            <ImageIcon className="size-3.5" />
          </label>
        ) : null}
        {showPhoto ? (
          <button
            type="button"
            className="absolute -right-1 -top-1 z-10 flex size-6 items-center justify-center rounded-full border-2 border-card bg-background text-primary shadow-sm hover:bg-primary/10"
            onClick={() => setPreviewOpen(true)}
            aria-label="Agrandir la photo"
            title="Agrandir la photo"
          >
            <Eye className="size-3" />
          </button>
        ) : null}
        {canManage ? (
          <button
            type="button"
            disabled={isUploading}
            className="absolute -bottom-1 -left-1 z-10 flex size-6 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
            onClick={() => setCameraOpen(true)}
            aria-label="Prendre une photo"
            title="Prendre une photo"
          >
            <Camera className="size-3" />
          </button>
        ) : null}
      </div>

      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title="Photo de l'enseignant"
        onCapture={(file) => void savePhoto(file)}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent size="md" className="overflow-hidden p-2 sm:p-3">
          <DialogHeader className="sr-only">
            <DialogTitle>Photo de {fullName}</DialogTitle>
          </DialogHeader>
          {showPhoto && src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={fullName}
              className="max-h-[75vh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
