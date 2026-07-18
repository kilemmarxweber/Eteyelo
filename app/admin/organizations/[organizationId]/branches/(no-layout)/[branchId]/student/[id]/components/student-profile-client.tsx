"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CalendarClock,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Grid3X3,
  Megaphone,
  Printer,
  UserRound,
} from "lucide-react";
import QRCode from "qrcode";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import Performance from "../../components/Performance";
import type { StudentProfileData } from "./student-profile-types";
import { StudentBadgeSection, type StudentBadgeSectionHandle } from "./student-badge-section";
import { StudentDocumentsSection } from "./student-documents-section";
import { StudentScheduleSection } from "./student-schedule-section";
import { StudentAnnouncementsSection } from "./student-announcements-section";
import { StudentPhotoAvatar } from "./student-photo-avatar";
import { StudentPhotoUploadInput } from "./student-photo-upload-input";
import { useStudentPhotoUpload } from "./use-student-photo-upload";

type InfoFieldProps = {
  label: string;
  value: React.ReactNode;
  className?: string;
};

function InfoField({ label, value, className }: InfoFieldProps) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function InfoCard({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("h-fit w-full rounded-xl border bg-card p-4 shadow-sm", className)}>
      <div className="mb-4 flex items-center gap-2">
        <div className="text-primary">{icon}</div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

function formatMoney(amount: number) {
  return `${amount.toLocaleString("fr-FR")} $`;
}

export function StudentProfileClient({ profile }: { profile: StudentProfileData }) {
  const badgeSectionRef = React.useRef<StudentBadgeSectionHandle>(null);
  const [tab, setTab] = React.useState("infos");
  const [identificationQr, setIdentificationQr] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    let active = true;

    void QRCode.toDataURL(
      JSON.stringify({
        v: 1,
        type: "student-id",
        studentId: profile.studentId,
        matricule: profile.matricule,
      }),
      { margin: 1, width: 180 },
    ).then((url) => {
      if (active) setIdentificationQr(url);
    });

    return () => {
      active = false;
    };
  }, [profile.matricule, profile.studentId]);

  const initials =
    `${profile.nom?.[0] ?? ""}${profile.prenom?.[0] ?? ""}`.toUpperCase() || "EL";

  const photoUpload = useStudentPhotoUpload({
    studentId: profile.studentId,
    initialImage: profile.image,
    canManageStudents: profile.canManageStudents,
  });

  return (
    <div className="space-y-4">
      <StudentPhotoUploadInput upload={photoUpload} />
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1 shrink-0">
            <Link href={profile.studentListHref} aria-label="Retour aux eleves">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>

          <div className="flex min-w-0 items-center gap-3">
            <StudentPhotoAvatar
              fullName={profile.fullName}
              initials={initials}
              upload={photoUpload}
            />

            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold uppercase tracking-wide md:text-xl">
                {profile.fullName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{profile.classLabel}</span>
                <span>•</span>
                <span className="font-mono text-xs">{profile.matricule}</span>
                <span>•</span>
                <Badge
                  variant={profile.statusActive ? "default" : "secondary"}
                  className={cn(
                    "rounded-full px-2 py-0 text-[11px]",
                    profile.statusActive && "bg-emerald-100 text-emerald-700",
                  )}
                >
                  {profile.statusLabel}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="default"
          className="gap-2 self-start lg:self-auto"
          onClick={() => void badgeSectionRef.current?.print()}
        >
          <Printer className="size-4" />
          Imprimer la carte
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:flex-row lg:items-center lg:justify-between">
          <div className="hidden min-h-9 w-full lg:block lg:max-w-md" aria-hidden />
          <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 lg:w-auto">
            <TabsTrigger value="infos" className="gap-1.5 text-xs sm:text-sm">
              <UserRound className="size-4" />
              Infos
            </TabsTrigger>
            <TabsTrigger value="finances" className="gap-1.5 text-xs sm:text-sm">
              <CreditCard className="size-4" />
              Finances
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1.5 text-xs sm:text-sm">
              <CalendarClock className="size-4" />
              Horaires
            </TabsTrigger>
            <TabsTrigger value="announcements" className="gap-1.5 text-xs sm:text-sm">
              <Megaphone className="size-4" />
              Annonces
            </TabsTrigger>
            <TabsTrigger value="presence" className="gap-1.5 text-xs sm:text-sm">
              <CalendarDays className="size-4" />
              Presence
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="size-4" />
              Documents
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="infos" forceMount className="mt-0 space-y-4 data-[state=inactive]:hidden">
              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
                <div className="flex min-w-0 flex-col gap-4">
                  <InfoCard
                    title="Informations personnelles"
                    icon={<UserRound className="size-4" />}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InfoField label="Nom" value={profile.nom || "-"} />
                      <InfoField label="Post-nom" value={profile.postnom || "-"} />
                      <InfoField label="Prenom" value={profile.prenom || "-"} />
                      <InfoField label="Sexe" value={profile.sexe || "-"} />
                      <InfoField label="Date naissance" value={profile.dateOfBirthLabel} />
                      <InfoField label="Age" value={profile.ageLabel} />
                      <InfoField label="Lieu naissance" value={profile.placeOfBirth} />
                      <InfoField label="Nationalite" value={profile.nationality} />
                      <InfoField label="Groupe sanguin" value={profile.bloodGroup} />
                      <InfoField label="Allergies" value={profile.allergies} />
                      <InfoField
                        label="Vulnerabilite"
                        value={profile.vulnerability}
                        className="sm:col-span-2"
                      />
                    </div>
                  </InfoCard>

                  <InfoCard title="Scolarite" icon={<Grid3X3 className="size-4" />}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InfoField label="Ecole" value={profile.schoolName} className="sm:col-span-2" />
                      <InfoField label="Matricule" value={profile.matricule} />
                      <InfoField label="Annee scolaire" value={profile.schoolYearLabel} />
                      <InfoField label="Classe" value={profile.classLabel} className="sm:col-span-2" />
                      <InfoField label="Section / option" value={profile.sectionLabel} />
                      <InfoField label="Titulaire" value={profile.titulaireName} />
                      <InfoField
                        label="Statut"
                        value={
                          <Badge
                            variant={profile.statusActive ? "default" : "secondary"}
                            className={cn(
                              profile.statusActive && "bg-emerald-100 text-emerald-700",
                            )}
                          >
                            {profile.statusLabel}
                          </Badge>
                        }
                      />
                      <InfoField label="Inscription" value={profile.enrollmentDateLabel} />
                    </div>
                  </InfoCard>

                  <InfoCard title="Parent / tuteur" icon={<UserRound className="size-4" />}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InfoField
                        label="Nom complet"
                        value={profile.parentFullName}
                        className="sm:col-span-2"
                      />
                      <InfoField label="Telephone" value={profile.parentPhone} />
                      <InfoField label="Email" value={profile.parentEmail} />
                      <InfoField label="Profession" value={profile.parentProfession} />
                      <InfoField
                        label="Adresse"
                        value={profile.parentAddress}
                        className="sm:col-span-2"
                      />
                      <InfoField
                        label="Contact urgence"
                        value={profile.parentEmergencyContact}
                        className="sm:col-span-2"
                      />
                    </div>
                  </InfoCard>
                </div>

                <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4">
                  <StudentBadgeSection ref={badgeSectionRef} badge={profile.badge} upload={photoUpload} />

                  <InfoCard title="Identification" icon={<Grid3X3 className="size-4" />}>
                    <div className="flex flex-col items-center justify-center gap-3 py-4">
                      {identificationQr ? (
                        <img
                          src={identificationQr}
                          alt="QR identification"
                          className="size-36 rounded-lg border bg-white p-2"
                        />
                      ) : (
                        <div className="size-36 animate-pulse rounded-lg border bg-muted" />
                      )}
                      <p className="text-sm text-muted-foreground">
                        Scanner pour verifier
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        ID: {profile.displayId}
                      </p>
                    </div>
                  </InfoCard>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="finances" className="mt-0 space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Montant du
                  </p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {formatMoney(profile.financeSummary.totalDue)}
                  </p>
                </Card>
                <Card className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Total paye
                  </p>
                  <p className="mt-2 text-2xl font-bold text-emerald-600">
                    {formatMoney(profile.financeSummary.totalPaid)}
                  </p>
                </Card>
                <Card className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Reste a payer
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-2xl font-bold",
                      profile.financeSummary.totalRemaining > 0
                        ? "text-amber-600"
                        : "text-emerald-600",
                    )}
                  >
                    {formatMoney(profile.financeSummary.totalRemaining)}
                  </p>
                </Card>
              </div>

              <Card className="rounded-xl border p-4 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold">Details des frais</h3>
                {profile.fees.length ? (
                  <div className="space-y-2">
                    {profile.fees.map((fee) => (
                      <div
                        key={fee.id}
                        className="rounded-lg border px-4 py-3"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-medium">{fee.label}</p>
                            {fee.typeFrais ? (
                              <p className="text-xs text-muted-foreground">
                                {fee.typeFrais}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            {fee.isPaid ? (
                              <Badge className="bg-emerald-100 text-emerald-700">
                                Solde
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                                En cours
                              </Badge>
                            )}
                            {fee.isPaid ? (
                              <CheckCircle className="size-4 text-emerald-500" />
                            ) : (
                              <Clock className="size-4 text-amber-500" />
                            )}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <InfoField label="Montant du" value={formatMoney(fee.amountDue)} />
                          <InfoField label="Paye" value={formatMoney(fee.amountPaid)} />
                          <InfoField
                            label="Reste a payer"
                            value={
                              <span
                                className={cn(
                                  fee.remaining > 0
                                    ? "text-amber-600"
                                    : "text-emerald-600",
                                )}
                              >
                                {formatMoney(fee.remaining)}
                              </span>
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aucun frais trouve pour cette inscription.
                  </p>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="schedule" className="mt-0">
              <StudentScheduleSection schedule={profile.schedule} />
            </TabsContent>

            <TabsContent value="announcements" className="mt-0">
              <StudentAnnouncementsSection announcements={profile.announcements} />
            </TabsContent>

            <TabsContent value="presence" className="mt-0">
              <Card className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Module presence en cours de preparation.
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
              <StudentDocumentsSection documents={profile.documents} />
            </TabsContent>
      </Tabs>

      <Performance semesters={profile.semesters} />
    </div>
  );
}
