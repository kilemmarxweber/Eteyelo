"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type ChildNameValues = {
  nom: string;
  postnom: string;
  prenom: string;
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
};

function dashToEmpty(value: string) {
  return value === "-" ? "" : value;
}

export function EditChildNameForm({
  studentId,
  initialValues,
}: {
  studentId: string;
  initialValues: ChildNameValues;
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
        <ResponsiveDialogContent size="md" className="flex flex-col gap-0 overflow-hidden p-0">
          <ResponsiveDialogHeader className="shrink-0 border-b px-4 py-3 text-left sm:px-5">
            <ResponsiveDialogTitle>{t("editChildNameTitle")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("editChildNameDesc")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 sm:px-5">
            <div className="space-y-1.5">
              <Label htmlFor="child-nom">{tCommon("person.lastName")}</Label>
              <Input
                id="child-nom"
                value={values.nom}
                onChange={(event) =>
                  setValues((current) => ({ ...current, nom: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="child-postnom">{tCommon("person.postnom")}</Label>
              <Input
                id="child-postnom"
                value={values.postnom}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    postnom: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="child-prenom">{tCommon("person.firstName")}</Label>
              <Input
                id="child-prenom"
                value={values.prenom}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    prenom: event.target.value,
                  }))
                }
              />
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
          size="md"
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
  };
}
