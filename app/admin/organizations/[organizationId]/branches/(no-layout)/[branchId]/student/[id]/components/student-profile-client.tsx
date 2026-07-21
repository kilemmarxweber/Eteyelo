"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  CalendarDays,
  CalendarClock,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  Printer,
  QrCode,
  ScanLine,
  UserRound,
  Users,
} from "lucide-react";
import QRCode from "qrcode";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import Performance from "../../components/Performance";
import type { StudentProfileData } from "./student-profile-types";
import { StudentBadgeSection, type StudentBadgeSectionHandle } from "./student-badge-section";
import { StudentDocumentsSection } from "./student-documents-section";
import { StudentScheduleSection } from "./student-schedule-section";
import { StudentAnnouncementsSection } from "./student-announcements-section";
import { StudentPhotoAvatar } from "./student-photo-avatar";
import { StudentPhotoUploadInput } from "./student-photo-upload-input";
import { useStudentPhotoUpload } from "./use-student-photo-upload";

type ProfileSectionVariant = "personal" | "school" | "guardian";

const SECTION_VARIANTS: Record<
  ProfileSectionVariant,
  {
    border: string;
    gradient: string;
    headerBg: string;
    headerBorder: string;
    iconBox: string;
    iconColor: string;
    labelColor: string;
    accentText: string;
    highlightBox: string;
    divider: string;
  }
> = {
  personal: {
    border: "border-sky-200/80 dark:border-sky-900/40",
    gradient: "bg-gradient-to-b from-sky-500/[0.07] via-card to-card",
    headerBg: "bg-sky-500/[0.06]",
    headerBorder: "border-sky-500/10",
    iconBox: "bg-sky-500/15",
    iconColor: "text-sky-600 dark:text-sky-400",
    labelColor: "text-sky-700/85 dark:text-sky-400",
    accentText: "text-sky-700 dark:text-sky-300",
    highlightBox: "rounded-xl border border-sky-500/15 bg-sky-500/[0.06] px-3 py-2.5",
    divider: "border-sky-500/10",
  },
  school: {
    border: "border-amber-200/80 dark:border-amber-900/40",
    gradient: "bg-gradient-to-b from-amber-500/[0.08] via-card to-card",
    headerBg: "bg-amber-500/[0.07]",
    headerBorder: "border-amber-500/10",
    iconBox: "bg-amber-500/15",
    iconColor: "text-amber-600 dark:text-amber-400",
    labelColor: "text-amber-800/85 dark:text-amber-400",
    accentText: "text-amber-800 dark:text-amber-300",
    highlightBox: "rounded-xl border border-amber-500/20 bg-amber-500/[0.08] px-3 py-3 shadow-sm",
    divider: "border-amber-500/10",
  },
  guardian: {
    border: "border-violet-200/80 dark:border-violet-900/40",
    gradient: "bg-gradient-to-b from-violet-500/[0.07] via-card to-card",
    headerBg: "bg-violet-500/[0.06]",
    headerBorder: "border-violet-500/10",
    iconBox: "bg-violet-500/15",
    iconColor: "text-violet-600 dark:text-violet-400",
    labelColor: "text-violet-700/85 dark:text-violet-400",
    accentText: "text-violet-700 dark:text-violet-300",
    highlightBox: "rounded-xl border border-violet-500/20 bg-violet-500/[0.08] px-3 py-3 shadow-sm",
    divider: "border-violet-500/10",
  },
};

type InfoFieldProps = {
  label: string;
  value: React.ReactNode;
  className?: string;
  variant?: ProfileSectionVariant;
  highlight?: boolean;
};

function InfoField({ label, value, className, variant, highlight }: InfoFieldProps) {
  const styles = variant ? SECTION_VARIANTS[variant] : null;

  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <p
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.12em]",
          styles?.labelColor ?? "text-muted-foreground",
        )}
      >
        {label}
      </p>
      {highlight && styles ? (
        <div className={cn("text-sm font-semibold text-foreground", styles.highlightBox)}>
          {value}
        </div>
      ) : (
        <div className="text-sm font-medium text-foreground">{value}</div>
      )}
    </div>
  );
}

function ProfileSectionCard({
  variant,
  title,
  subtitle,
  icon,
  children,
  className,
}: {
  variant: ProfileSectionVariant;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = SECTION_VARIANTS[variant];

  return (
    <Card
      className={cn(
        "h-fit w-full overflow-hidden rounded-xl border shadow-sm",
        styles.border,
        styles.gradient,
        className,
      )}
    >
      <div className={cn("border-b px-4 py-3", styles.headerBg, styles.headerBorder)}>
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg shadow-sm",
              styles.iconBox,
              styles.iconColor,
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {subtitle ? (
              <p className="truncate text-xs text-foreground/70">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

function ContactRow({
  icon,
  label,
  value,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  variant: ProfileSectionVariant;
}) {
  const styles = SECTION_VARIANTS[variant];

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5", styles.highlightBox)}>
      <div className={cn("mt-0.5 shrink-0", styles.iconColor)}>{icon}</div>
      <div className="min-w-0">
        <p className={cn("text-[10px] font-bold uppercase tracking-[0.12em]", styles.labelColor)}>
          {label}
        </p>
        <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
      </div>
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

function StudentIdentificationPanel({
  matriculeLabel,
  matricule,
  displayId,
  qrDataUrl,
}: {
  matriculeLabel: string;
  matricule: string;
  displayId: string;
  qrDataUrl: string | null;
}) {
  return (
    <Card className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-b from-primary/[0.07] via-card to-card shadow-sm">
      <div className="border-b border-primary/10 bg-primary/[0.06] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary shadow-sm">
            <QrCode className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Identification</h3>
            <p className="truncate text-xs text-foreground/70">
              Badge numerique — {matriculeLabel.toLowerCase()}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 p-4">
        {qrDataUrl ? (
          <div className="rounded-2xl bg-white p-3 shadow-md ring-2 ring-primary/20">
            <Image
              src={qrDataUrl}
              alt="QR identification"
              width={128}
              height={128}
              unoptimized
              className="size-32"
            />
          </div>
        ) : (
          <div className="size-32 animate-pulse rounded-2xl bg-primary/10 ring-2 ring-primary/10" />
        )}

        <div className="w-full space-y-3 text-center">
          <p className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-foreground/80">
            <ScanLine className="size-3.5 text-primary" />
            Scanner pour verifier
          </p>

          <div className="rounded-xl border border-primary/20 bg-primary/[0.08] px-3 py-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              {matriculeLabel}
            </p>
            <p className="mt-1 font-mono text-lg font-bold tracking-wider text-foreground">
              {matricule}
            </p>
          </div>

          <p className="text-[11px] text-foreground/65">
            Ref. interne{" "}
            <span className="rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
              #{displayId}
            </span>
          </p>
        </div>
      </div>
    </Card>
  );
}

export function StudentProfileClient({ profile }: { profile: StudentProfileData }) {
  const peopleLabels = useBranchPeopleLabels();
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
            <Link href={profile.studentListHref} aria-label={`Retour aux ${peopleLabels.studentPluralLower}`}>
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
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground/85">
                  {profile.classLabel}
                </span>
                <span className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold tracking-wide text-primary shadow-sm">
                  {profile.matricule}
                </span>
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
        <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-xl border border-primary/15 bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:flex-row lg:items-center lg:justify-between">
          <div className="hidden min-h-9 w-full lg:block lg:max-w-md" aria-hidden />
          <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 gap-1 rounded-lg border border-primary/20 bg-primary/10 p-1 sm:grid-cols-3 xl:grid-cols-6 lg:w-auto">
            <TabsTrigger
              value="infos"
              className="gap-1.5 rounded-md px-2 py-2 text-xs text-primary/80 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <UserRound className="size-4" />
              Infos
            </TabsTrigger>
            <TabsTrigger
              value="finances"
              className="gap-1.5 rounded-md px-2 py-2 text-xs text-primary/80 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <CreditCard className="size-4" />
              Finances
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className="gap-1.5 rounded-md px-2 py-2 text-xs text-primary/80 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <CalendarClock className="size-4" />
              Horaires
            </TabsTrigger>
            <TabsTrigger
              value="announcements"
              className="gap-1.5 rounded-md px-2 py-2 text-xs text-primary/80 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <Megaphone className="size-4" />
              Annonces
            </TabsTrigger>
            <TabsTrigger
              value="presence"
              className="gap-1.5 rounded-md px-2 py-2 text-xs text-primary/80 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <CalendarDays className="size-4" />
              Presence
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="gap-1.5 rounded-md px-2 py-2 text-xs text-primary/80 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <FileText className="size-4" />
              Documents
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="infos" forceMount className="mt-0 space-y-4 data-[state=inactive]:hidden">
              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
                <div className="flex min-w-0 flex-col gap-4">
                  <ProfileSectionCard
                    variant="personal"
                    title="Informations personnelles"
                    subtitle="Identite et etat civil"
                    icon={<UserRound className="size-4" />}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoField variant="personal" label="Nom" value={profile.nom || "-"} />
                      <InfoField variant="personal" label="Post-nom" value={profile.postnom || "-"} />
                      <InfoField variant="personal" label="Prenom" value={profile.prenom || "-"} />
                      <InfoField variant="personal" label="Sexe" value={profile.sexe || "-"} />
                      <InfoField
                        variant="personal"
                        label="Date naissance"
                        value={profile.dateOfBirthLabel}
                      />
                      <InfoField variant="personal" label="Age" value={profile.ageLabel} />
                      <InfoField
                        variant="personal"
                        label="Lieu naissance"
                        value={profile.placeOfBirth}
                      />
                      <InfoField
                        variant="personal"
                        label="Nationalite"
                        value={profile.nationality}
                      />
                    </div>

                    <div className={cn("mt-4 border-t pt-4", SECTION_VARIANTS.personal.divider)}>
                      <p
                        className={cn(
                          "mb-3 text-[10px] font-bold uppercase tracking-[0.12em]",
                          SECTION_VARIANTS.personal.accentText,
                        )}
                      >
                        Sante
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <InfoField
                          variant="personal"
                          label="Groupe sanguin"
                          value={profile.bloodGroup}
                        />
                        <InfoField variant="personal" label="Allergies" value={profile.allergies} />
                        <InfoField
                          variant="personal"
                          label="Vulnerabilite"
                          value={profile.vulnerability}
                          className="sm:col-span-2"
                          highlight
                        />
                      </div>
                    </div>
                  </ProfileSectionCard>

                  <ProfileSectionCard
                    variant="school"
                    title="Scolarite"
                    subtitle={profile.schoolName}
                    icon={<GraduationCap className="size-4" />}
                  >
                    <div className={cn("mb-4", SECTION_VARIANTS.school.highlightBox)}>
                      <p
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-[0.12em]",
                          SECTION_VARIANTS.school.accentText,
                        )}
                      >
                        Classe actuelle
                      </p>
                      <p className="mt-1 text-base font-semibold text-foreground">
                        {profile.classLabel}
                      </p>
                      <p className="mt-2 text-xs text-foreground/70">
                        {profile.sectionLabel}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoField
                        variant="school"
                        label={peopleLabels.matriculeLabel}
                        value={
                          <span className="font-mono text-base font-bold tracking-wide">
                            {profile.matricule}
                          </span>
                        }
                        highlight
                      />
                      <InfoField
                        variant="school"
                        label="Annee scolaire"
                        value={profile.schoolYearLabel}
                      />
                      <InfoField
                        variant="school"
                        label="Titulaire"
                        value={profile.titulaireName}
                      />
                      <InfoField
                        variant="school"
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
                      <InfoField
                        variant="school"
                        label="Inscription"
                        value={profile.enrollmentDateLabel}
                        className="sm:col-span-2"
                      />
                    </div>
                  </ProfileSectionCard>

                  <ProfileSectionCard
                    variant="guardian"
                    title="Parent / tuteur"
                    subtitle="Contact principal et urgence"
                    icon={<Users className="size-4" />}
                  >
                    <div className={cn("mb-4", SECTION_VARIANTS.guardian.highlightBox)}>
                      <p
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-[0.12em]",
                          SECTION_VARIANTS.guardian.accentText,
                        )}
                      >
                        Nom complet
                      </p>
                      <p className="mt-1 text-base font-semibold text-foreground">
                        {profile.parentFullName}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <ContactRow
                        variant="guardian"
                        icon={<Phone className="size-4" />}
                        label="Telephone"
                        value={profile.parentPhone}
                      />
                      <ContactRow
                        variant="guardian"
                        icon={<Mail className="size-4" />}
                        label="Email"
                        value={profile.parentEmail}
                      />
                      <InfoField
                        variant="guardian"
                        label="Profession"
                        value={profile.parentProfession}
                        className="px-1 pt-1"
                      />
                      <ContactRow
                        variant="guardian"
                        icon={<MapPin className="size-4" />}
                        label="Adresse"
                        value={profile.parentAddress}
                      />
                      <ContactRow
                        variant="guardian"
                        icon={<Phone className="size-4" />}
                        label="Contact urgence"
                        value={profile.parentEmergencyContact}
                      />
                    </div>
                  </ProfileSectionCard>
                </div>

                <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4">
                  <StudentBadgeSection ref={badgeSectionRef} badge={profile.badge} upload={photoUpload} />

                  <StudentIdentificationPanel
                    matriculeLabel={peopleLabels.matriculeLabel}
                    matricule={profile.matricule}
                    displayId={profile.displayId}
                    qrDataUrl={identificationQr}
                  />
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
