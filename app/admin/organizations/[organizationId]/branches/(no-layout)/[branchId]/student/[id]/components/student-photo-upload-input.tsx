"use client";

import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
import type { StudentPhotoUploadState } from "./use-student-photo-upload";

type StudentPhotoUploadInputProps = {
  upload: StudentPhotoUploadState;
};

export function StudentPhotoUploadInput({ upload }: StudentPhotoUploadInputProps) {
  const {
    fileInputId,
    fileInputRef,
    cameraOpen,
    setCameraOpen,
    canAddPhoto,
    savePhoto,
    handleFileChange,
  } = upload;

  if (!canAddPhoto) return null;

  return (
    <>
      <input
        id={fileInputId}
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title="Photo eleve"
        onCapture={(file) => {
          void savePhoto(file);
        }}
      />
    </>
  );
}
