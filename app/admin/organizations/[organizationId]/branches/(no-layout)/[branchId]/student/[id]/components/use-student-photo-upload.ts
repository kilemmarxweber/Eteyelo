"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { MAX_IMAGE_UPLOAD_BYTES, uploadFile } from "@/lib/upload-file";
import { updateStudentPhotoAction } from "../../student.action";

export function normalizeStudentPhotoUrl(image: string | null | undefined) {
  const trimmed = image?.trim();
  return trimmed ? trimmed : null;
}

type UseStudentPhotoUploadOptions = {
  studentId: string;
  initialImage: string | null;
  canManageStudents: boolean;
};

export function useStudentPhotoUpload({
  studentId,
  initialImage,
  canManageStudents,
}: UseStudentPhotoUploadOptions) {
  const router = useRouter();
  const fileInputId = React.useId();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(
    normalizeStudentPhotoUrl(initialImage),
  );

  React.useEffect(() => {
    setPhotoUrl(normalizeStudentPhotoUrl(initialImage));
  }, [initialImage]);

  const canAddPhoto = canManageStudents && !photoUrl;

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

        const [result, err] = await updateStudentPhotoAction({
          studentId,
          imageUrl: uploaded.url,
        });

        if (err) {
          throw new Error(err.message);
        }

        if (!result?.ok) {
          throw new Error(result?.message ?? "Impossible d'enregistrer la photo.");
        }

        setPhotoUrl(uploaded.url);
        toast.success(result.message ?? "Photo enregistree avec succes.");
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Impossible d'ajouter la photo.";
        toast.error(message);
      } finally {
        setIsUploading(false);
      }
    },
    [router, studentId],
  );

  const handleFileChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) {
        void savePhoto(file);
      }
    },
    [savePhoto],
  );

  const openFilePicker = React.useCallback(() => {
    if (!canAddPhoto || isUploading) return;
    fileInputRef.current?.click();
  }, [canAddPhoto, isUploading]);

  const openCamera = React.useCallback(() => {
    if (!canAddPhoto || isUploading) return;
    setCameraOpen(true);
  }, [canAddPhoto, isUploading]);

  const handlePhotoError = React.useCallback(() => {
    setPhotoUrl(null);
  }, []);

  return {
    fileInputId,
    fileInputRef,
    cameraOpen,
    setCameraOpen,
    isUploading,
    photoUrl,
    canAddPhoto,
    savePhoto,
    handleFileChange,
    openFilePicker,
    openCamera,
    handlePhotoError,
  };
}

export type StudentPhotoUploadState = ReturnType<typeof useStudentPhotoUpload>;
