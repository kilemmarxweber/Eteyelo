"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Send,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
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
import { uploadFile } from "@/lib/upload-file";
import { generateSlug } from "@/lib/generated-identifiers";
import { registerStudentOnline } from "./insption.actions";
import { LevelSectionOptionFields } from "@/components/level-section-option-fields";
import type { ManagedBranchType } from "@/lib/academic-structure";
import { isPrimaryBranch } from "@/lib/class-structure";

type Branch = {
  id: string;
  name: string;
  ville: string | null;
  pays: string | null;
  image: unknown;
  typebranch: ManagedBranchType;
};
type Guardian = {
  name: string;
  postnom: string;
  prenom: string;
  relationship: string;
  sexe: "masculin" | "feminin";
  telephone: string;
  email: string;
  address: string;
  isPrimary: boolean;
};

const STUDENT_EMAIL_DOMAIN = "klambocore.com";
const PRIMARY_MIN_AGE = 5;

const emptyGuardian = (isPrimary: boolean): Guardian => ({
  name: "",
  postnom: "",
  prenom: "",
  relationship: "",
  sexe: "masculin",
  telephone: "+243",
  email: "",
  address: "",
  isPrimary,
});

function previewStudentEmail(prenom: string, name: string) {
  return `${generateSlug(`${prenom}.${name}`, "eleve")}@${STUDENT_EMAIL_DOMAIN}`;
}

function ageFromDate(dateStr: string) {
  const birth = new Date(dateStr);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function maxBirthDateForMinAge(minAge: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - minAge);
  return date.toISOString().slice(0, 10);
}

export function StudentRegistrationForm({ branches }: { branches: Branch[] }) {
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [reference, setReference] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [secondGuardian, setSecondGuardian] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [form, setForm] = useState({
    branchId: "",
    name: "",
    postnom: "",
    prenom: "",
    sexe: "",
    dateOfBirth: "",
    placeOfBirth: "",
    address: "",
    provenanceEcole: "",
    requestedLevel: "",
    requestedSection: "",
    requestedOption: "",
    consentAccepted: false,
  });
  const [guardians, setGuardians] = useState<Guardian[]>([
    emptyGuardian(true),
    emptyGuardian(false),
  ]);
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
  const isPrimary = isPrimaryBranch(branchType);
  const generatedStudentEmail = useMemo(
    () => previewStudentEmail(form.prenom, form.name),
    [form.prenom, form.name],
  );
  const primaryMaxBirthDate = maxBirthDateForMinAge(PRIMARY_MIN_AGE);

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const updateGuardian = (index: number, key: keyof Guardian, value: string) =>
    setGuardians((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );

  function prefillPrimaryGuardianFromStudent() {
    setGuardians((current) => {
      const primary = current[0];
      return [
        {
          ...primary,
          name: primary.name || form.name,
          postnom: primary.postnom || form.postnom,
          prenom: primary.prenom || form.prenom,
          address: primary.address || form.address,
        },
        current[1],
      ];
    });
  }

  function validateStep() {
    if (
      step === 0 &&
      (!form.branchId ||
        !form.name ||
        !form.postnom ||
        !form.prenom ||
        !form.sexe ||
        !form.dateOfBirth ||
        !form.placeOfBirth ||
        !form.address)
    ) {
      toast.error("Completez les informations obligatoires de l'eleve.");
      return false;
    }
    if (step === 0 && isPrimary) {
      const age = ageFromDate(form.dateOfBirth);
      if (age === null || age < PRIMARY_MIN_AGE) {
        toast.error(
          `Pour le primaire, l'enfant doit avoir au moins ${PRIMARY_MIN_AGE} ans.`,
        );
        return false;
      }
    }
    const primary = guardians[0];
    if (
      step === 1 &&
      (!primary.name ||
        !primary.postnom ||
        !primary.prenom ||
        !primary.relationship ||
        !primary.telephone ||
        !primary.address)
    ) {
      toast.error("Completez le responsable principal.");
      return false;
    }
    if (step === 1 && secondGuardian) {
      const second = guardians[1];
      if (
        !second.name ||
        !second.postnom ||
        !second.prenom ||
        !second.relationship ||
        !second.telephone ||
        !second.address
      ) {
        toast.error("Completez le second responsable ou retirez-le.");
        return false;
      }
    }
    if (step === 2 && !form.requestedLevel) {
      toast.error("Indiquez la classe ou le niveau souhaite.");
      return false;
    }
    if (
      step === 2 &&
      !isPrimaryBranch(branchType) &&
      (!form.requestedSection || !form.requestedOption)
    ) {
      toast.error("Choisissez la section et l'option.");
      return false;
    }
    return true;
  }

  function submit() {
    if (!form.consentAccepted)
      return toast.error("Acceptez le traitement des donnees.");
    startTransition(async () => {
      let photoUrl = "";
      if (photo) {
        const uploaded = await uploadFile(photo);
        if (!uploaded.ok) {
          toast.error(uploaded.message);
          return;
        }
        photoUrl = uploaded.url;
      }
      const result = await registerStudentOnline({
        branchId: form.branchId,
        student: {
          name: form.name,
          postnom: form.postnom,
          prenom: form.prenom,
          sexe: form.sexe as "masculin" | "feminin",
          dateOfBirth: form.dateOfBirth,
          placeOfBirth: form.placeOfBirth,
          address: form.address,
          email: generatedStudentEmail,
          provenanceEcole: form.provenanceEcole,
        },
        guardians: secondGuardian ? guardians : [guardians[0]],
        requestedLevel: form.requestedLevel,
        requestedSection: form.requestedSection,
        requestedOption: form.requestedOption,
        photoUrl,
        consentAccepted: true,
      });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      setReference(result.reference);
      toast.success(result.message);
    });
  }

  if (reference)
    return (
      <div className="min-h-screen bg-background">
        <HomeNavbar />
        <main className="mx-auto max-w-7xl px-4 py-20">
          <Card className="border-border text-center shadow-sm">
            <CardContent className="space-y-5 p-10">
              <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="size-8" />
              </span>
              <h1 className="text-2xl font-bold text-foreground">
                Demande envoyee
              </h1>
              <p className="text-muted-foreground">Conservez cette reference :</p>
              <p className="rounded-xl border border-primary/20 bg-primary/5 p-4 font-mono text-xl font-bold text-primary">
                {reference}
              </p>
              <p className="text-sm text-muted-foreground">
                L&apos;ecole doit confirmer la demande avant l&apos;inscription
                definitive.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <HomeNavbar />

      <section className="border-b border-primary/10 bg-primary text-primary-foreground shadow-lg shadow-primary/10">
        <div className="mx-auto max-w-4xl px-4 py-8 md:py-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold text-primary-foreground/90">
            <UserPlus className="size-4" />
            Inscription scolaire
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
            Demande d&apos;inscription
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary-foreground/90">
            Etape {step + 1} sur 4 · cette demande ne cree pas encore de compte.
          </p>
          <Progress
            value={(step + 1) * 25}
            className="mt-4 h-2 bg-primary-foreground/20 [&>div]:bg-primary-foreground"
          />
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 py-8 md:py-10">
        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg text-foreground">
              Formulaire d&apos;inscription
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Remplissez les informations de l&apos;eleve et du responsable.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Ecole *" wide>
                  <Select
                    value={form.branchId}
                    onValueChange={(value) => update("branchId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une ecole" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name} · {branch.ville || branch.pays || "RDC"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Text
                  label="Nom *"
                  value={form.name}
                  onChange={(v) => update("name", v)}
                />
                <Text
                  label="Postnom *"
                  value={form.postnom}
                  onChange={(v) => update("postnom", v)}
                />
                <Text
                  label="Prenom *"
                  value={form.prenom}
                  onChange={(v) => update("prenom", v)}
                />
                <Field label="Sexe *">
                  <Select
                    value={form.sexe}
                    onValueChange={(v) => update("sexe", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculin">Masculin</SelectItem>
                      <SelectItem value="feminin">Feminin</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date de naissance *">
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    max={isPrimary ? primaryMaxBirthDate : undefined}
                    onChange={(event) =>
                      update("dateOfBirth", event.target.value)
                    }
                  />
                  {isPrimary ? (
                    <p className="text-xs text-muted-foreground">
                      Primaire : l&apos;enfant doit avoir au moins{" "}
                      {PRIMARY_MIN_AGE} ans.
                    </p>
                  ) : null}
                </Field>
                <Text
                  label="Lieu de naissance *"
                  value={form.placeOfBirth}
                  onChange={(v) => update("placeOfBirth", v)}
                />
                <Text
                  label="Adresse *"
                  value={form.address}
                  onChange={(v) => update("address", v)}
                />
                <Field label="Email eleve (automatique)">
                  <Input
                    disabled
                    className="bg-muted font-mono text-foreground opacity-100"
                    value={generatedStudentEmail}
                  />
                </Field>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-6">
                {guardians
                  .slice(0, secondGuardian ? 2 : 1)
                  .map((guardian, index) => (
                    <div key={index} className="rounded-xl border p-4">
                      <h3 className="mb-4 font-semibold">
                        {index === 0
                          ? "Responsable principal"
                          : "Second responsable"}
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {(
                          [
                            "name",
                            "postnom",
                            "prenom",
                            "relationship",
                            "telephone",
                            "email",
                            "address",
                          ] as const
                        ).map((key) => (
                          <Text
                            key={key}
                            label={
                              {
                                name: "Nom *",
                                postnom: "Postnom *",
                                prenom: "Prenom *",
                                relationship: "Lien de parente *",
                                telephone: "Telephone *",
                                email: "Email",
                                address: "Adresse *",
                              }[key]
                            }
                            value={guardian[key]}
                            onChange={(v) => updateGuardian(index, key, v)}
                          />
                        ))}
                        <Field label="Sexe *">
                          <Select
                            value={guardian.sexe}
                            onValueChange={(value) =>
                              updateGuardian(index, "sexe", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="masculin">Masculin</SelectItem>
                              <SelectItem value="feminin">Feminin</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    </div>
                  ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSecondGuardian((value) => !value)}
                >
                  <UserPlus className="mr-2 size-4" />
                  {secondGuardian
                    ? "Retirer le second responsable"
                    : "Ajouter un second responsable"}
                </Button>
              </div>
            )}
            {step === 2 && (
              <div className="grid gap-4">
                {!form.branchId ? (
                  <p className="text-sm text-muted-foreground">
                    Sélectionnez d&apos;abord un établissement à l&apos;étape 1.
                  </p>
                ) : (
                  <LevelSectionOptionFields
                    typebranch={branchType}
                    value={{
                      level: form.requestedLevel,
                      sectionName: form.requestedSection,
                      optionName: form.requestedOption,
                    }}
                    onChange={(next) =>
                      setForm((current) => ({
                        ...current,
                        requestedLevel: next.level,
                        requestedSection: next.sectionName,
                        requestedOption: next.optionName,
                      }))
                    }
                  />
                )}
                <Text
                  label="Ecole de provenance"
                  value={form.provenanceEcole}
                  onChange={(v) => update("provenanceEcole", v)}
                />
                <Field label="Photo facultative" wide>
                  <div className="flex flex-wrap items-center gap-3">
                    {preview ? (
                      <Image
                        src={preview}
                        alt="Apercu"
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
            {step === 3 && (
              <div className="space-y-5">
                <div className="grid gap-3 rounded-xl border border-primary/15 bg-primary/5 p-5 md:grid-cols-2">
                  <p>
                    <b>Eleve :</b> {form.name} {form.postnom} {form.prenom}
                  </p>
                  <p>
                    <b>Email :</b> {generatedStudentEmail}
                  </p>
                  <p>
                    <b>Niveau :</b> {form.requestedLevel}
                    {form.requestedSection
                      ? ` · ${form.requestedSection}`
                      : ""}
                    {form.requestedOption
                      ? ` · ${form.requestedOption}`
                      : ""}
                  </p>
                  <p>
                    <b>Responsable :</b> {guardians[0].name}{" "}
                    {guardians[0].postnom}
                  </p>
                  <p>
                    <b>Photo :</b> {photo ? "Ajoutee" : "Non ajoutee"}
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
                    J'accepte le traitement de ces donnees pour la demande
                    d'inscription.
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
                Precedent
              </Button>
              {step < 3 ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (!validateStep()) return;
                    if (step === 0) prefillPrimaryGuardianFromStudent();
                    setStep((value) => value + 1);
                  }}
                >
                  Continuer
                  <ChevronRight className="ml-2 size-4" />
                </Button>
              ) : (
                <Button type="button" disabled={isPending} onClick={submit}>
                  <Send className="mr-2 size-4" />
                  {isPending ? "Envoi..." : "Envoyer la demande"}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <Field label={label}>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
