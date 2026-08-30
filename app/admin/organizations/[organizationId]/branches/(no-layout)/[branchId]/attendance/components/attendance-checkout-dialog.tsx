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
  recordNormalCheckoutAction,
  recordPersonnelEarlyExitAction,
  recordStudentEarlyExitAction,
  recordTeacherEarlyExitAction,
} from "../attendance-exit.action";
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
  const t = useTranslations("attendance");
  const tCommon = useTranslations("common");
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
          throw new Error(error?.message || t("checkout.saveFailed"));
        }
        const message = t("checkout.normalSuccess", { personName });
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

  const description = `${personName}${sessionLabel ? ` — ${sessionLabel}` : ""}. ${t("checkout.chooseMode")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("checkout.title")}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "normal" ? "default" : "outline"}
              onClick={() => setMode("normal")}
            >
              {t("checkout.normalEnd")}
            </Button>
            <Button
              type="button"
              variant={mode === "early" ? "default" : "outline"}
              onClick={() => setMode("early")}
            >
              {t("checkout.earlyExit")}
            </Button>
          </div>

          {mode === "early" ? (
            <>
              <div className="space-y-1.5">
                <Label>{t("checkout.reason")}</Label>
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
                    {EXIT_REASONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`exitReasons.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("checkout.noteOptional")}</Label>
                <Textarea
                  value={reasonNote}
                  onChange={(event) => setReasonNote(event.target.value)}
                  placeholder={t("checkout.notePlaceholder")}
                  rows={3}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("checkout.normalHint")}
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
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={pending}>
            {pending ? t("checkout.saving") : t("checkout.confirmCheckout")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
