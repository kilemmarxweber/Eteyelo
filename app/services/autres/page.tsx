import type { Metadata } from "next";
import {
  Apple,
  ArrowRight,
  Download,
  Handshake,
  Layers3,
  MessageCircle,
  Smartphone,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";

import { HomeNavbar } from "@/components/home-navbar";
import { Button } from "@/components/ui/button";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { publicUploadPath } from "@/lib/upload-paths";
import { uploadedFileExists } from "@/lib/upload-file.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicPageMetadata({
  path: "/services/autres",
  title: "Autres services",
  description:
    "Projets sur mesure, partenariats et accompagnement pour vos besoins scolaires avec KlamboCore. Téléchargez l'application Klambo.",
});

const ANDROID_APK = "klambo.apk";
const IOS_IPA = "klambo.ipa";

const items = [
  {
    title: "Projet sur mesure",
    text: "Une idee particuliere, un besoin interne ou un service qui ne rentre pas dans une categorie classique.",
    icon: Sparkles,
  },
  {
    title: "Partenariat",
    text: "Collaboration avec Klambocore autour d'une ecole, d'une communaute, d'un service ou d'une initiative.",
    icon: Handshake,
  },
  {
    title: "Accompagnement",
    text: "Conseil, formation, organisation de processus et accompagnement de vos equipes.",
    icon: Layers3,
  },
];

type AppDownload = {
  id: "android" | "ios";
  title: string;
  fileName: string;
  description: string;
  available: boolean;
  downloadUrl: string;
  absoluteDownloadUrl: string;
  qrDataUrl: string | null;
};

async function buildAppDownload(
  id: AppDownload["id"],
  title: string,
  fileName: string,
  description: string,
): Promise<AppDownload> {
  const downloadUrl = publicUploadPath(fileName);
  const absoluteDownloadUrl = absoluteUrl(downloadUrl);
  const available = await uploadedFileExists(fileName);
  const qrDataUrl = available
    ? await QRCode.toDataURL(absoluteDownloadUrl, {
        margin: 1,
        width: 220,
        errorCorrectionLevel: "M",
      })
    : null;

  return {
    id,
    title,
    fileName,
    description,
    available,
    downloadUrl,
    absoluteDownloadUrl,
    qrDataUrl,
  };
}

export default async function OtherServicesPage() {
  const downloads = await Promise.all([
    buildAppDownload(
      "android",
      "Android",
      ANDROID_APK,
      "Installez Klambo sur votre telephone Android via le fichier APK.",
    ),
    buildAppDownload(
      "ios",
      "iOS",
      IOS_IPA,
      "Telechargez le package iOS Klambo pour installation autorisee.",
    ),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <HomeNavbar />

      <main className="mx-auto max-w-6xl px-4 py-14">
        <section className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-950/10 px-3 py-1.5 text-xs font-semibold text-blue-950">
            <MessageCircle className="size-4" />
            Autres besoins
          </div>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Parlons de votre besoin et construisons la bonne solution
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-base">
            Si votre demande est specifique, nous pouvons cadrer le besoin,
            proposer une approche simple et avancer avec votre equipe.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {items.map(({ icon: Icon, ...item }) => (
            <article key={item.title} className="rounded-2xl border bg-white p-5 shadow-sm">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-950 text-white">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-5 font-semibold text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.text}</p>
            </article>
          ))}
        </section>

        <section className="mt-14 rounded-3xl border bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-950/10 px-3 py-1.5 text-xs font-semibold text-blue-950">
                <Smartphone className="size-4" />
                Application mobile
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                Telecharger Klambo
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 md:text-base">
                Telechargez l&apos;application ou scannez le QR code avec votre
                telephone. Les fichiers sont servis depuis le dossier d&apos;uploads
                du serveur.
              </p>
            </div>
          </div>

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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={app.qrDataUrl}
                          alt={`QR code telechargement Klambo ${app.title}`}
                          width={180}
                          height={180}
                          className="size-[180px]"
                        />
                        <p className="mt-3 text-center text-xs text-slate-500">
                          Scannez pour telecharger
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

                  <div className="mt-5">
                    {app.available ? (
                      <Button
                        asChild
                        className="w-full rounded-full bg-blue-950 text-white hover:bg-blue-900"
                      >
                        <a href={app.downloadUrl} download={app.fileName}>
                          <Download className="mr-2 size-4" />
                          Telecharger {app.title}
                        </a>
                      </Button>
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
        </section>

        <Button asChild className="mt-10 rounded-full bg-blue-950 px-6 text-white hover:bg-blue-900">
          <Link href="/contact">
            Nous contacter
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </main>
    </div>
  );
}
