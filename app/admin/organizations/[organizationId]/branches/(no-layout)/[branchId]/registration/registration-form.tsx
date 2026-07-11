"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconSchool,
  IconSearch,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  createRegistrationFlowAction,
  createNextParallelForRegistrationAction,
  findParentForRegistrationAction,
  findStudentHistoryAction,
  getRegistrationOptionsAction,
  suggestNextClassAction,
} from "./registration.action";

type Person = {
  username: string;
  name: string;
  postnom: string;
  prenom: string;
  email: string;
  telephone: string;
  sexe: "masculin" | "feminin";
  address: string;
  dateOfBirth: string;
};
type StudentForm = Person & {
  category: "NORMAL" | "ORPHAN" | "VIP" | "SPONSORED" | "GROUPE";
  provenanceEcole: string;
  observation: string;
};
type ParentForm = Person & { discountPercentage: number };

const emptyPerson: Person = {
  username: "",
  name: "",
  postnom: "",
  prenom: "",
  email: "",
  telephone: "+243",
  sexe: "masculin",
  address: "",
  dateOfBirth: "",
};
const emptyStudent: StudentForm = { ...emptyPerson, category: "NORMAL", provenanceEcole: "", observation: "" };
const emptyParent: ParentForm = { ...emptyPerson, discountPercentage: 0 };
const steps = [
  { label: "Élève", icon: IconUser },
  { label: "Parent", icon: IconUsers },
  { label: "Classe", icon: IconSchool },
  { label: "Confirmation", icon: IconCheck },
];

function userOf(item: any) {
  return item.branchMember?.member?.user;
}

function previewStudentCode(branchName: string, studentName: string, sequence: number) {
  const initials = branchName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 4);
  const now = new Date();
  const dayMonth = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `${initials || "ETB"}-${dayMonth}${studentName.trim().charAt(0).toUpperCase() || "X"}${sequence}`;
}

export function RegistrationForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [options, setOptions] = useState<any>({ schoolYears: [], classes: [], options: [], levels: [] });
  const [studentMode, setStudentMode] = useState<"existing" | "new">("new");
  const [studentId, setStudentId] = useState("");
  const [student, setStudent] = useState<StudentForm>(emptyStudent);
  const [parentMode, setParentMode] = useState<"existing" | "new">("new");
  const [parentId, setParentId] = useState("");
  const [parent, setParent] = useState<ParentForm>(emptyParent);
  const [studentQuery, setStudentQuery] = useState("");
  const [parentQuery, setParentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [parentResults, setParentResults] = useState<any[]>([]);
  const [historyOutcome, setHistoryOutcome] = useState<"new" | "passed" | "failed" | "returning">("new");
  const [schoolYearId, setSchoolYearId] = useState("");
  const [level, setLevel] = useState("");
  const [optionId, setOptionId] = useState("");
  const [newClassCapacity, setNewClassCapacity] = useState(30);
  const [creatingClass, setCreatingClass] = useState(false);

  useEffect(() => {
    void loadRegistrationOptions(true);
  }, []);

  async function loadRegistrationOptions(setDefaultYear = false) {
    const [data, error] = await getRegistrationOptionsAction();
    setLoadingOptions(false);
    if (error) return toast.error(error.message);
    setOptions(data);
    if (setDefaultYear) {
      setSchoolYearId(
        data.schoolYears.find((year: any) => year.isCurrentYear)?.id ??
          data.schoolYears[0]?.id ??
          "",
      );
    }
  }

  const selectedClasses = useMemo(
    () => options.classes.filter((classe: any) => classe.level === level && (!optionId || classe.optionId === optionId)),
    [level, optionId, options.classes],
  );
  const generatedStudentCode = useMemo(
    () => previewStudentCode(
      options.branchName ?? "",
      student.name,
      (options.annualStudentCounts?.[schoolYearId] ?? 0) + 1,
    ),
    [options.branchName, options.annualStudentCounts, schoolYearId, student.name],
  );

  async function searchStudents() {
    const [data, error] = await findStudentHistoryAction({ query: studentQuery });
    if (error) toast.error(error.message);
    else setStudentResults(data);
  }
  async function searchParents() {
    const [data, error] = await findParentForRegistrationAction({ query: parentQuery });
    if (error) toast.error(error.message);
    else setParentResults(data);
  }
  function chooseStudent(item: any) {
    setStudentId(item.id);
    const last = item.classEnrollment?.[0];
    if (last?.classe?.level) {
      setLevel(last.classe.level);
      setOptionId(last.classe.optionId ?? "");
    }
  }
  async function applyHistory(outcome: "passed" | "failed" | "returning") {
    setHistoryOutcome(outcome);
    if (!studentId || outcome === "returning") return;
    const [suggestion, error] = await suggestNextClassAction({ studentId, outcome });
    if (error) toast.error(error.message);
    else {
      setLevel(suggestion.level);
      setOptionId(suggestion.optionId ?? "");
      toast.success(suggestion.reason);
    }
  }
  function updatePerson<T>(current: T, setter: (value: T) => void, key: string, value: unknown) {
    setter({ ...current, [key]: value });
  }
  function goNext() {
    if (step === 0 && studentMode === "existing" && !studentId) return toast.error("Sélectionnez un élève.");
    if (step === 0 && studentMode === "new" && (!student.name || !student.postnom || !student.prenom || !student.email || !student.dateOfBirth || !student.address)) return toast.error("Complétez toutes les informations obligatoires de l'élève.");
    if (step === 1 && parentMode === "existing" && !parentId) return toast.error("Sélectionnez un parent.");
    if (step === 1 && parentMode === "new" && (!parent.username || !parent.name || !parent.postnom || !parent.prenom || !parent.email || !parent.address)) return toast.error("Complétez toutes les informations obligatoires du parent.");
    if (step === 2 && (!schoolYearId || !level)) return toast.error("Choisissez l'année scolaire et la classe demandée.");
    setStep((current) => current + 1);
  }
  async function submit() {
    setLoading(true);
    const [result, error] = await createRegistrationFlowAction({
      schoolYearId,
      level,
      optionId: optionId || undefined,
      studentMode,
      studentId: studentId || undefined,
      student: studentMode === "new" ? { ...student, username: generatedStudentCode, dateOfBirth: new Date(student.dateOfBirth) } : undefined,
      parentMode,
      parentId: parentId || undefined,
      parent: parentMode === "new" ? { ...parent, dateOfBirth: parent.dateOfBirth ? new Date(parent.dateOfBirth) : undefined } : undefined,
      historyOutcome,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(`Inscription confirmée dans ${result.classeName}`);
    router.refresh();
    setStep(0);
    setStudentId("");
    setParentId("");
  }

  async function createNextParallel() {
    if (!level) return toast.error("Choisissez d'abord la classe demandée.");
    setCreatingClass(true);
    const [classe, error] = await createNextParallelForRegistrationAction({
      level,
      optionId: optionId || undefined,
      capacity: newClassCapacity,
    });
    setCreatingClass(false);
    if (error) return toast.error(error.message);
    toast.success(`${classe.nameClasse} créée avec une capacité de ${classe.capacity} élèves.`);
    await loadRegistrationOptions();
  }

  function renderPersonFields(value: StudentForm | ParentForm, setter: (value: any) => void, studentFields = false) {
    return <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Field label={studentFields ? "Matricule élève (automatique)" : "Code d'accès *"}><Input disabled={studentFields} className={studentFields ? "bg-muted font-mono text-foreground opacity-100" : ""} value={studentFields ? generatedStudentCode : value.username} onChange={(event) => updatePerson(value, setter, "username", event.target.value)} placeholder="Généré automatiquement" /></Field>
        <Field label="Nom *"><Input value={value.name} onChange={(event) => updatePerson(value, setter, "name", event.target.value)} /></Field>
        <Field label="Postnom *"><Input value={value.postnom} onChange={(event) => updatePerson(value, setter, "postnom", event.target.value)} /></Field>
        <Field label="Prénom *"><Input value={value.prenom} onChange={(event) => updatePerson(value, setter, "prenom", event.target.value)} /></Field>
        <Field label="Date de naissance"><Input type="date" value={value.dateOfBirth} onChange={(event) => updatePerson(value, setter, "dateOfBirth", event.target.value)} /></Field>
        <Field label="Sexe *"><Select value={value.sexe} onValueChange={(next) => updatePerson(value, setter, "sexe", next)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="masculin">Masculin</SelectItem><SelectItem value="feminin">Féminin</SelectItem></SelectContent></Select></Field>
        <Field label="Téléphone *"><Input value={value.telephone} onChange={(event) => updatePerson(value, setter, "telephone", event.target.value)} /></Field>
        <Field label="Email *"><Input type="email" value={value.email} onChange={(event) => updatePerson(value, setter, "email", event.target.value)} /></Field>
        <Field label="Adresse complète *" className="xl:col-span-1"><Input value={value.address} onChange={(event) => updatePerson(value, setter, "address", event.target.value)} /></Field>
      </div>
      {studentFields && <><Separator /><div className="grid gap-5 md:grid-cols-2"><Field label="Catégorie"><Select value={(value as StudentForm).category} onValueChange={(next) => updatePerson(value, setter, "category", next)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["NORMAL", "ORPHAN", "VIP", "SPONSORED", "GROUPE"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="École de provenance (facultatif)"><Input value={(value as StudentForm).provenanceEcole} onChange={(event) => updatePerson(value, setter, "provenanceEcole", event.target.value)} /></Field><Field label="Observation (facultatif)" className="md:col-span-2"><Textarea value={(value as StudentForm).observation} onChange={(event) => updatePerson(value, setter, "observation", event.target.value)} rows={4} /></Field></div></>}
      {!studentFields && <><Separator /><Field label="Remise familiale en % (facultatif)"><Input className="max-w-xs" type="number" min={0} max={100} value={(value as ParentForm).discountPercentage} onChange={(event) => updatePerson(value, setter, "discountPercentage", Number(event.target.value))} /></Field></>}
    </div>;
  }

  return <div className="grid min-h-[calc(100vh-12rem)] gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
    <Card className="h-fit xl:sticky xl:top-4">
      <CardHeader><CardTitle>Progression</CardTitle><CardDescription>Un dossier complet en quatre étapes.</CardDescription></CardHeader>
      <CardContent className="space-y-5"><Progress value={((step + 1) / steps.length) * 100} />{steps.map(({ label, icon: Icon }, index) => <div key={label} className={`flex items-center gap-3 rounded-lg border p-3 ${index === step ? "border-primary bg-primary/5" : ""}`}><div className={`rounded-full p-2 ${index <= step ? "bg-primary text-primary-foreground" : "bg-muted"}`}><Icon size={17} /></div><div><p className="font-medium">{label}</p><p className="text-xs text-muted-foreground">Étape {index + 1}</p></div></div>)}</CardContent>
    </Card>

    <Card className="flex min-h-[650px] flex-col">
      <CardHeader className="border-b"><div className="flex items-start justify-between gap-4"><div><CardTitle className="text-2xl">{steps[step].label}</CardTitle><CardDescription className="mt-1">{step === 2 ? "Choisissez la classe demandée ; la parallèle sera attribuée selon les places disponibles." : "Les champs marqués d'un astérisque sont obligatoires."}</CardDescription></div><Badge variant="secondary">{step + 1} / {steps.length}</Badge></div></CardHeader>
      <CardContent className="flex-1 space-y-6 p-6 lg:p-8">
        {step === 0 && <><RadioGroup className="grid gap-3 sm:grid-cols-2" value={studentMode} onValueChange={(value) => { setStudentMode(value as any); setHistoryOutcome(value === "new" ? "new" : "returning"); }}><ModeChoice id="student-new" value="new" title="Nouvel élève" description="Créer son compte et son dossier scolaire." /><ModeChoice id="student-existing" value="existing" title="Ancien élève" description="Retrouver son historique et le réinscrire." /></RadioGroup><Separator />{studentMode === "new" ? renderPersonFields(student, setStudent, true) : <SearchPanel query={studentQuery} setQuery={setStudentQuery} onSearch={searchStudents} placeholder="Nom, email ou téléphone de l'élève">{studentResults.map((item) => { const user = userOf(item); const last = item.classEnrollment?.[0]; return <ResultButton key={item.id} selected={studentId === item.id} onClick={() => chooseStudent(item)} title={`${user?.name ?? ""} ${user?.postnom ?? ""} ${user?.prenom ?? ""}`} subtitle={last ? `Dernière classe : ${last.classe?.nameClasse} — ${last.schoolYear.nameYear}` : "Aucune inscription précédente"} />; })}{studentId && <div className="rounded-lg border bg-muted/30 p-4"><Label className="mb-3 block">Situation de l'élève</Label><div className="flex flex-wrap gap-2"><Button variant={historyOutcome === "passed" ? "default" : "outline"} onClick={() => applyHistory("passed")}>Réussi</Button><Button variant={historyOutcome === "failed" ? "default" : "outline"} onClick={() => applyHistory("failed")}>Échoué</Button><Button variant={historyOutcome === "returning" ? "default" : "outline"} onClick={() => applyHistory("returning")}>Retour après absence</Button></div></div>}</SearchPanel>}</>}
        {step === 1 && <><RadioGroup className="grid gap-3 sm:grid-cols-2" value={parentMode} onValueChange={(value) => setParentMode(value as any)}><ModeChoice id="parent-new" value="new" title="Nouveau parent / tuteur" description="Créer le compte du responsable." /><ModeChoice id="parent-existing" value="existing" title="Parent existant" description="Lier l'élève à un responsable connu." /></RadioGroup><Separator />{parentMode === "new" ? renderPersonFields(parent, setParent) : <SearchPanel query={parentQuery} setQuery={setParentQuery} onSearch={searchParents} placeholder="Nom, email ou téléphone du parent">{parentResults.map((item) => { const user = userOf(item); return <ResultButton key={item.id} selected={parentId === item.id} onClick={() => setParentId(item.id)} title={`${user?.name ?? ""} ${user?.postnom ?? ""} ${user?.prenom ?? ""}`} subtitle={`${user?.telephone ?? "Sans téléphone"} — ${user?.email ?? "Sans email"}`} />; })}</SearchPanel>}</>}
        {step === 2 && <div className="space-y-6">{loadingOptions ? <p className="text-muted-foreground">Chargement des classes…</p> : <><div className="grid gap-5 lg:grid-cols-3"><Field label="Année scolaire *"><Select value={schoolYearId} onValueChange={setSchoolYearId}><SelectTrigger><SelectValue placeholder="Choisir l'année" /></SelectTrigger><SelectContent>{options.schoolYears.map((year: any) => <SelectItem key={year.id} value={year.id}>{year.nameYear}{year.isCurrentYear ? " — actuelle" : ""}</SelectItem>)}</SelectContent></Select></Field><Field label="Classe / niveau demandé *"><Select value={level} onValueChange={(value) => { setLevel(value); setOptionId(""); }}><SelectTrigger><SelectValue placeholder="Choisir la classe" /></SelectTrigger><SelectContent>{options.levels.map((item: string) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="Option"><Select value={optionId || "none"} onValueChange={(value) => setOptionId(value === "none" ? "" : value)}><SelectTrigger><SelectValue placeholder="Aucune option" /></SelectTrigger><SelectContent><SelectItem value="none">Aucune option</SelectItem>{options.options.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.nameOption}</SelectItem>)}</SelectContent></Select></Field></div><Alert><IconSchool className="h-4 w-4" /><AlertTitle>Affectation automatique</AlertTitle><AlertDescription>Le système essayera A, puis B, puis C pour cette classe et cette option.</AlertDescription></Alert><div><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Parallèles configurées</h3><Badge variant="outline">{selectedClasses.length} classe(s)</Badge></div>{!level ? <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Sélectionnez une classe pour voir les parallèles.</p> : selectedClasses.length === 0 ? <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950"><div><p className="font-semibold">Aucune parallèle n'est encore créée</p><p className="mt-1 text-sm">Créez automatiquement la parallèle A pour ce niveau{optionId ? " et cette option" : ""}.</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><Field label="Capacité de la classe"><Input className="w-40 bg-white" type="number" min={1} max={500} value={newClassCapacity} onChange={(event) => setNewClassCapacity(Number(event.target.value))} /></Field><Button disabled={creatingClass} onClick={createNextParallel}>{creatingClass ? "Création…" : "Créer la prochaine parallèle"}</Button></div></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{selectedClasses.map((classe: any) => { const occupied = classe.classEnrollment.filter((item: any) => item.schoolYearId === schoolYearId).length; const full = classe.capacity !== null && occupied >= classe.capacity; return <div key={classe.id} className="rounded-lg border p-4"><div className="flex items-center justify-between"><b>{classe.nameClasse}</b><Badge variant={full ? "destructive" : "secondary"}>{full ? "Pleine" : "Disponible"}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{occupied} inscription(s) / {classe.capacity ?? "capacité non définie"}</p>{classe.capacity ? <Progress className="mt-3" value={Math.min(100, occupied / classe.capacity * 100)} /> : null}</div>; })}</div>}</div></>}</div>}
        {step === 3 && <div className="space-y-6"><Alert><IconCheck className="h-4 w-4" /><AlertTitle>Dossier prêt à être enregistré</AlertTitle><AlertDescription>Vérifiez les informations avant la création définitive.</AlertDescription></Alert><div className="grid gap-4 md:grid-cols-2"><Summary title="Élève" lines={[studentMode === "new" ? `${student.name} ${student.postnom} ${student.prenom}` : "Élève existant", studentMode === "new" ? student.email : studentId, studentMode === "new" ? `Catégorie : ${student.category}` : `Situation : ${historyOutcome}`]} /><Summary title="Parent / tuteur" lines={[parentMode === "new" ? `${parent.name} ${parent.postnom} ${parent.prenom}` : "Parent existant", parentMode === "new" ? parent.telephone : parentId, parentMode === "new" && parent.discountPercentage ? `Remise : ${parent.discountPercentage}%` : "Sans remise"]} /><Summary title="Scolarité" lines={[options.schoolYears.find((item: any) => item.id === schoolYearId)?.nameYear ?? "Année non choisie", `Classe demandée : ${level}`, options.options.find((item: any) => item.id === optionId)?.nameOption ?? "Sans option"]} /><Summary title="Affectation" lines={["Première parallèle disponible", "Capacité vérifiée à l'enregistrement", "Inscription protégée contre les doublons"]} /></div></div>}
      </CardContent>
      <div className="flex items-center justify-between border-t p-6"><Button variant="outline" disabled={step === 0 || loading} onClick={() => setStep((current) => current - 1)}><IconArrowLeft className="mr-2 h-4 w-4" />Précédent</Button>{step < 3 ? <Button onClick={goNext}>Continuer<IconArrowRight className="ml-2 h-4 w-4" /></Button> : <Button disabled={loading} onClick={submit}>{loading ? "Enregistrement…" : "Confirmer l'inscription"}</Button>}</div>
    </Card>
  </div>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <div className={`space-y-2 ${className}`}><Label>{label}</Label>{children}</div>; }
function ModeChoice({ id, value, title, description }: { id: string; value: string; title: string; description: string }) { return <Label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted/40"><RadioGroupItem id={id} value={value} className="mt-1" /><span><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm font-normal text-muted-foreground">{description}</span></span></Label>; }
function SearchPanel({ query, setQuery, onSearch, placeholder, children }: { query: string; setQuery: (value: string) => void; onSearch: () => void; placeholder: string; children: React.ReactNode }) { return <div className="space-y-4"><div className="flex gap-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSearch(); }} placeholder={placeholder} /><Button onClick={onSearch}><IconSearch className="mr-2 h-4 w-4" />Rechercher</Button></div><div className="grid gap-2">{children}</div></div>; }
function ResultButton({ selected, onClick, title, subtitle }: { selected: boolean; onClick: () => void; title: string; subtitle: string }) { return <button type="button" onClick={onClick} className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : ""}`}><div className="flex items-center justify-between gap-4"><div><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>{selected && <IconCheck className="text-primary" />}</div></button>; }
function Summary({ title, lines }: { title: string; lines: string[] }) { return <Card><CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">{lines.map((line) => <p key={line}>{line}</p>)}</CardContent></Card>; }
