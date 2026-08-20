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
  recordNormalCheckoutAction,
  recordPersonnelEarlyExitAction,
  recordStudentEarlyExitAction,
  recordTeacherEarlyExitAction,
} from "../attendance-exit.action";
import type { AttendancePersonType } from "../attendance-scan-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personType: AttendancePersonType;
  attendanceId: string;
  personName: string;
  sessionLabel?: string | null;
  onDone?: (message: string) => void;
};

export function AttendanceCheckoutDialog({
  open,
  onOpenChange,
  personType,
  attendanceId,
  personName,
  sessionLabel,
  onDone,
}: Props) {
  const [mode, setMode] = useState<"normal" | "early">("normal");
  const [reasonCode, setReasonCode] =
    useState<AttendanceExitReason>("MALADIE");
  const [reasonNote, setReasonNote] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    try {
      if (mode === "normal") {
        const [data, error] = await recordNormalCheckoutAction({
          personType,
          attendanceId,
        });
        if (error || !data) {
          throw new Error(error?.message || "Impossible d'enregistrer la sortie.");
        }
        const message = `Sortie normale enregistrée pour ${personName}.`;
        toast.success(message);
        onOpenChange(false);
        onDone?.(message);
        return;
      }

      const payload = { attendanceId, reasonCode, reasonNote };
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
      const message = `Sortie anticipée enregistrée pour ${personName}.`;
      toast.success(message);
      onOpenChange(false);
      setReasonNote("");
      setMode("normal");
      onDone?.(message);
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
          <DialogTitle>Encoder la sortie</DialogTitle>
          <DialogDescription>
            {personName}
            {sessionLabel ? ` — ${sessionLabel}` : ""}. Choisissez une fin
            normale ou une sortie anticipée avec motif.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "normal" ? "default" : "outline"}
              onClick={() => setMode("normal")}
            >
              Fin normale
            </Button>
            <Button
              type="button"
              variant={mode === "early" ? "default" : "outline"}
              onClick={() => setMode("early")}
            >
              Sortie anticipée
            </Button>
          </div>

          {mode === "early" ? (
            <>
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
                  placeholder="Ex. fièvre, urgence, autorisation parentale…"
                  rows={3}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              La sortie sera enregistrée sans motif (fin de vacation / fin de
              cours / fin de journée).
            </p>
          )}
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
