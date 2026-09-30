"use client";

import { useState } from "react";
import { Apple, Download, FileDown, Smartphone, ZoomIn } from "lucide-react";
import jsPDF from "jspdf";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type KlamboAppDownload = {
  id: "android" | "ios";
  title: string;
  fileName: string;
  description: string;
  available: boolean;
  downloadUrl: string;
  absoluteDownloadUrl: string;
  qrDataUrl: string | null;
};

function solutionTitle(app: KlamboAppDownload) {
  return `Klambo — ${app.title}`;
}

async function exportQrPdf(app: KlamboAppDownload) {
  if (!app.available) return;

  const qrPng = await QRCode.toDataURL(app.absoluteDownloadUrl, {
    margin: 2,
    width: 640,
    errorCorrectionLevel: "H",
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const title = solutionTitle(app);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(2, 6, 23);
  doc.text(title, pageW / 2, 36, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text("Scannez ce code QR pour telecharger l'application", pageW / 2, 48, {
    align: "center",
  });

  const qrSize = 110;
  const qrX = (pageW - qrSize) / 2;
  const qrY = (pageH - qrSize) / 2 - 8;
  doc.addImage(qrPng, "PNG", qrX, qrY, qrSize, qrSize);

  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(app.fileName, pageW / 2, qrY + qrSize + 14, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("klambocore.com", pageW / 2, pageH - 18, { align: "center" });

  doc.save(`klambo-qr-${app.id}.pdf`);
}

export function KlamboAppDownloadCards({
  downloads,
}: {
  downloads: KlamboAppDownload[];
}) {
  const [zoomed, setZoomed] = useState<KlamboAppDownload | null>(null);
  const [exportingIds, setExportingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  async function handleExportPdf(app: KlamboAppDownload) {
    setExportingIds((prev) => {
      const next = new Set(prev);
      next.add(app.id);
      return next;
    });
    try {
      await exportQrPdf(app);
    } finally {
      setExportingIds((prev) => {
        const next = new Set(prev);
        next.delete(app.id);
        return next;
      });
    }
  }

  function isExporting(id: string) {
    return exportingIds.has(id);
  }

  return (
    <>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {downloads.map((app) => {
          const Icon = app.id === "ios" ? Apple : Smartphone;

          return (
            <article
              key={app.id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-5"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-950 text-white">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-slate-950">{app.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {app.description}
                  </p>
                  <p className="mt-2 font-mono text-xs text-slate-500">
                    {app.fileName}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                {app.available && app.qrDataUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setZoomed(app)}
                      className="group relative rounded-xl p-2 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-950"
                      aria-label={`Agrandir le QR code ${app.title}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={app.qrDataUrl}
                        alt={`QR code telechargement Klambo ${app.title}`}
                        width={180}
                        height={180}
                        className="size-[180px]"
                      />
                      <span className="absolute inset-x-0 bottom-2 mx-auto flex w-fit items-center gap-1 rounded-full bg-blue-950/90 px-2.5 py-1 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                        <ZoomIn className="size-3" />
                        Agrandir
                      </span>
                    </button>
                    <p className="mt-3 text-center text-xs text-slate-500">
                      Cliquez pour agrandir · Scannez pour telecharger
                    </p>
                  </>
                ) : (
                  <p className="px-4 py-10 text-center text-sm text-slate-500">
                    Fichier non disponible pour le moment. Placez{" "}
                    <span className="font-mono text-slate-700">
                      {app.fileName}
                    </span>{" "}
                    dans le dossier UPLOAD_DIR.
                  </p>
                )}
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                {app.available ? (
                  <>
                    <Button
                      asChild
                      className="flex-1 rounded-full bg-blue-950 text-white hover:bg-blue-900"
                    >
                      <a href={app.downloadUrl} download={app.fileName}>
                        <Download className="mr-2 size-4" />
                        Telecharger {app.title}
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-full border-blue-950/20"
                      disabled={isExporting(app.id)}
                      onClick={() => void handleExportPdf(app)}
                    >
                      <FileDown className="mr-2 size-4" />
                      {isExporting(app.id) ? "PDF…" : "Exporter PDF"}
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled
                    className="w-full rounded-full bg-slate-300 text-slate-600"
                  >
                    Bientot disponible
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Dialog
        open={Boolean(zoomed)}
        onOpenChange={(open) => {
          if (!open) setZoomed(null);
        }}
      >
        <DialogContent size="md" className="sm:max-w-lg">
          {zoomed ? (
            <>
              <DialogHeader>
                <DialogTitle>{solutionTitle(zoomed)}</DialogTitle>
                <DialogDescription>
                  Scannez ce code QR pour telecharger l&apos;application{" "}
                  {zoomed.title}.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={zoomed.qrDataUrl ?? undefined}
                  alt={`QR code agrandi Klambo ${zoomed.title}`}
                  width={360}
                  height={360}
                  className="size-[min(72vw,360px)] rounded-xl bg-white p-3 shadow-sm"
                />
                <p className="font-mono text-xs text-slate-500">
                  {zoomed.fileName}
                </p>
                <Button
                  type="button"
                  className="rounded-full bg-blue-950 text-white hover:bg-blue-900"
                  disabled={isExporting(zoomed.id)}
                  onClick={() => void handleExportPdf(zoomed)}
                >
                  <FileDown className="mr-2 size-4" />
                  {isExporting(zoomed.id)
                    ? "Generation…"
                    : "Generer le PDF"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
