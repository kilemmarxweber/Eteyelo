"use client";

import * as React from "react";
import JsBarcode from "jsbarcode";
import {
  getStaffBadgeTitle,
  type StaffBadgeData,
} from "@/lib/staff-badge";
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { cn, normalizeImageSrc } from "@/lib/utils";

type StaffBadgeCardProps = {
  badge: StaffBadgeData;
  className?: string;
  preview?: boolean;
};

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

function StaffBarcode({ value }: { value: string }) {
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

export const StaffBadgeCard = React.forwardRef<HTMLDivElement, StaffBadgeCardProps>(
  function StaffBadgeCard({ badge, className, preview = false }, ref) {
    const photoSrc = badge.img ? normalizeImageSrc(badge.img) : null;
    const initialBranchLogo = badge.branchLogo
      ? normalizeImageSrc(badge.branchLogo)
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
    const title = getStaffBadgeTitle(badge.kind);

    return (
      <div
        ref={ref}
        data-staff-badge-card
        className={cn(
          "relative mx-auto overflow-hidden rounded-[28px] border border-slate-200/90 bg-white text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.12)] ring-1 ring-slate-100",
          preview ? "w-full max-w-[260px]" : "w-[260px]",
          className,
        )}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0b5cab] via-[#1d7bd8] to-[#0b5cab]" />

        <div className="flex flex-col items-center px-6 pb-5 pt-5">
          <div className="relative mb-2 flex h-14 w-32 items-center justify-center">
            <img
              src={branchLogoSrc}
              alt={badge.schoolName ?? "Logo"}
              className="max-h-full max-w-full object-contain object-center"
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

          <h2 className="text-center text-[22px] font-extrabold tracking-[0.06em] text-[#0b5cab]">
            {title}
          </h2>

          <div className="relative my-6 flex w-full justify-center px-8">
            <SideDecoration side="left" />
            <SideDecoration side="right" />

            <div className="relative z-10 h-[124px] w-[102px] overflow-hidden rounded-2xl border-[3px] border-white bg-slate-100 shadow-[0_8px_24px_rgba(15,23,42,0.18)] ring-1 ring-slate-200">
              {photoSrcState ? (
                <img
                  src={photoSrcState}
                  alt={badge.fullName}
                  className="h-full w-full object-cover"
                  onError={() => setPhotoSrcState(null)}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 text-3xl font-bold text-[#0b5cab]">
                  {badge.firstName?.[0]}
                  {badge.lastName?.[0]}
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
            <p className="text-[15px] font-bold text-slate-900">
              {badge.roleLabel}
            </p>
          </div>

          <div className="mt-5 w-full">
            <StaffBarcode value={badge.matricule} />
          </div>
        </div>
      </div>
    );
  },
);
