"use client";

import { useEffect, useMemo, useState } from "react";
import { IconArrowsExchange, IconUsersGroup } from "@tabler/icons-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignStudentsToGroupeAction,
  getAssignableGroupesForStudentsAction,
} from "../../brevets/brevet.action";
import type { IStudent } from "@/src/interfaces/Student";

type AtelierGroupeOption = {
  id: string;
  nameClasse: string;
  optionName: string;
  enrolledCount: number;
  capacity: number | null;
  sourceClasseId?: string | null;
  sourceClasseName?: string | null;
};

type AssignGroupeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: IStudent[];
  onSuccess?: () => void;
};

function formatCapacity(enrolledCount: number, capacity: number | null) {
  if (capacity == null) return `${enrolledCount} inscrit(s)`;
  return `${enrolledCount}/${capacity}`;
}

function studentCurrentClasseId(student: IStudent) {
  return (
    student.classeId ??
    student.enrollments?.find((enrollment) => enrollment.classeId)?.classeId ??
    null
  );
}

export function AssignGroupeDialog({
  open,
  onOpenChange,
  students,
  onSuccess,
}: AssignGroupeDialogProps) {
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [groupes, setGroupes] = useState<AtelierGroupeOption[]>([]);
  const [schoolYearName, setSchoolYearName] = useState<string | null>(null);
  const [sourceClassLabel, setSourceClassLabel] = useState<string | null>(null);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [selectedGroupeId, setSelectedGroupeId] = useState("");

  const studentIdsKey = useMemo(
    () =>
      students
        .map((student) => student.id)
        .filter(Boolean)
        .sort()
        .join(","),
    [students],
  );

  const isChangeMode = useMemo(
    () =>
      students.length > 0 &&
      students.every((student) => Boolean(student.className || student.classeId)),
    [students],
  );

  const currentGroupeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const student of students) {
      const classeId = studentCurrentClasseId(student);
      if (classeId) ids.add(classeId);
    }
    return ids;
  }, [students]);

  const selectedGroupe = groupes.find((groupe) => groupe.id === selectedGroupeId);
  const selectingSameGroupe =
    isChangeMode &&
    students.length === 1 &&
    Boolean(selectedGroupeId) &&
    currentGroupeIds.has(selectedGroupeId);

  const canSubmit =
    Boolean(selectedGroupeId) &&
    !assigning &&
    students.length > 0 &&
    !selectingSameGroupe;

  useEffect(() => {
    if (!open) {
      setGroupes([]);
      setSchoolYearName(null);
      setSourceClassLabel(null);
      setEmptyReason(null);
      setSelectedGroupeId("");
      setAssigning(false);
      return;
    }

    const studentIds = students.map((student) => student.id).filter(Boolean);
    if (!studentIds.length) {
      setGroupes([]);
      setEmptyReason("Aucun eleve a affecter");
      return;
    }

    setLoadingOptions(true);
    setSelectedGroupeId("");
    void getAssignableGroupesForStudentsAction({ studentIds })
      .then((response) => {
        if (!response.ok) {
          toast.error(response.message);
          setGroupes([]);
          setSourceClassLabel(null);
          setEmptyReason(response.message);
          return;
        }

        setSchoolYearName(response.schoolYear.nameYear);
        setGroupes(response.groupes);
        setSourceClassLabel(
          response.sourceClasses.length
            ? response.sourceClasses.map((c) => c.name).join(", ")
            : null,
        );
        setEmptyReason(response.emptyReason);
      })
      .finally(() => {
        setLoadingOptions(false);
      });
    // studentIdsKey stabilise la dependance ; students est lu dans l'effet.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- studentIdsKey
  }, [open, studentIdsKey]);

  async function handleAssign() {
    if (!selectedGroupeId) {
      toast.error("Selectionnez un groupe");
      return;
    }

    if (!students.length) {
      toast.error("Aucun eleve a affecter");
      return;
    }

    if (selectingSameGroupe) {
      toast.info("Choisissez un autre groupe que le groupe actuel");
      return;
    }

    setAssigning(true);
    try {
      const result = await assignStudentsToGroupeAction({
        studentIds: students.map((student) => student.id),
        classeId: selectedGroupeId,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const failed = result.failures.length;
      const cible = selectedGroupe?.nameClasse ?? "le groupe";

      if (failed > 0) {
        toast.warning(
          isChangeMode
            ? `${result.assignedCount} change(s), ${failed} echec(s)`
            : `${result.assignedCount} affecte(s), ${failed} echec(s)`,
        );
      } else if (isChangeMode) {
        toast.success(
          students.length === 1
            ? `Groupe change vers ${cible}`
            : `${result.assignedCount} eleves transferes vers ${cible}`,
        );
      } else {
        toast.success(
          students.length === 1
            ? `Eleve affecte a ${cible}`
            : `${result.assignedCount} eleves affectes a ${cible}`,
        );
      }

      onSuccess?.();
      onOpenChange(false);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {isChangeMode ? (
                <IconArrowsExchange className="size-4" />
              ) : (
                <IconUsersGroup className="size-4" />
              )}
            </span>
            {isChangeMode ? "Changer de groupe" : "Affecter au groupe"}
          </DialogTitle>
          <DialogDescription>
            {isChangeMode
              ? `Corrigez l'affectation ${students.length > 1 ? "de ces eleves" : "de cet eleve"} vers un autre groupe lie a sa classe secondaire.`
              : `Placez ${students.length > 1 ? "ces eleves" : "cet eleve"} dans un groupe lie a sa classe secondaire pour les rendre visibles en paiements.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {students.length} eleve{students.length > 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {schoolYearName ? (
                  <Badge variant="secondary">{schoolYearName}</Badge>
                ) : null}
                {sourceClassLabel ? (
                  <Badge variant="outline" className="max-w-[220px] truncate">
                    Classe : {sourceClassLabel}
                  </Badge>
                ) : null}
              </div>
            </div>
            <ul className="max-h-28 space-y-1 overflow-y-auto text-sm text-muted-foreground">
              {students.map((student) => (
                <li key={student.id} className="truncate">
                  {student.nom} {student.postnom} {student.prenom}
                  {!student.className ? (
                    <span className="ml-2 text-amber-700 dark:text-amber-400">
                      · sans groupe
                    </span>
                  ) : (
                    <span className="ml-2">
                      · actuel :{" "}
                      <span className="font-medium text-foreground">
                        {student.className}
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label className="text-sm font-medium">
              {isChangeMode ? "Nouveau groupe" : "Groupe"}
            </label>
            <Select
              value={selectedGroupeId}
              onValueChange={setSelectedGroupeId}
              disabled={loadingOptions || groupes.length === 0}
            >
              <SelectTrigger className="mt-2 h-11 rounded-xl">
                <SelectValue
                  placeholder={
                    loadingOptions
                      ? "Chargement..."
                      : groupes.length === 0
                        ? "Aucun groupe compatible"
                        : isChangeMode
                          ? "Selectionner le nouveau groupe"
                          : "Selectionner un groupe"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {groupes.map((groupe) => {
                  const isCurrent =
                    students.length === 1 && currentGroupeIds.has(groupe.id);
                  return (
                    <SelectItem
                      key={groupe.id}
                      value={groupe.id}
                      disabled={isCurrent}
                    >
                      {groupe.nameClasse}
                      {isCurrent ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (actuel)
                        </span>
                      ) : (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatCapacity(groupe.enrolledCount, groupe.capacity)}
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectingSameGroupe ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Ce groupe est deja celui de l&apos;eleve. Choisissez-en un autre.
              </p>
            ) : null}
            {!loadingOptions && emptyReason && groupes.length === 0 ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                {emptyReason}
              </p>
            ) : null}
            {!loadingOptions && sourceClassLabel && groupes.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Uniquement les groupes lies a la classe source de{" "}
                {students.length > 1 ? "ces eleves" : "cet eleve"}.
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={assigning}
          >
            Annuler
          </Button>
          <Button
            loading={assigning}
            disabled={!canSubmit}
            onClick={() => void handleAssign()}
          >
            {isChangeMode ? "Changer de groupe" : "Affecter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
