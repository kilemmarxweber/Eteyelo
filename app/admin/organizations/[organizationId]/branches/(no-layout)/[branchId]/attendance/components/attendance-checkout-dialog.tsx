"use client";

import { useEffect, useState } from "react";
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
  recordNormalCheckoutAction,
  recordPersonnelEarlyExitAction,
  recordStudentEarlyExitAction,
  recordTeacherEarlyExitAction,
} from "../attendance-exit.action";
import {
  kioskRecordNormalCheckoutAction,
  kioskRecordPersonnelEarlyExitAction,
  kioskRecordStudentEarlyExitAction,
  kioskRecordTeacherEarlyExitAction,
} from "@/app/attendance/[branchId]/kiosk.action";
import type { AttendancePersonType } from "../attendance-scan-types";

const EXIT_REASONS: AttendanceExitReason[] = [
  "MALADIE",
  "URGENCE",
  "AUTORISE",
  "AUTRE",
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personType: AttendancePersonType;
  attendanceId: string;
  personName: string;
  sessionLabel?: string | null;
  requireEarlyExit?: boolean;
  kioskBranchId?: string;
  onDone?: (message: string) => void;
};

export function AttendanceCheckoutDialog({
  open,
  onOpenChange,
  personType,
  attendanceId,
  personName,
  sessionLabel,
  requireEarlyExit = false,
  kioskBranchId,
  onDone,
}: Props) {
  const t = useTranslations("attendance");
  const tCommon = useTranslations("common");
  const [mode, setMode] = useState<"normal" | "early">(
    requireEarlyExit ? "early" : "normal",
  );
  const [reasonCode, setReasonCode] =
    useState<AttendanceExitReason>("MALADIE");
  const [reasonNote, setReasonNote] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open && requireEarlyExit) setMode("early");
    if (open && !requireEarlyExit) setMode("normal");
  }, [open, requireEarlyExit]);

  async function submit() {
    setPending(true);
    try {
      if (mode === "normal") {
        if (requireEarlyExit) {
          throw new Error(t("checkout.normalTooEarly"));
        }
        const [data, error] = kioskBranchId
          ? await kioskRecordNormalCheckoutAction(kioskBranchId, {
              personType,
              attendanceId,
            })
          : await recordNormalCheckoutAction({
              personType,
              attendanceId,
            });
        if (error || !data) {
          throw new Error(error?.message || t("checkout.saveFailed"));
        }
        const message = t("checkout.normalSuccess", { personName });
        toast.success(message);
        onOpenChange(false);
        onDone?.(message);
        return;
      }

      const payload = { attendanceId, reasonCode, reasonNote };
      const action = kioskBranchId
        ? personType === "student"
          ? (input: typeof payload) =>
              kioskRecordStudentEarlyExitAction(kioskBranchId, input)
          : personType === "teacher"
            ? (input: typeof payload) =>
                kioskRecordTeacherEarlyExitAction(kioskBranchId, input)
            : (input: typeof payload) =>
                kioskRecordPersonnelEarlyExitAction(kioskBranchId, input)
        : personType === "student"
          ? recordStudentEarlyExitAction
          : personType === "teacher"
            ? recordTeacherEarlyExitAction
            : recordPersonnelEarlyExitAction;
      const [data, error] = await action(payload);
      if (error || !data) {
        throw new Error(error?.message || t("checkout.saveFailed"));
      }
      const message = t("checkout.earlySuccess", { personName });
      toast.success(message);
      onOpenChange(false);
      setReasonNote("");
      setMode("normal");
      onDone?.(message);
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
            {t("checkout.title")}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1.5 text-left font-normal">
              <p className="text-sm font-medium leading-snug text-foreground break-words">
                {personName}
                {sessionLabel ? (
                  <span className="font-normal text-muted-foreground">
                    {" — "}
                    {sessionLabel}
                  </span>
                ) : null}
              </p>
              <p className="text-sm font-normal leading-relaxed text-muted-foreground">
                {t("checkout.chooseMode")}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "normal" ? "default" : "outline"}
              disabled={requireEarlyExit}
              className="h-11 min-w-0 whitespace-normal px-2 text-sm"
              onClick={() => setMode("normal")}
            >
              {t("checkout.normalEnd")}
            </Button>
            <Button
              type="button"
              variant={mode === "early" ? "default" : "outline"}
              className="h-11 min-w-0 whitespace-normal px-2 text-sm"
              onClick={() => setMode("early")}
            >
              {t("checkout.earlyExit")}
            </Button>
          </div>

          {requireEarlyExit ? (
            <p className="text-sm font-normal leading-relaxed text-amber-700 dark:text-amber-400">
              {t("checkout.incidentOnlyHint")}
            </p>
          ) : null}

          {mode === "early" ? (
            <>
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
                  placeholder={t("checkout.notePlaceholder")}
                  className="min-h-[5.5rem] resize-y"
                  rows={3}
                />
              </div>
            </>
          ) : (
            <p className="text-sm font-normal leading-relaxed text-muted-foreground">
              {t("checkout.normalHint")}
            </p>
          )}
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
            {pending ? t("checkout.saving") : mode === "early" ? t("checkout.earlyExit") : t("checkout.confirmCheckout")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
