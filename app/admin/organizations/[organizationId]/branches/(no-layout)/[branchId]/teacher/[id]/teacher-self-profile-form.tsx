"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Save } from "lucide-react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";
import { useAppTransition } from "@/hooks/use-app-transition";
import { updateTeacherIdentityAction } from "./teacher-application.action";
import { TeacherProfileDocuments } from "./teacher-profile-documents";
import type { TeacherProfileDocument } from "./teacher-profile-types";

type IdentityValues = {
  nom: string;
  postnom: string;
  prenom: string;
  sexe: "M" | "F";
  dateOfBirth: string;
  telephone: string;
  email: string;
  address: string;
};

type Props = {
  teacherId: string;
  initialValues: IdentityValues;
  documents: TeacherProfileDocument[];
};

export function TeacherSelfProfileForm({
  teacherId,
  initialValues,
  documents,
}: Props) {
  const t = useTranslations("users.teachers.selfProfile");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useAppTransition();
  const initialValuesRef = useRef(initialValues);
  initialValuesRef.current = initialValues;

  useEffect(() => {
    if (open) setValues(initialValuesRef.current);
  }, [open]);

  function update<K extends keyof IdentityValues>(
    key: K,
    value: IdentityValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const [result, error] = await updateTeacherIdentityAction({
        teacherId,
        ...values,
      });
      if (error || !result?.ok) {
        toast.error(error?.message ?? t("updateFailed"));
        return;
      }
      toast.success(result.message);
      setOpen(false);
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
        <span className="hidden sm:inline">{t("editIdentity")}</span>
        <span className="sm:hidden">{t("edit")}</span>
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent
          size="md"
          className="flex w-[min(calc(100vw-1rem),42rem)] max-h-[min(94dvh,52rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[min(calc(100vw-2rem),42rem)] sm:max-h-[min(90dvh,48rem)]"
        >
          <ResponsiveDialogHeader className="shrink-0 border-b px-4 py-3 text-left sm:px-5">
            <ResponsiveDialogTitle>{t("title")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("description")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="teacher-self-nom">{tCommon("person.lastName")}</Label>
              <Input
                id="teacher-self-nom"
                value={values.nom}
                onChange={(event) => update("nom", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teacher-self-postnom">{tCommon("person.postnom")}</Label>
              <Input
                id="teacher-self-postnom"
                value={values.postnom}
                onChange={(event) => update("postnom", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teacher-self-prenom">{tCommon("person.firstName")}</Label>
              <Input
                id="teacher-self-prenom"
                value={values.prenom}
                onChange={(event) => update("prenom", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{tCommon("person.gender")}</Label>
              <Select
                value={values.sexe}
                onValueChange={(value: "M" | "F") => update("sexe", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">{tCommon("person.male")}</SelectItem>
                  <SelectItem value="F">{tCommon("person.female")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teacher-self-birth">{tCommon("person.birthDate")}</Label>
              <Input
                id="teacher-self-birth"
                type="date"
                value={values.dateOfBirth}
                onChange={(event) => update("dateOfBirth", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teacher-self-phone">{tCommon("person.phone")}</Label>
              <Input
                id="teacher-self-phone"
                type="tel"
                inputMode="tel"
                value={values.telephone}
                onChange={(event) => update("telephone", event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="teacher-self-email">{tCommon("person.email")}</Label>
              <Input
                id="teacher-self-email"
                type="email"
                inputMode="email"
                value={values.email}
                onChange={(event) => update("email", event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="teacher-self-address">{tCommon("person.address")}</Label>
              <Input
                id="teacher-self-address"
                value={values.address}
                onChange={(event) => update("address", event.target.value)}
              />
            </div>
          </div>

          <TeacherProfileDocuments
            teacherId={teacherId}
            documents={documents}
            canManage
            variant="embedded"
          />
          </div>

          <ResponsiveDialogFooter className="shrink-0 gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-5">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={isPending}
              className="w-full gap-2 sm:w-auto"
            >
              <Save className="size-4" />
              {isPending ? t("saving") : tCommon("save")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
