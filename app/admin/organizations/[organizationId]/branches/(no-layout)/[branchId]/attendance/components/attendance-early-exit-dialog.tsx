"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ATTENDANCE_EXIT_REASON_OPTIONS } from "@/lib/attendance-exit";
import type { AttendanceExitReason } from "@/prisma/generated/prisma/client";
import {
  recordPersonnelEarlyExitAction,
  recordStudentEarlyExitAction,
  recordTeacherEarlyExitAction,
} from "../attendance-exit.action";

type PersonType = "student" | "teacher" | "personnel";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personType: PersonType;
  attendanceId: string;
  personName: string;
  onDone?: () => void;
};

export function AttendanceEarlyExitDialog({
  open,
  onOpenChange,
  personType,
  attendanceId,
  personName,
  onDone,
}: Props) {
  const [reasonCode, setReasonCode] =
    useState<AttendanceExitReason>("MALADIE");
  const [reasonNote, setReasonNote] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    try {
      const payload = {
        attendanceId,
        reasonCode,
        reasonNote,
      };
      const action =
        personType === "student"
          ? recordStudentEarlyExitAction
          : personType === "teacher"
            ? recordTeacherEarlyExitAction
            : recordPersonnelEarlyExitAction;

      const [data, error] = await action(payload);
      if (error || !data) {
        throw new Error(error?.message || "Impossible d'enregistrer la sortie.");
      }
      toast.success(`Sortie anticipée enregistrée pour ${personName}.`);
      onOpenChange(false);
      setReasonNote("");
      onDone?.();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de l'enregistrement.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sortie anticipée</DialogTitle>
          <DialogDescription>
            Signalez le motif de sortie pour{" "}
            <span className="font-medium text-foreground">{personName}</span>.
            Ce motif apparaîtra sur le rapport journalier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Motif</Label>
            <Select
              value={reasonCode}
              onValueChange={(value) =>
                setReasonCode(value as AttendanceExitReason)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTENDANCE_EXIT_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Précision (optionnel)</Label>
            <Textarea
              value={reasonNote}
              onChange={(event) => setReasonNote(event.target.value)}
              placeholder="Ex. fièvre, rendez-vous médical, urgence familiale…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={pending}>
            {pending ? "Enregistrement…" : "Confirmer la sortie"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
