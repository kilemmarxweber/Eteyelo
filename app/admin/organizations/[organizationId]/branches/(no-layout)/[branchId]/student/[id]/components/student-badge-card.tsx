"use client";

import * as React from "react";
import JsBarcode from "jsbarcode";
import type { StudentBadgeData } from "@/lib/student-badge";
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { cn, normalizeImageSrc } from "@/lib/utils";
import Image from "next/image";
import type { StudentPhotoUploadState } from "./use-student-photo-upload";
import { Camera, Loader2 } from "lucide-react";

type StudentBadgeCardProps = {
  badge: StudentBadgeData;
  className?: string;
  preview?: boolean;
  upload?: StudentPhotoUploadState;
};

function shortClassName(className: string) {
  return className.replace(/\s*\([^)]*\)\s*$/, "").trim() || className;
}

function SideDecoration({ side }: { side: "left" | "right" }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-1/2 z-0 -translate-y-1/2",
        side === "left" ? "-left-1" : "-right-1 scale-x-[-1]",
      )}
    >
      <svg width="72" height="136" viewBox="0 0 72 136" fill="none" aria-hidden>
        <path
          d="M0 24 C16 18 28 8 44 0 H72 V34 C54 38 38 48 22 58 H0 V24 Z"
          fill="#dbeafe"
        />
        <path
          d="M0 52 C18 52 30 64 46 78 H72 V112 C52 112 34 122 18 132 H0 V52 Z"
          fill="#0b5cab"
        />
        <path
          d="M8 66 C22 66 34 74 48 84"
          stroke="#93c5fd"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function StudentBarcode({ value }: { value: string }) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const barcodeValue = value.trim() || "000000";

  React.useEffect(() => {
    if (!svgRef.current) return;

    try {
      JsBarcode(svgRef.current, barcodeValue, {
        format: "CODE128",
        width: 1.45,
        height: 56,
        displayValue: false,
        margin: 8,
        background: "#ffffff",
        lineColor: "#111827",
      });
    } catch {
      JsBarcode(svgRef.current, "000000", {
        format: "CODE128",
        width: 1.45,
        height: 56,
        displayValue: false,
        margin: 8,
        background: "#ffffff",
        lineColor: "#111827",
      });
    }
  }, [barcodeValue]);

  return (
    <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white px-1 py-1">
      <svg ref={svgRef} className="block h-[56px] w-full" />
    </div>
  );
}

export const StudentBadgeCard = React.forwardRef<
  HTMLDivElement,
  StudentBadgeCardProps
>(function StudentBadgeCard({ badge, className, preview = false, upload }, ref) {
  const photoSrc = upload?.photoUrl
    ? normalizeImageSrc(upload.photoUrl)
    : badge.img
      ? normalizeImageSrc(badge.img)
      : null;
  const initialBranchLogo = badge.branchLogo
    ? normalizeImageSrc(badge.branchLogo)
    : badge.organizationLogo
      ? normalizeImageSrc(badge.organizationLogo)
      : KLAMBOCORE_DEFAULT_IMAGE_PATH;
  const [branchLogoSrc, setBranchLogoSrc] = React.useState(initialBranchLogo);
  const [photoSrcState, setPhotoSrcState] = React.useState(photoSrc);

  React.useEffect(() => {
    setBranchLogoSrc(initialBranchLogo);
  }, [initialBranchLogo]);

  React.useEffect(() => {
    setPhotoSrcState(photoSrc);
  }, [photoSrc]);

  const lastLine = [badge.lastName, badge.postName].filter(Boolean).join(" ").trim();
  const classLabel = shortClassName(badge.className);
  const canAddPhoto = Boolean(upload?.canAddPhoto);
  const isUploading = Boolean(upload?.isUploading);

  const photoPlaceholder = (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 text-3xl font-bold text-[#0b5cab]">
      {badge.firstName?.[0]}
      {badge.lastName?.[0]}
    </div>
  );

  const photoFrameClassName =
    "relative z-10 h-[124px] w-[102px] overflow-hidden rounded-2xl border-[3px] border-white bg-slate-100 shadow-[0_8px_24px_rgba(15,23,42,0.18)] ring-1 ring-slate-200";

  return (
    <div
      ref={ref}
      data-student-badge-card
      className={cn(
        "relative mx-auto overflow-hidden rounded-[28px] border border-slate-200/90 bg-white text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.12)] ring-1 ring-slate-100",
        preview ? "w-full max-w-[260px]" : "w-[260px]",
        className,
      )}
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-[#0b5cab] via-[#1d7bd8] to-[#0b5cab]" />

      <div className="flex flex-col items-center px-6 pb-5 pt-5">
        <div className="relative mb-2 h-14 w-32">
          <Image
            src={branchLogoSrc}
            alt={badge.schoolName ?? "Logo"}
            fill
            unoptimized
            className="object-contain object-center"
            onError={() => {
              if (branchLogoSrc !== KLAMBOCORE_DEFAULT_IMAGE_PATH) {
                setBranchLogoSrc(KLAMBOCORE_DEFAULT_IMAGE_PATH);
              }
            }}
          />
        </div>

        {badge.schoolName ? (
          <p className="mb-2 max-w-full truncate text-center text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            {badge.schoolName}
          </p>
        ) : null}

        <h2 className="text-center text-[24px] font-extrabold tracking-[0.08em] text-[#0b5cab]">
          CARTE D&apos;ELEVE
        </h2>

        <div className="relative my-6 flex w-full justify-center px-8">
          <SideDecoration side="left" />
          <SideDecoration side="right" />

          <div className="relative z-10 h-[124px] w-[102px]">
            {canAddPhoto ? (
              <label
                htmlFor={upload?.fileInputId}
                className={cn(
                  photoFrameClassName,
                  "block cursor-pointer transition-transform hover:scale-[1.02]",
                  isUploading && "pointer-events-none opacity-70",
                )}
                title="Cliquer pour ajouter une photo"
                aria-label="Ajouter une photo"
              >
                {photoSrcState ? (
                  <Image
                    src={photoSrcState}
                    alt={badge.fullName}
                    fill
                    unoptimized
                    className="object-cover"
                    onError={() => setPhotoSrcState(null)}
                  />
                ) : (
                  photoPlaceholder
                )}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-[#0b5cab]/90 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {isUploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      <Camera className="size-3.5" />
                      Ajouter photo
                    </>
                  )}
                </span>
              </label>
            ) : (
              <div className={photoFrameClassName}>
                {photoSrcState ? (
                  <Image
                    src={photoSrcState}
                    alt={badge.fullName}
                    fill
                    unoptimized
                    className="object-cover"
                    onError={() => setPhotoSrcState(null)}
                  />
                ) : (
                  photoPlaceholder
                )}
              </div>
            )}
          </div>
        </div>

        <div className="w-full space-y-1.5 text-center">
          <p className="text-[16px] font-extrabold uppercase leading-tight tracking-[0.04em] text-slate-900">
            {lastLine || badge.fullName}
          </p>
          <p className="text-[16px] font-medium capitalize text-slate-700">
            {badge.firstName || "-"}
          </p>
          <div className="mx-auto mt-2 h-px w-16 bg-slate-200" />
          <p className="pt-1 text-[15px] font-bold text-slate-900">
            ID : <span className="font-mono tracking-wide">{badge.matricule}</span>
          </p>
          <p className="text-[15px] font-bold text-slate-900">Classe : {classLabel}</p>
        </div>

        <div className="mt-5 w-full">
          <StudentBarcode value={badge.matricule} />
        </div>
      </div>
    </div>
  );
});
