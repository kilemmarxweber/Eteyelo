"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { registerStudentOnline } from "./insption.actions";

type Branch = {
  id: string;
  name: string;
  ville: string | null;
  pays: string | null;
  image: unknown;
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

export function StudentRegistrationForm({ branches }: { branches: Branch[] }) {
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [reference, setReference] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [secondGuardian, setSecondGuardian] = useState(false);
  const [form, setForm] = useState({
    branchId: "",
    name: "",
    postnom: "",
    prenom: "",
    sexe: "",
    dateOfBirth: "",
    placeOfBirth: "",
    address: "",
    email: "",
    telephone: "",
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

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  const updateGuardian = (index: number, key: keyof Guardian, value: string) =>
    setGuardians((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );

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
          email: form.email,
          telephone: form.telephone,
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
      <div className="min-h-screen bg-slate-50">
        <HomeNavbar />
        <main className="mx-auto max-w-7xl px-4 py-20">
          <Card className="text-center">
            <CardContent className="space-y-5 p-10">
              <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="size-8" />
              </span>
              <h1 className="text-2xl font-bold">Demande envoyee</h1>
              <p>Conservez cette reference :</p>
              <p className="rounded-xl bg-slate-100 p-4 font-mono text-xl font-bold">
                {reference}
              </p>
              <p className="text-sm text-muted-foreground">
                L'ecole doit confirmer la demande avant l'inscription
                definitive.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50">
      <HomeNavbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Demande d'inscription scolaire</CardTitle>
            <p className="text-sm text-muted-foreground">
              Etape {step + 1} sur 4 · cette demande ne cree pas encore de
              compte.
            </p>
            <Progress value={(step + 1) * 25} />
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
                <Text
                  label="Date de naissance *"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(v) => update("dateOfBirth", v)}
                />
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
                <Text
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(v) => update("email", v)}
                />
                <Text
                  label="Telephone"
                  value={form.telephone}
                  onChange={(v) => update("telephone", v)}
                />
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
              <div className="grid gap-4 md:grid-cols-2">
                <Text
                  label="Classe ou niveau souhaite *"
                  value={form.requestedLevel}
                  onChange={(v) => update("requestedLevel", v)}
                />
                <Text
                  label="Section souhaitee"
                  value={form.requestedSection}
                  onChange={(v) => update("requestedSection", v)}
                />
                <Text
                  label="Option souhaitee"
                  value={form.requestedOption}
                  onChange={(v) => update("requestedOption", v)}
                />
                <Text
                  label="Ecole de provenance"
                  value={form.provenanceEcole}
                  onChange={(v) => update("provenanceEcole", v)}
                />
                <Field label="Photo facultative" wide>
                  <div className="flex flex-wrap items-center gap-3">
                    {preview ? (
                      <img
                        src={preview}
                        alt="Apercu"
                        className="size-20 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex size-20 items-center justify-center rounded-xl bg-slate-100">
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
                    <Label className="cursor-pointer rounded-md border px-3 py-2 text-sm">
                      <Camera className="mr-2 inline size-4" />
                      Camera
                      <Input
                        className="hidden"
                        type="file"
                        accept="image/*"
                        capture="user"
                        onChange={(event) =>
                          setPhoto(event.target.files?.[0] ?? null)
                        }
                      />
                    </Label>
                  </div>
                </Field>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-5">
                <div className="grid gap-3 rounded-xl bg-slate-50 p-5 md:grid-cols-2">
                  <p>
                    <b>Eleve :</b> {form.name} {form.postnom} {form.prenom}
                  </p>
                  <p>
                    <b>Niveau :</b> {form.requestedLevel}
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
                    if (validateStep()) setStep((value) => value + 1);
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
