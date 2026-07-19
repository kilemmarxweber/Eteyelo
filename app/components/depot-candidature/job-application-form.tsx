"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import {
  Briefcase,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  ImagePlus,
  Send,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { HomeNavbar } from "@/components/home-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { uploadDocument, uploadFile } from "@/lib/upload-file";
import { PUBLIC_PERSONNEL_ROLE_SLUGS } from "@/src/interfaces/JobApplication";
import { submitJobApplication } from "./job-application.actions";
import { LevelSectionOptionFields } from "@/components/level-section-option-fields";
import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
import type { ManagedBranchType } from "@/lib/academic-structure";
import { isPrimaryBranch } from "@/lib/class-structure";

type Branch = {
  id: string;
  name: string;
  ville: string | null;
  pays: string | null;
  typebranch: ManagedBranchType;
};

const STEPS = [
  "Type & établissement",
  "Identité",
  "Profil professionnel",
  "Documents",
  "Confirmation",
];

export function JobApplicationForm({ branches }: { branches: Branch[] }) {
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [reference, setReference] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    branchId: "",
    applicationType: "" as "" | "TEACHER" | "PERSONNEL",
    nom: "",
    postnom: "",
    prenom: "",
    sexe: "",
    dateOfBirth: "",
    address: "",
    email: "",
    telephone: "+243",
    desiredSubjects: "",
    desiredLevels: "",
    desiredSection: "",
    desiredOption: "",
    yearsOfExperience: "",
    desiredOrgRole: "",
    experienceSummary: "",
    educationSummary: "",
    skills: "",
    availability: "",
    motivation: "",
    consentAccepted: false,
  });

  const preview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : ""),
    [photo],
  );

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const selectedBranch = branches.find((b) => b.id === form.branchId);
  const branchType = (selectedBranch?.typebranch ??
    "SECONDAIRE") as ManagedBranchType;

  const update = (
    key: keyof typeof form,
    value: string | boolean,
  ) => setForm((current) => ({ ...current, [key]: value }));

  function validateStep() {
    if (step === 0) {
      if (!form.branchId || !form.applicationType) {
        toast.error("Choisissez un établissement et un type de candidature.");
        return false;
      }
    }

    if (step === 1) {
      if (
        !form.nom ||
        !form.postnom ||
        !form.prenom ||
        !form.sexe ||
        !form.dateOfBirth ||
        !form.address ||
        !form.telephone ||
        !form.email
      ) {
        toast.error("Complétez tous les champs obligatoires.");
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        toast.error("Email invalide.");
        return false;
      }
    }

    if (step === 2) {
      if (form.applicationType === "TEACHER") {
        if (!form.desiredSubjects || !form.desiredLevels) {
          toast.error("Indiquez les matières et le niveau souhaités.");
          return false;
        }
        if (
          !isPrimaryBranch(branchType) &&
          (!form.desiredSection || !form.desiredOption)
        ) {
          toast.error("Choisissez la section et l'option.");
          return false;
        }
      }
      if (form.applicationType === "PERSONNEL" && !form.desiredOrgRole) {
        toast.error("Choisissez le rôle souhaité.");
        return false;
      }
    }

    if (step === 3) {
      if (!cvFile || !coverLetterFile) {
        toast.error("Le CV et la lettre de motivation sont obligatoires.");
        return false;
      }
    }

    return true;
  }

  function submit() {
    if (!form.consentAccepted) {
      toast.error("Vous devez accepter le traitement de vos données.");
      return;
    }

    startTransition(async () => {
      try {
        let photoUrl: string | undefined;
        if (photo) {
          const uploadedPhoto = await uploadFile(photo);
          if (!uploadedPhoto.ok) {
            toast.error(uploadedPhoto.message);
            return;
          }
          photoUrl = uploadedPhoto.url;
        }

        const uploadedCv = await uploadDocument(cvFile);
        if (!uploadedCv.ok) {
          toast.error(uploadedCv.message);
          return;
        }

        const uploadedCover = await uploadDocument(coverLetterFile);
        if (!uploadedCover.ok) {
          toast.error(uploadedCover.message);
          return;
        }

        const levelsLabel = [
          form.desiredLevels,
          form.desiredSection,
          form.desiredOption,
        ]
          .filter(Boolean)
          .join(" · ");

        const result = await submitJobApplication({
          branchId: form.branchId,
          applicationType: form.applicationType as "TEACHER" | "PERSONNEL",
          nom: form.nom,
          postnom: form.postnom,
          prenom: form.prenom,
          sexe: form.sexe as "masculin" | "feminin",
          dateOfBirth: form.dateOfBirth,
          address: form.address,
          email: form.email,
          telephone: form.telephone,
          desiredSubjects: form.desiredSubjects,
          desiredLevels: levelsLabel || form.desiredLevels,
          yearsOfExperience: form.yearsOfExperience
            ? Number(form.yearsOfExperience)
            : undefined,
          desiredOrgRole: form.desiredOrgRole,
          experienceSummary: form.experienceSummary,
          educationSummary: form.educationSummary,
          skills: form.skills,
          availability: form.availability,
          motivation: form.motivation,
          photoUrl,
          cvUrl: uploadedCv.url,
          coverLetterUrl: uploadedCover.url,
          consentAccepted: true as const,
        });

        if (!result.success) {
          toast.error(result.message);
          return;
        }

        setReference(result.reference);
        toast.success(result.message);
        setStep(STEPS.length);
      } catch (error) {
        console.error(error);
        toast.error("Erreur lors de l'envoi de la candidature.");
      }
    });
  }

  if (step >= STEPS.length) {
    return (
      <div className="min-h-screen bg-background">
        <HomeNavbar />
        <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check className="size-8" />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-foreground">
            Candidature envoyee
          </h1>
          <p className="mt-3 text-muted-foreground">
            Votre dossier a ete transmis a l&apos;etablissement. Un email de
            confirmation a ete envoye a <strong>{form.email}</strong>.
          </p>
          {reference ? (
            <p className="mt-4 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              Reference : {reference}
            </p>
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <HomeNavbar />

      <section className="border-b border-primary/10 bg-primary text-primary-foreground shadow-lg shadow-primary/10">
        <div className="mx-auto max-w-4xl px-4 py-8 md:py-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold text-primary-foreground/90">
            <Briefcase className="size-4" />
            Recrutement
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
            Deposer une candidature
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary-foreground/90">
            Etape {step + 1} / {STEPS.length} · postulez comme enseignant ou
            personnel dans un etablissement partenaire.
          </p>
          <Progress
            value={((step + 1) / STEPS.length) * 100}
            className="mt-4 h-2 bg-primary-foreground/20 [&>div]:bg-primary-foreground"
          />
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 py-8 md:py-10">
        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-lg text-foreground">
                {STEPS[step]}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                Etape {step + 1} / {STEPS.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 0 && (
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Établissement *" wide>
                  <Select
                    value={form.branchId}
                    onValueChange={(value) => update("branchId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une école" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                          {branch.ville ? ` — ${branch.ville}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Type de candidature *" wide>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        value: "TEACHER" as const,
                        label: "Enseignant",
                        icon: GraduationCap,
                      },
                      {
                        value: "PERSONNEL" as const,
                        label: "Personnel",
                        icon: Users,
                      },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => update("applicationType", option.value)}
                        className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                          form.applicationType === option.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <option.icon className="size-5 text-primary" />
                        <span className="font-semibold">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Text label="Nom *" value={form.nom} onChange={(v) => update("nom", v)} />
                <Text label="Postnom *" value={form.postnom} onChange={(v) => update("postnom", v)} />
                <Text label="Prénom *" value={form.prenom} onChange={(v) => update("prenom", v)} />
                <Field label="Sexe *">
                  <Select value={form.sexe} onValueChange={(v) => update("sexe", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculin">Masculin</SelectItem>
                      <SelectItem value="feminin">Féminin</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Text
                  label="Date de naissance *"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(v) => update("dateOfBirth", v)}
                />
                <Text
                  label="Téléphone *"
                  value={form.telephone}
                  onChange={(v) => update("telephone", v)}
                />
                <Text
                  label="Email *"
                  type="email"
                  value={form.email}
                  onChange={(v) => update("email", v)}
                  wide
                />
                <Text
                  label="Adresse *"
                  value={form.address}
                  onChange={(v) => update("address", v)}
                  wide
                />
                <Field label="Photo (facultative)" wide>
                  <div className="flex flex-wrap items-center gap-3">
                    {preview ? (
                      <Image
                        src={preview}
                        alt="Aperçu"
                        width={80}
                        height={80}
                        unoptimized
                        className="size-20 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex size-20 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
                        <ImagePlus />
                      </div>
                    )}
                    <Label className="cursor-pointer rounded-md border px-3 py-2 text-sm">
                      <ImagePlus className="mr-2 inline size-4" />
                      Parcourir
                      <Input
                        className="hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) =>
                          setPhoto(event.target.files?.[0] ?? null)
                        }
                      />
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCameraOpen(true)}
                    >
                      <Camera className="mr-2 size-4" />
                      Caméra
                    </Button>
                  </div>
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4 md:grid-cols-2">
                {form.applicationType === "TEACHER" ? (
                  <>
                    <Text
                      label="Matières souhaitées *"
                      value={form.desiredSubjects}
                      onChange={(v) => update("desiredSubjects", v)}
                      wide
                    />
                    <div className="md:col-span-2">
                      <LevelSectionOptionFields
                        typebranch={branchType}
                        multiLevel
                        value={{
                          level: form.desiredLevels,
                          sectionName: form.desiredSection,
                          optionName: form.desiredOption,
                        }}
                        onChange={(next) =>
                          setForm((current) => ({
                            ...current,
                            desiredLevels: next.level,
                            desiredSection: next.sectionName,
                            desiredOption: next.optionName,
                          }))
                        }
                      />
                    </div>
                  </>
                ) : (
                  <Field label="Rôle souhaité *" wide>
                    <Select
                      value={form.desiredOrgRole}
                      onValueChange={(v) => update("desiredOrgRole", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        {PUBLIC_PERSONNEL_ROLE_SLUGS.map((slug) => (
                          <SelectItem key={slug} value={slug}>
                            {orgRoleLabel(slug)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}

                <Text
                  label="Années d'expérience"
                  type="number"
                  value={form.yearsOfExperience}
                  onChange={(v) => update("yearsOfExperience", v)}
                />
                <Text
                  label="Disponibilité"
                  value={form.availability}
                  onChange={(v) => update("availability", v)}
                />
                <Field label="Formation / diplômes" wide>
                  <Textarea
                    value={form.educationSummary}
                    onChange={(event) =>
                      update("educationSummary", event.target.value)
                    }
                    rows={3}
                  />
                </Field>
                <Field label="Compétences" wide>
                  <Textarea
                    value={form.skills}
                    onChange={(event) => update("skills", event.target.value)}
                    rows={3}
                  />
                </Field>
                <Field label="Résumé d'expérience" wide>
                  <Textarea
                    value={form.experienceSummary}
                    onChange={(event) =>
                      update("experienceSummary", event.target.value)
                    }
                    rows={4}
                  />
                </Field>
                <Field label="Motivation (texte libre)" wide>
                  <Textarea
                    value={form.motivation}
                    onChange={(event) => update("motivation", event.target.value)}
                    rows={4}
                  />
                </Field>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-5">
                <Field label="CV * (PDF, DOC, DOCX — max 10 Mo)" wide>
                  <Label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4">
                    <FileText className="size-5 text-primary" />
                    <span>{cvFile ? cvFile.name : "Sélectionner votre CV"}</span>
                    <Upload className="ml-auto size-4 text-muted-foreground" />
                    <Input
                      className="hidden"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) =>
                        setCvFile(event.target.files?.[0] ?? null)
                      }
                    />
                  </Label>
                </Field>

                <Field
                  label="Lettre de motivation * (PDF, DOC, DOCX — max 10 Mo)"
                  wide
                >
                  <Label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4">
                    <Briefcase className="size-5 text-primary" />
                    <span>
                      {coverLetterFile
                        ? coverLetterFile.name
                        : "Sélectionner votre lettre"}
                    </span>
                    <Upload className="ml-auto size-4 text-muted-foreground" />
                    <Input
                      className="hidden"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) =>
                        setCoverLetterFile(event.target.files?.[0] ?? null)
                      }
                    />
                  </Label>
                </Field>

                {selectedBranch ? (
                  <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
                    Candidature pour <strong>{selectedBranch.name}</strong> en
                    qualite de{" "}
                    <strong>
                      {form.applicationType === "TEACHER"
                        ? "Enseignant"
                        : "Personnel"}
                    </strong>
                    .
                  </p>
                ) : null}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="grid gap-3 rounded-xl border border-primary/15 bg-primary/5 p-5 md:grid-cols-2">
                  <p>
                    <b>Candidat :</b> {form.prenom} {form.nom} {form.postnom}
                  </p>
                  <p>
                    <b>Email :</b> {form.email}
                  </p>
                  <p>
                    <b>Type :</b>{" "}
                    {form.applicationType === "TEACHER"
                      ? "Enseignant"
                      : "Personnel"}
                  </p>
                  <p>
                    <b>Établissement :</b> {selectedBranch?.name || "-"}
                  </p>
                  <p>
                    <b>CV :</b> {cvFile?.name || "-"}
                  </p>
                  <p>
                    <b>Lettre :</b> {coverLetterFile?.name || "-"}
                  </p>
                </div>
                <Label className="flex items-start gap-3">
                  <Checkbox
                    checked={form.consentAccepted}
                    onCheckedChange={(checked) =>
                      update("consentAccepted", checked === true)
                    }
                  />
                  <span>
                    J&apos;accepte le traitement de mes données pour cette
                    candidature et confirme l&apos;exactitude des informations
                    fournies.
                  </span>
                </Label>
              </div>
            )}

            <div className="flex justify-between border-t pt-5">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0 || isPending}
                onClick={() => setStep((value) => value - 1)}
              >
                <ChevronLeft className="mr-2 size-4" />
                Précédent
              </Button>
              {step < STEPS.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (validateStep()) setStep((value) => value + 1);
                  }}
                >
                  Continuer
                  <ChevronRight className="ml-2 size-4" />
                </Button>
              ) : (
                <Button type="button" disabled={isPending} onClick={submit}>
                  <Send className="mr-2 size-4" />
                  {isPending ? "Envoi..." : "Envoyer la candidature"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title="Capture photo"
        onCapture={(file) => {
          setPhoto(file);
        }}
      />
    </div>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-2 ${wide ? "md:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  type = "text",
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  wide?: boolean;
}) {
  return (
    <Field label={label} wide={wide}>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
