"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import Link from "next/link";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Building2, KeyRound, Shield, UserRound } from "lucide-react";
import { toast } from "sonner";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { isCycleGlobalRole } from "@/lib/auth/cycle-global-roles";
import { memberHasImplicitAllBranchAccess } from "@/lib/auth/role-labels";
import { formatPersonFullName } from "@/lib/person-full-name";
import { MAX_IMAGE_UPLOAD_BYTES, uploadFile } from "@/lib/upload-file";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getOrganizationMemberAction,
  listOrganizationMemberAssignedBranchesAction,
  removeOrganizationMemberAction,
  updateOrganizationMemberAction,
} from "../../actions";
import {
  MemberBranchPicker,
  type MemberBranchOption,
} from "../../branch-picker";
import {
  MemberFormLayout,
  MemberFormSection,
  MemberFormSummaryRow,
  memberFieldClass,
} from "../../member-form-section";
import { MemberPhotoField } from "../../member-photo-field";
import { ResetUsersDialog } from "../../../branches/(no-layout)/[branchId]/student/components/reset-users-dialog";
import { DateOfBirthPicker } from "@/components/date-of-birth-picker";
import { useAssignableOrgRoles } from "../../use-assignable-org-roles";
import { ORG_ROLE } from "@/lib/permissions";

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    email: string | null;
    name: string;
    postnom: string | null;
    prenom: string | null;
    image: string | null;
    dateOfBirth: Date | null;
  };
};

type Props = {
  organizationId: string;
  memberId: string;
  branches: MemberBranchOption[];
};

export function EditMemberForm({ organizationId, memberId, branches }: Props) {
  const router = useRouter();
  const { roles: orgRoles } = useAssignableOrgRoles(organizationId);
  const [member, setMember] = useState<MemberRow | null | undefined>(undefined);
  const [role, setRole] = useState<string>(ORG_ROLE.GESTIONNAIRE);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [branchCycles, setBranchCycles] = useState<Record<string, string[]>>(
    {},
  );
  const [branchError, setBranchError] = useState<string | undefined>();
  const [cyclesError, setCyclesError] = useState<string | undefined>();
  const [nom, setNom] = useState("");
  const [postnom, setPostnom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [dobError, setDobError] = useState<string | undefined>();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [pendingRemove, startRemove] = useTransition();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const implicitAllBranches = memberHasImplicitAllBranchAccess(role);
  const showCycles = !implicitAllBranches && !isCycleGlobalRole(role);

  const load = useCallback(async () => {
    try {
      const [memberRes, assignedRes] = await Promise.all([
        getOrganizationMemberAction(organizationId, memberId),
        listOrganizationMemberAssignedBranchesAction(organizationId, memberId),
      ]);
      if (!memberRes.ok) {
        toast.error(memberRes.message);
        setMember(null);
        return;
      }
      const found = memberRes.member;
      setMember(found);
      setNom(found.user.name ?? "");
      setPostnom(found.user.postnom ?? "");
      setPrenom(found.user.prenom ?? "");
      setDateOfBirth(
        found.user.dateOfBirth ? new Date(found.user.dateOfBirth) : undefined,
      );
      setDobError(undefined);
      setPhotoFile(null);
      setPhotoPreview(found.user.image);
      const initialEmail =
        found.user.archivedEmail ||
        (found.user.email?.startsWith("archived.")
          ? found.user.email.replace(/^archived\./, "")
          : found.user.email ?? "");
      setEmail(initialEmail);
      setEmailError(undefined);
      setNameError(undefined);
      if (assignedRes.ok) {
        setBranchIds(assignedRes.branchIds);
        const cycles = { ...assignedRes.branchCycles };
        for (const id of assignedRes.branchIds) {
          const branch = branches.find((b) => b.id === id);
          if (
            branch &&
            !branch.isMultiCycle &&
            branch.cycles[0] &&
            !(cycles[id]?.length)
          ) {
            cycles[id] = [branch.cycles[0].value];
          }
        }
        setBranchCycles(cycles);
      } else {
        toast.error(assignedRes.message);
      }
      const primary =
        found.role.split(",")[0]?.trim() ?? ORG_ROLE.GESTIONNAIRE;
      setRole(primary);
    } catch {
      toast.error("Erreur réseau.");
      setMember(null);
    }
  }, [organizationId, memberId, branches]);

  useEffect(() => {
    void load();
  }, [load]);

  const listHref = `/admin/organizations/${organizationId}/members`;
  const busy = pending || pendingRemove;
  const fullName = formatPersonFullName({ name: nom, postnom, prenom });

  function handlePickPhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image (JPEG, PNG, WebP…).");
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.error("Image trop volumineuse (max. 5 Mo).");
      return;
    }
    setPhotoPreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setPhotoFile(file);
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setEmailError("Adresse email invalide.");
      return;
    }
    if (
      nom.trim().length < 2 ||
      postnom.trim().length < 2 ||
      prenom.trim().length < 2
    ) {
      setNameError("Nom, postnom et prénom sont requis (2 caractères min.).");
      return;
    }
    if (!dateOfBirth || Number.isNaN(dateOfBirth.getTime())) {
      setDobError("Veuillez saisir la date de naissance.");
      return;
    }
    if (!implicitAllBranches && branchIds.length === 0) {
      setBranchError("Sélectionnez au moins une branche.");
      return;
    }
    if (showCycles) {
      for (const branchId of branchIds) {
        const branch = branches.find((b) => b.id === branchId);
        if (!branch?.isMultiCycle) continue;
        if (!branchCycles[branchId]?.length) {
          const msg = `Sélectionnez au moins un cycle pour « ${branch.name} ».`;
          setCyclesError(msg);
          toast.error(msg);
          return;
        }
      }
    }
    setEmailError(undefined);
    setNameError(undefined);
    setDobError(undefined);
    setBranchError(undefined);
    setCyclesError(undefined);
    startTransition(async () => {
      let image = member?.user.image ?? "";
      if (photoFile) {
        const uploaded = await uploadFile(photoFile);
        if (!uploaded.ok) {
          toast.error(uploaded.message);
          return;
        }
        image = uploaded.url;
      }
      const res = await updateOrganizationMemberAction({
        organizationId,
        memberId,
        orgRole: role,
        branchIds: implicitAllBranches ? [] : branchIds,
        branchCycles: implicitAllBranches ? {} : branchCycles,
        email: nextEmail,
        nom: nom.trim(),
        postnom: postnom.trim(),
        prenom: prenom.trim(),
        image,
        dateOfBirth,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Membre mis à jour.");
      router.push(listHref);
      router.refresh();
    });
  }

  function onRemove() {
    if (!member) return;
    startRemove(async () => {
      const res = await removeOrganizationMemberAction({
        organizationId,
        memberId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Membre retiré.");
      router.push(listHref);
      router.refresh();
    });
  }

  if (member === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl border border-border bg-muted/40"
          />
        ))}
      </div>
    );
  }

  if (member === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Membre introuvable.</p>
        <Button variant="outline" asChild>
          <Link href={listHref}>Retour à la liste</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={onSave}>
        <MemberFormLayout
          aside={
            <>
              <Card className="gap-0 py-0 shadow-sm">
                <CardHeader className="border-b border-border/80 py-4">
                  <CardTitle className="leading-snug break-words">
                    {fullName || member.user.name}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="secondary">{orgRoleLabel(role)}</Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 py-4 text-sm">
                  <MemberFormSummaryRow
                    label="Email"
                    value={email.trim() || "—"}
                  />
                  <MemberFormSummaryRow
                    label="Établissements"
                    value={
                      implicitAllBranches
                        ? "Tous (propriétaire)"
                        : branchIds.length === 0
                          ? "Aucun"
                          : `${branchIds.length} sélectionné${branchIds.length > 1 ? "s" : ""}`
                    }
                  />
                </CardContent>
              </Card>
              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  disabled={busy || (!implicitAllBranches && branches.length === 0)}
                  className="h-11 w-full"
                >
                  {pending ? "Mise à jour…" : "Mettre à jour"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  disabled={busy}
                  asChild
                >
                  <Link href={listHref}>Annuler</Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  disabled={busy}
                  onClick={() => setShowResetDialog(true)}
                >
                  <KeyRound className="size-4" />
                  Réinitialiser le mot de passe
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11 w-full"
                  disabled={busy}
                  onClick={() => setConfirmRemove(true)}
                >
                  {pendingRemove ? "…" : "Retirer de l’organisation"}
                </Button>
              </div>
            </>
          }
        >
          <MemberFormSection
            icon={UserRound}
            title="Identité"
            description="Nom, postnom, prénom et photo, comme pour un élève. L’email de connexion doit rester unique."
          >
            <div className="grid gap-4">
              <MemberPhotoField
                previewUrl={photoPreview}
                onPickFile={handlePickPhoto}
                disabled={busy}
                fullName={fullName}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-nom">Nom</Label>
                  <Input
                    id="edit-nom"
                    value={nom}
                    onChange={(e) => {
                      setNom(e.target.value);
                      if (nameError) setNameError(undefined);
                    }}
                    autoComplete="family-name"
                    placeholder="Ex. Kabila"
                    disabled={busy}
                    className={memberFieldClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-postnom">Postnom</Label>
                  <Input
                    id="edit-postnom"
                    value={postnom}
                    onChange={(e) => {
                      setPostnom(e.target.value);
                      if (nameError) setNameError(undefined);
                    }}
                    placeholder="Ex. Kabange"
                    disabled={busy}
                    className={memberFieldClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-prenom">Prénom</Label>
                  <Input
                    id="edit-prenom"
                    value={prenom}
                    onChange={(e) => {
                      setPrenom(e.target.value);
                      if (nameError) setNameError(undefined);
                    }}
                    autoComplete="given-name"
                    placeholder="Ex. Marie"
                    disabled={busy}
                    className={memberFieldClass}
                  />
                </div>
              </div>
              {nameError ? (
                <p className="text-xs text-destructive">{nameError}</p>
              ) : null}
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-dob">Date de naissance</Label>
                <DateOfBirthPicker
                  id="edit-dob"
                  value={dateOfBirth}
                  onChange={(date) => {
                    setDateOfBirth(date);
                    if (dobError) setDobError(undefined);
                  }}
                  disabled={busy}
                  className={memberFieldClass}
                />
                {dobError ? (
                  <p className="text-xs text-destructive">{dobError}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(undefined);
                  }}
                  disabled={busy}
                  className={memberFieldClass}
                />
                {emailError ? (
                  <p className="text-xs text-destructive">{emailError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sert à la connexion et à l’envoi du mot de passe.
                  </p>
                )}
              </div>
            </div>
          </MemberFormSection>

          <MemberFormSection
            icon={Shield}
            title="Accès"
            description={
              implicitAllBranches
                ? "Le propriétaire accède à tous les établissements et à tous les menus, sans affectation de branche."
                : "Le rôle détermine les droits dans l’organisation."
            }
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-role">Rôle dans l’organisation</Label>
              <select
                id="edit-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={busy}
                className={memberFieldClass + " border bg-background px-3"}
              >
                {orgRoles.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.label}
                  </option>
                ))}
                {role && !orgRoles.some((item) => item.slug === role) ? (
                  <option value={role}>{orgRoleLabel(role)}</option>
                ) : null}
              </select>
            </div>
          </MemberFormSection>

          {implicitAllBranches ? null : (
            <MemberFormSection
              icon={Building2}
              title="Affectation"
              description={
                showCycles
                  ? "Cochez les établissements, puis le(s) cycle(s) pour chaque établissement multi-cycle."
                  : "Cochez les établissements auxquels ce membre peut accéder."
              }
            >
              <MemberBranchPicker
                branches={branches}
                value={branchIds}
                onChange={(ids) => {
                  setBranchIds(ids);
                  if (ids.length > 0) setBranchError(undefined);
                }}
                branchCycles={branchCycles}
                onBranchCyclesChange={(next) => {
                  setBranchCycles(next);
                  if (cyclesError) setCyclesError(undefined);
                }}
                showCycles={showCycles}
                disabled={busy}
                error={branchError}
                cyclesError={cyclesError}
              />
            </MemberFormSection>
          )}
        </MemberFormLayout>
      </form>

      <ResetUsersDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        email={email.trim() || member.user.email || ""}
        organizationId={organizationId}
        showTrigger={false}
      />

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Retirer {fullName || member.user.name} de l’organisation ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Le compte sera retiré de cette organisation. Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingRemove}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingRemove}
              onClick={onRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pendingRemove ? "…" : "Retirer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
