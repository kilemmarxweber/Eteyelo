"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconClock, IconClipboardCheck, IconChevronRight } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { markTeacherAttendance } from "./attendance/attendance.action";
import { getCurrentPosition } from "./attendance/component/attendance.client";
import {
  checkInMyPersonnelAction,
  checkOutMyPersonnelAction,
  getMyDashboardPresenceAction,
  type DashboardPresenceData,
} from "./dashboard-presence.action";

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MyPresenceSection() {
  const t = useTranslations("dashboard.presence");
  const params = useParams<{ organizationId: string; branchId: string }>();
  const [data, setData] = useState<DashboardPresenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reportHref =
    params.organizationId && params.branchId
      ? `/admin/organizations/${params.organizationId}/branches/${params.branchId}/ma-presence`
      : null;

  const load = useCallback(async () => {
    setLoading(true);
    const [result, err] = await getMyDashboardPresenceAction();
    if (err || !result) {
      setData(null);
    } else {
      setData(result);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function withGeo() {
    const position = await getCurrentPosition();
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  }

  async function clockTeacher() {
    const pending = data?.teacher?.pending;
    if (!pending) return;
    setBusy(true);
    try {
      const coords = await withGeo();
      const [, err] = await markTeacherAttendance({
        teacherId: pending.teacherId,
        sessionId: pending.sessionId,
        status: "PRESENT",
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      if (err) throw new Error(err.message);
      toast.success(t("checkedIn"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("checkInFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function clockPersonnelIn() {
    setBusy(true);
    try {
      const coords = await withGeo();
      const [, err] = await checkInMyPersonnelAction(coords);
      if (err) throw new Error(err.message);
      toast.success(t("checkedIn"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("checkInFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function clockPersonnelOut() {
    setBusy(true);
    try {
      const coords = await withGeo();
      const [, err] = await checkOutMyPersonnelAction(coords);
      if (err) throw new Error(err.message);
      toast.success(t("checkedOut"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("checkOutFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !data?.teacher && !data?.personnel) {
    return null;
  }

  const month = data?.teacher?.month ?? data?.personnel?.month;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <IconClipboardCheck className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        {reportHref ? (
          <Button asChild variant="outline" size="sm">
            <Link href={reportHref}>
              {t("openReport")}
              <IconChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : (
          <>
            {month ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{t("present")}</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-600">
                    {month.present}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{t("late")}</p>
                  <p className="mt-1 text-xl font-semibold text-amber-600">
                    {month.late}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{t("absent")}</p>
                  <p className="mt-1 text-xl font-semibold text-rose-600">
                    {month.absent}
                  </p>
                </div>
              </div>
            ) : null}

            {data?.teacher ? (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">{t("teacherLabel")}</p>
                {data.teacher.pending ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {t("teacherSession", {
                        course: data.teacher.pending.cours ?? t("thisCourse"),
                        classe: data.teacher.pending.classe ?? "—",
                      })}
                    </p>
                    <Button onClick={() => void clockTeacher()} disabled={busy}>
                      <IconClock className="mr-2 h-4 w-4" />
                      {busy ? t("saving") : t("checkInNow")}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("teacherNoSession")}
                  </p>
                )}
              </div>
            ) : null}

            {data?.personnel ? (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">{t("staffLabel")}</p>
                {data.personnel.today?.checkIn ? (
                  <p className="text-sm text-muted-foreground">
                    {t("staffToday", {
                      in: formatTime(data.personnel.today.checkIn),
                      out: formatTime(data.personnel.today.checkOut),
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("staffNotIn")}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {!data.personnel.today?.checkIn ? (
                    <Button
                      onClick={() => void clockPersonnelIn()}
                      disabled={busy}
                    >
                      <IconClock className="mr-2 h-4 w-4" />
                      {busy ? t("saving") : t("checkInArrival")}
                    </Button>
                  ) : !data.personnel.today.checkOut ? (
                    <Button
                      onClick={() => void clockPersonnelOut()}
                      disabled={busy}
                    >
                      <IconClock className="mr-2 h-4 w-4" />
                      {busy ? t("saving") : t("checkOutNow")}
                    </Button>
                  ) : (
                    <p className="text-sm font-medium text-emerald-700">
                      {t("staffComplete")}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
