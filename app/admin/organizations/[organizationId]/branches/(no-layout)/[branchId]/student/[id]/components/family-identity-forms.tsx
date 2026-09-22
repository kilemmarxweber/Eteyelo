"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useAppTransition } from "@/hooks/use-app-transition";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  updateOwnChildPersonalNameAction,
  updateOwnParentPersonalInfoAction,
} from "../../student.action";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const BLOOD_GROUP_UNSET = "__none__";

export type ChildPersonalValues = {
  nom: string;
  postnom: string;
  prenom: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationalite: string;
  autreNationalite: string;
  territoireAutreNationalite: string;
  langue: string;
  groupeSanguin: string;
  allergies: string;
};

type GuardianValues = {
  nom: string;
  postnom: string;
  prenom: string;
  telephone: string;
  email: string;
  address: string;
  profession: string;
  tuteurNom: string;
  adresseTuteur: string;
  nomMere: string;
  professionMere: string;
  provinceOrigine: string;
  territoireOrigine: string;
  secteurOrigine: string;
  villageOrigine: string;
};

function dashToEmpty(value: string) {
  return value === "-" ? "" : value;
}

export function EditChildNameForm({
  studentId,
  initialValues,
}: {
  studentId: string;
  initialValues: ChildPersonalValues;
}) {
  const t = useTranslations("users.students.profile");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useAppTransition();
  const initialRef = useRef(initialValues);
  initialRef.current = initialValues;

  useEffect(() => {
    if (open) setValues(initialRef.current);
  }, [open]);

  function update<K extends keyof ChildPersonalValues>(
    key: K,
    value: ChildPersonalValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const [result, error] = await updateOwnChildPersonalNameAction({
        studentId,
        ...values,
      });
      if (error || !result?.ok) {
        toast.error(error?.message ?? result?.message ?? t("saveFailed"));
        return;
      }
      toast.success(result.message);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-3.5" />
        <span className="hidden sm:inline">{t("editChildName")}</span>
        <span className="sm:hidden">{t("edit")}</span>
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent
          size="lg"
          className="flex max-h-[min(94dvh,52rem)] flex-col gap-0 overflow-hidden p-0"
        >
          <ResponsiveDialogHeader className="shrink-0 border-b px-4 py-3 text-left sm:px-5">
            <ResponsiveDialogTitle>{t("editChildNameTitle")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("editChildNameDesc")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 sm:px-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="child-nom">{tCommon("person.lastName")}</Label>
                <Input
                  id="child-nom"
                  value={values.nom}
                  onChange={(event) => update("nom", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="child-postnom">{tCommon("person.postnom")}</Label>
                <Input
                  id="child-postnom"
                  value={values.postnom}
                  onChange={(event) => update("postnom", event.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="child-prenom">{tCommon("person.firstName")}</Label>
                <Input
                  id="child-prenom"
                  value={values.prenom}
                  onChange={(event) => update("prenom", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="child-birth-date">{tCommon("person.birthDate")}</Label>
                <Input
                  id="child-birth-date"
                  type="date"
                  value={values.dateOfBirth}
                  onChange={(event) => update("dateOfBirth", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="child-birth-place">{tCommon("person.birthPlace")}</Label>
                <Input
                  id="child-birth-place"
                  value={values.placeOfBirth}
                  onChange={(event) => update("placeOfBirth", event.target.value)}
                  placeholder={t("birthPlacePlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="child-nationality">{t("nationality")}</Label>
                <Input
                  id="child-nationality"
                  value={values.nationalite}
                  onChange={(event) => update("nationalite", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="child-other-nationality">{t("otherNationality")}</Label>
                <Input
                  id="child-other-nationality"
                  value={values.autreNationalite}
                  onChange={(event) =>
                    update("autreNationalite", event.target.value)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="child-territory">{t("otherNationalityTerritory")}</Label>
                <Input
                  id="child-territory"
                  value={values.territoireAutreNationalite}
                  onChange={(event) =>
                    update("territoireAutreNationalite", event.target.value)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="child-language">{t("language")}</Label>
                <Input
                  id="child-language"
                  value={values.langue}
                  onChange={(event) => update("langue", event.target.value)}
                  placeholder={t("languagePlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="child-blood">{t("bloodGroup")}</Label>
                <Select
                  value={values.groupeSanguin || BLOOD_GROUP_UNSET}
                  onValueChange={(value) =>
                    update(
                      "groupeSanguin",
                      value === BLOOD_GROUP_UNSET ? "" : value,
                    )
                  }
                >
                  <SelectTrigger id="child-blood">
                    <SelectValue placeholder={t("bloodGroupUnset")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={BLOOD_GROUP_UNSET}>
                      {t("bloodGroupUnset")}
                    </SelectItem>
                    {BLOOD_GROUPS.map((group) => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="child-allergies">{t("allergies")}</Label>
                <Input
                  id="child-allergies"
                  value={values.allergies}
                  onChange={(event) => update("allergies", event.target.value)}
                  placeholder={t("allergiesPlaceholder")}
                />
              </div>
            </div>
          </div>
          <ResponsiveDialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="button" onClick={save} disabled={isPending} className="gap-2">
              <Save className="size-4" />
              {isPending ? t("saving") : tCommon("save")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}

export function EditGuardianInfoForm({
  studentId,
  initialValues,
}: {
  studentId: string;
  initialValues: GuardianValues;
}) {
  const t = useTranslations("users.students.profile");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useAppTransition();
  const initialRef = useRef(initialValues);
  initialRef.current = initialValues;

  useEffect(() => {
    if (open) setValues(initialRef.current);
  }, [open]);

  function update<K extends keyof GuardianValues>(key: K, value: GuardianValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const [result, error] = await updateOwnParentPersonalInfoAction({
        studentId,
        ...values,
      });
      if (error || !result?.ok) {
        toast.error(error?.message ?? result?.message ?? t("saveFailed"));
        return;
      }
      toast.success(result.message);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-3.5" />
        <span className="hidden sm:inline">{t("editGuardian")}</span>
        <span className="sm:hidden">{t("edit")}</span>
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent
          size="lg"
          className="flex max-h-[min(94dvh,52rem)] flex-col gap-0 overflow-hidden p-0"
        >
          <ResponsiveDialogHeader className="shrink-0 border-b px-4 py-3 text-left sm:px-5">
            <ResponsiveDialogTitle>{t("editGuardianTitle")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("editGuardianDesc")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="guardian-nom">{tCommon("person.lastName")}</Label>
                <Input
                  id="guardian-nom"
                  value={values.nom}
                  onChange={(event) => update("nom", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardian-postnom">{tCommon("person.postnom")}</Label>
                <Input
                  id="guardian-postnom"
                  value={values.postnom}
                  onChange={(event) => update("postnom", event.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="guardian-prenom">{tCommon("person.firstName")}</Label>
                <Input
                  id="guardian-prenom"
                  value={values.prenom}
                  onChange={(event) => update("prenom", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardian-phone">{tCommon("person.phone")}</Label>
                <Input
                  id="guardian-phone"
                  type="tel"
                  value={values.telephone}
                  onChange={(event) => update("telephone", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardian-email">{tCommon("person.email")}</Label>
                <Input
                  id="guardian-email"
                  type="email"
                  value={values.email}
                  onChange={(event) => update("email", event.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="guardian-address">{tCommon("person.address")}</Label>
                <Input
                  id="guardian-address"
                  value={values.address}
                  onChange={(event) => update("address", event.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="guardian-profession">{t("profession")}</Label>
                <Input
                  id="guardian-profession"
                  value={values.profession}
                  onChange={(event) => update("profession", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardian-mother">{t("motherName")}</Label>
                <Input
                  id="guardian-mother"
                  value={values.nomMere}
                  onChange={(event) => update("nomMere", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardian-mother-job">{t("motherProfession")}</Label>
                <Input
                  id="guardian-mother-job"
                  value={values.professionMere}
                  onChange={(event) => update("professionMere", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardian-tutor">{t("tutorName")}</Label>
                <Input
                  id="guardian-tutor"
                  value={values.tuteurNom}
                  onChange={(event) => update("tuteurNom", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardian-tutor-address">{t("tutorAddress")}</Label>
                <Input
                  id="guardian-tutor-address"
                  value={values.adresseTuteur}
                  onChange={(event) => update("adresseTuteur", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardian-province">{t("originProvince")}</Label>
                <Input
                  id="guardian-province"
                  value={values.provinceOrigine}
                  onChange={(event) => update("provinceOrigine", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardian-territory">{t("originTerritory")}</Label>
                <Input
                  id="guardian-territory"
                  value={values.territoireOrigine}
                  onChange={(event) =>
                    update("territoireOrigine", event.target.value)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardian-sector">{t("originSector")}</Label>
                <Input
                  id="guardian-sector"
                  value={values.secteurOrigine}
                  onChange={(event) => update("secteurOrigine", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardian-village">{t("originVillage")}</Label>
                <Input
                  id="guardian-village"
                  value={values.villageOrigine}
                  onChange={(event) => update("villageOrigine", event.target.value)}
                />
              </div>
            </div>
          </div>
          <ResponsiveDialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="button" onClick={save} disabled={isPending} className="gap-2">
              <Save className="size-4" />
              {isPending ? t("saving") : tCommon("save")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}

export function childFormValuesFromProfile(profile: {
  nom: string;
  postnom: string;
  prenom: string;
  dateOfBirthInput: string;
  placeOfBirth: string;
  nationaliteEdit: string;
  autreNationalite: string;
  territoireAutreNationalite: string;
  langue: string;
  bloodGroup: string;
  allergies: string;
}): ChildPersonalValues {
  return {
    nom: profile.nom,
    postnom: profile.postnom,
    prenom: profile.prenom,
    dateOfBirth: profile.dateOfBirthInput,
    placeOfBirth: dashToEmpty(profile.placeOfBirth),
    nationalite: profile.nationaliteEdit,
    autreNationalite: dashToEmpty(profile.autreNationalite),
    territoireAutreNationalite: dashToEmpty(profile.territoireAutreNationalite),
    langue: dashToEmpty(profile.langue),
    groupeSanguin: dashToEmpty(profile.bloodGroup),
    allergies:
      profile.allergies === "-" || profile.allergies === "Aucune"
        ? ""
        : profile.allergies,
  };
}

export function guardianFormValuesFromProfile(profile: {
  parentNom: string;
  parentPostnom: string;
  parentPrenom: string;
  parentPhone: string;
  parentEmail: string;
  parentAddress: string;
  parentProfession: string;
  tuteurNom: string;
  adresseTuteur: string;
  nomMere: string;
  professionMere: string;
  provinceOrigine: string;
  territoireOrigine: string;
  secteurOrigine: string;
  villageOrigine: string;
}): GuardianValues {
  return {
    nom: profile.parentNom,
    postnom: profile.parentPostnom,
    prenom: profile.parentPrenom,
    telephone: dashToEmpty(profile.parentPhone),
    email: dashToEmpty(profile.parentEmail),
    address: dashToEmpty(profile.parentAddress),
    profession: dashToEmpty(profile.parentProfession),
    tuteurNom: dashToEmpty(profile.tuteurNom),
    adresseTuteur: dashToEmpty(profile.adresseTuteur),
    nomMere: dashToEmpty(profile.nomMere),
    professionMere: dashToEmpty(profile.professionMere),
    provinceOrigine: dashToEmpty(profile.provinceOrigine),
    territoireOrigine: dashToEmpty(profile.territoireOrigine),
    secteurOrigine: dashToEmpty(profile.secteurOrigine),
    villageOrigine: dashToEmpty(profile.villageOrigine),
  };
}
