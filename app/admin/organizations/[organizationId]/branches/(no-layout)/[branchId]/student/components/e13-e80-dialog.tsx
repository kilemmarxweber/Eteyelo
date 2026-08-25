"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IStudent } from "@/src/interfaces/Student";
import { saveStudentExamCodesAction } from "../student.action";
import { isExamCodesClass } from "@/lib/exam-export-meta";
import { useSession } from "@/lib/auth-client";

type E13E80DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: IStudent;
  onSuccess?: () => void;
};

function enrollmentLabel(enrollment: {
  schoolYearName: string;
  className?: string | null;
  classCode?: string | null;
}) {
  const classe = enrollment.className || enrollment.classCode;
  return classe
    ? `${enrollment.schoolYearName} · ${classe}`
    : enrollment.schoolYearName;
}

export function E13E80Dialog({
  open,
  onOpenChange,
  student,
  onSuccess,
}: E13E80DialogProps) {
  const { data: session } = useSession();
  const typebranch = session?.branch?.typebranch;
  const educationSystem = (
    session?.branch as { educationSystem?: string } | undefined
  )?.educationSystem;
  const enrollments = React.useMemo(
    () =>
      (student.enrollments ?? []).filter((enrollment) =>
        isExamCodesClass({
          cycle: enrollment.classCycle,
          typebranch,
          level: enrollment.classLevel,
          className: enrollment.className,
          classCode: enrollment.classCode,
          educationSystem,
        }),
      ),
    [educationSystem, student.enrollments, typebranch],
  );
  const defaultYearId =
    enrollments.find((item) => item.schoolYearId === student.schoolYearId)
      ?.schoolYearId ??
    enrollments.find((item) => item.schoolYearId)?.schoolYearId ??
    "";

  const [schoolYearId, setSchoolYearId] = React.useState(defaultYearId);
  const [e13, setE13] = React.useState("");
  const [e80, setE80] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const yearId =
      enrollments.find((item) => item.schoolYearId === student.schoolYearId)
        ?.schoolYearId ??
      enrollments.find((item) => item.schoolYearId)?.schoolYearId ??
      "";
    setSchoolYearId(yearId);
    const enrollment =
      enrollments.find((item) => item.schoolYearId === yearId) ?? null;
    setE13(enrollment?.e13 ?? student.e13 ?? "");
    setE80(enrollment?.e80 ?? student.e80 ?? "");
  }, [open, student, enrollments]);

  React.useEffect(() => {
    if (!open || !schoolYearId) return;
    const enrollment = enrollments.find(
      (item) => item.schoolYearId === schoolYearId,
    );
    setE13(enrollment?.e13 ?? "");
    setE80(enrollment?.e80 ?? "");
  }, [schoolYearId, open, enrollments]);

  const currentEnrollment = enrollments.find(
    (item) => item.schoolYearId === schoolYearId,
  );
  const alreadySaved = Boolean(
    currentEnrollment?.e13 || currentEnrollment?.e80,
  );
  const studentName = [student.nom, student.postnom, student.prenom]
    .filter(Boolean)
    .join(" ");

  async function handleSave() {
    if (!schoolYearId || !currentEnrollment) {
      toast.error("Sélectionnez une année scolaire de classe terminale");
      return;
    }
    if (!e13.trim() && !e80.trim()) {
      toast.error("Saisissez au moins E13 ou E80");
      return;
    }

    setSaving(true);
    try {
      const [result, error] = await saveStudentExamCodesAction({
        studentId: student.id,
        schoolYearId,
        e13,
        e80,
      });
      if (error || !result?.ok) {
        toast.error(error?.message ?? "Enregistrement impossible");
        return;
      }
      toast.success(result.message);
      onSuccess?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        className="gap-0 p-0 sm:max-w-[min(100%,24rem)]"
      >
        <DialogHeader className="space-y-2 border-b px-4 pb-4 pt-5 text-left sm:px-5">
          <DialogTitle className="pr-8 text-base leading-snug sm:text-lg">
            E13 &amp; E80
          </DialogTitle>
          <DialogDescription className="text-pretty text-left text-sm leading-relaxed">
            Codes examen pour{" "}
            <span className="font-medium text-foreground">
              {studentName || "cet élève"}
            </span>
            , par année scolaire.
            {alreadySaved
              ? " Des valeurs existent déjà — l’enregistrement mettra à jour."
              : " Remplissez les champs puis enregistrez."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-4 py-4 sm:px-5">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="exam-year">Année scolaire</Label>
            {enrollments.length > 1 ? (
              <Select value={schoolYearId} onValueChange={setSchoolYearId}>
                <SelectTrigger
                  id="exam-year"
                  className="h-11 w-full min-w-0 max-w-full"
                >
                  <SelectValue placeholder="Choisir l'année" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  className="w-[var(--radix-select-trigger-width)] max-w-[min(100vw-2rem,24rem)]"
                >
                  {enrollments.map((enrollment) => (
                    <SelectItem
                      key={enrollment.schoolYearId}
                      value={enrollment.schoolYearId}
                      className="whitespace-normal py-2.5"
                    >
                      <span className="block break-words text-left leading-snug">
                        {enrollmentLabel(enrollment)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="exam-year"
                className="h-11 w-full min-w-0"
                value={
                  currentEnrollment
                    ? enrollmentLabel(currentEnrollment)
                    : (student.schoolYearName ?? "—")
                }
                disabled
              />
            )}
            {currentEnrollment?.className || currentEnrollment?.classCode ? (
              <p className="truncate text-xs text-muted-foreground">
                Classe :{" "}
                {currentEnrollment.className || currentEnrollment.classCode}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="exam-e13">E13</Label>
              <Input
                id="exam-e13"
                className="h-11 font-mono"
                value={e13}
                onChange={(event) => setE13(event.target.value)}
                placeholder="Code E13"
                autoComplete="off"
              />
            </div>

            <div className="grid min-w-0 gap-2">
              <Label htmlFor="exam-e80">E80</Label>
              <Input
                id="exam-e80"
                className="h-11 font-mono"
                value={e80}
                onChange={(event) => setE80(event.target.value)}
                placeholder="Code E80"
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t px-4 py-3 sm:space-x-0 sm:px-5">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => void handleSave()}
            loading={saving}
            disabled={!schoolYearId || enrollments.length === 0}
          >
            {alreadySaved ? "Mettre à jour" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
