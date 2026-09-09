"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import type { AttendanceExitReason } from "@/prisma/generated/prisma/client";
import {
  recordPersonnelEarlyExitAction,
  recordStudentEarlyExitAction,
  recordTeacherEarlyExitAction,
} from "../attendance-exit.action";

const EXIT_REASONS: AttendanceExitReason[] = [
  "MALADIE",
  "URGENCE",
  "AUTORISE",
  "AUTRE",
];

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
  const t = useTranslations("attendance");
  const tCommon = useTranslations("common");
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
        throw new Error(error?.message || t("checkout.saveFailed"));
      }
      toast.success(t("checkout.earlySuccess", { personName }));
      onOpenChange(false);
      setReasonNote("");
      onDone?.();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("checkout.saveError"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        className="flex max-h-[min(100dvh-1.25rem,40rem)] w-[min(calc(100vw-1.25rem),28rem)] flex-col gap-4 overflow-hidden p-4 sm:p-6"
      >
        <DialogHeader className="shrink-0 space-y-2 pr-8 text-left">
          <DialogTitle className="text-base font-semibold leading-snug sm:text-lg">
            {t("earlyExit.title")}
          </DialogTitle>
          <DialogDescription className="text-left text-sm font-normal leading-relaxed">
            {t("earlyExit.description", { personName })}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto">
          <div className="min-w-0 space-y-1.5">
            <Label>{t("checkout.reason")}</Label>
            <Select
              value={reasonCode}
              onValueChange={(value) =>
                setReasonCode(value as AttendanceExitReason)
              }
            >
              <SelectTrigger className="h-11 w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXIT_REASONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`exitReasons.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label>{t("checkout.noteOptional")}</Label>
            <Textarea
              value={reasonNote}
              onChange={(event) => setReasonNote(event.target.value)}
              placeholder={t("earlyExit.notePlaceholder")}
              className="min-h-[5.5rem] resize-y"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            className="h-11 w-full sm:w-auto"
            onClick={() => void submit()}
            disabled={pending}
          >
            {pending ? t("checkout.saving") : t("checkout.confirmCheckout")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
