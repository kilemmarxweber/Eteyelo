"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import { canManageOrganization } from "@/lib/auth/session-roles";
import {
  checkTeacherAttendanceNeeded,
  getActiveTeachersNow,
  markTeacherAttendance,
} from "../attendance.action";
import { getCurrentPosition } from "./attendance.client";

type SessionData = {
  teacherId: string;
  teachingId: string;
  sessionId: string;
  cours: string | null;
  classe: string | null;
  branch: {
    id: string;
    name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    attendanceRadius?: number | null;
  };
};

type TeacherUI = {
  id: string;
  user: {
    name?: string | null;
    postnom?: string | null;
    prenom?: string | null;
  };
  activeSession?: {
    id: string;
  };
};

interface Props {
  onSuccess: () => void;
  sessionData?: Partial<SessionData> | null;
}

export default function TeacherAttendanceForm({
  onSuccess,
  sessionData,
}: Props) {
  const t = useTranslations("attendance");
  const { data: session } = useSession();
  const isManager = canManageOrganization(session);
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState<SessionData | null>(
    sessionData?.sessionId && sessionData.teacherId
      ? (sessionData as SessionData)
      : null,
  );
  const [loadingSession, setLoadingSession] = useState(
    !isManager && !sessionData?.sessionId,
  );
  const [search, setSearch] = useState("");
  const [teachers, setTeachers] = useState<TeacherUI[]>([]);
  const [selected, setSelected] = useState<TeacherUI | null>(null);

  useEffect(() => {
    if (isManager) {
      setLoadingSession(false);
      return;
    }

    if (sessionData?.sessionId && sessionData.teacherId) {
      setResolved(sessionData as SessionData);
      setLoadingSession(false);
      return;
    }

    const branchId = session?.branch?.id;
    const organizationId = session?.organization?.id;
    if (!branchId || !organizationId) return;

    let cancelled = false;
    setLoadingSession(true);

    (async () => {
      try {
        const needed = await checkTeacherAttendanceNeeded({
          branchId,
          organizationId,
        });
        if (cancelled) return;
        if (!needed?.sessionId) {
          setResolved(null);
          return;
        }
        setResolved({
          teacherId: needed.teacherId,
          teachingId: needed.teachingId,
          sessionId: needed.sessionId,
          cours: needed.cours,
          classe: needed.classe,
          branch: needed.branch,
        });
      } catch {
        if (!cancelled) setResolved(null);
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isManager,
    session?.branch?.id,
    session?.organization?.id,
    sessionData?.sessionId,
    sessionData?.teacherId,
  ]);

  useEffect(() => {
    if (!isManager) return;

    const timer = setTimeout(async () => {
      try {
        const data = await getActiveTeachersNow(search);
        setTeachers(data || []);
      } catch {
        setTeachers([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isManager, search]);

  async function submitSelf() {
    if (!resolved?.sessionId || !resolved.teacherId) {
      toast.error(t("teacherForm.noSessionNow"));
      return;
    }

    setLoading(true);
    try {
      const position = await getCurrentPosition();
      await markTeacherAttendance({
        teacherId: resolved.teacherId,
        sessionId: resolved.sessionId,
        status: "PRESENT",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      toast.success(t("teacherForm.presenceSaved"));
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("teacherForm.checkInFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitManager() {
    if (!selected?.activeSession?.id) {
      toast.error(t("teacherForm.noActiveSession"));
      return;
    }

    setLoading(true);
    try {
      const position = await getCurrentPosition();
      await markTeacherAttendance({
        teacherId: selected.id,
        sessionId: selected.activeSession.id,
        status: "PRESENT",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      toast.success(t("teacherForm.presenceSaved"));
      setSelected(null);
      setSearch("");
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("teacherForm.checkInFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  if (isManager) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("teacherForm.managerHint")}
        </p>
        <input
          className="w-full rounded border p-2"
          placeholder={t("teacherForm.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="space-y-2">
          {teachers.map((teacher) => (
            <button
              key={teacher.id}
              type="button"
              onClick={() => setSelected(teacher)}
              className={`w-full rounded border p-3 text-left ${
                selected?.id === teacher.id ? "bg-black text-white" : ""
              }`}
            >
              {teacher.user.name} {teacher.user.prenom}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={submitManager}
          disabled={!selected || loading}
          className="w-full rounded bg-black p-2 text-white disabled:opacity-60"
        >
          {loading
            ? t("teacherForm.validating")
            : t("teacherForm.validatePresence")}
        </button>
      </div>
    );
  }

  if (loadingSession) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("teacherForm.findingSession")}
      </p>
    );
  }

  if (!resolved) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("teacherForm.onlyAroundClass")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("teacherForm.validateForCourse", {
          course: resolved.cours ?? t("teacherForm.thisCourse"),
          class: resolved.classe ?? "",
        })}
      </p>

      <button
        type="button"
        onClick={submitSelf}
        disabled={loading}
        className="w-full rounded bg-black p-2 text-white disabled:opacity-60"
      >
        {loading
          ? t("teacherForm.validating")
          : t("teacherForm.validateMyPresence")}
      </button>
    </div>
  );
}
