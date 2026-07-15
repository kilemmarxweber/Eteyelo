"use client";

import { useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { markStudentAttendance } from "../attendance.action";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Check, X, Clock, FileText } from "lucide-react";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export default function StudentAttendanceTable({ session }: { session?: any }) {
  const [isPending, startTransition] = useTransition();
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const router = useRouter();

  if (!session) {
    return <p>Aucune session disponible</p>;
  }

  const enrollments = session.teaching?.classe?.classEnrollment ?? [];
  const classe = session.teaching?.classe?.codeClasse;
  const cours = session.teaching?.cours?.nameCours;

  const attendancesMap = new Map<
    string,
    { status: AttendanceStatus; remark?: string }
  >(
    (session.attendances ?? []).map((a: any) => [
      a.studentId,
      {
        status: a.status as AttendanceStatus,
        remark: a.remark ?? "",
      },
    ]),
  );

  function mark(studentId: string, status: AttendanceStatus) {
    startTransition(async () => {
      await markStudentAttendance({
        sessionId: session.id,
        studentId,
        status,
        remark: remarks[studentId] ?? "",
      });

      router.refresh();
    });
  }

  function StatusBadge({ status }: { status: AttendanceStatus }) {
    const map: Record<AttendanceStatus, string> = {
      PRESENT: "bg-green-100 text-green-700",
      ABSENT: "bg-red-100 text-red-700",
      LATE: "bg-yellow-100 text-yellow-700",
      EXCUSED: "bg-blue-100 text-blue-700",
    };

    const label: Record<AttendanceStatus, string> = {
      PRESENT: "Présent",
      ABSENT: "Absent",
      LATE: "Retard",
      EXCUSED: "Excusé",
    };

    return <Badge className={`${map[status]} border-0`}>{label[status]}</Badge>;
  }

  function StatusButton({
    active,
    onClick,
    icon,
    label,
    color,
  }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    color: string;
  }) {
    return (
      <Button
        size="sm"
        variant={active ? "default" : "outline"}
        onClick={onClick}
        className={`gap-1 ${active ? "" : color}`}
      >
        {icon}
        {label}
      </Button>
    );
  }

  return (
    <div className={`space-y-4 ${isPending ? "opacity-60" : "opacity-100"}`}>
      {/* HEADER */}
      <div className="rounded-lg border p-4 bg-muted/20">
        <h3 className="font-semibold text-lg">{cours}</h3>
        <p className="text-sm text-muted-foreground">Classe : {classe}</p>
        <p className="text-sm text-muted-foreground">
          {enrollments.length} élève(s)
        </p>
      </div>

      {/* LIST */}
      <div className="space-y-2">
        {enrollments.map((enrollment: any) => {
          const student = enrollment.student;
          const studentId = student.id;

          const attendance = attendancesMap.get(studentId);
          const status = attendance?.status;

          const fullName = [
            student?.user?.nom,
            student?.user?.postnom,
            student?.user?.prenom,
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={studentId}
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition"
            >
              {/* LEFT */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{fullName}</p>

                  {status ? (
                    <StatusBadge status={status} />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Non marqué
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {classe} • {cours}
                </p>
              </div>

              {/* RIGHT */}
              <div className="flex items-center gap-2">
                {/* REMARK */}
                <Input
                  placeholder="Remarque..."
                  value={remarks[studentId] ?? attendance?.remark ?? ""}
                  onChange={(e) =>
                    setRemarks((prev) => ({
                      ...prev,
                      [studentId]: e.target.value,
                    }))
                  }
                  className="w-52"
                />

                {/* BUTTONS STATUS */}
                <div className="flex items-center gap-1">
                  <StatusButton
                    active={status === "PRESENT"}
                    onClick={() => mark(studentId, "PRESENT")}
                    icon={<Check className="w-4 h-4" />}
                    label=""
                    color="text-green-600"
                  />

                  <StatusButton
                    active={status === "ABSENT"}
                    onClick={() => mark(studentId, "ABSENT")}
                    icon={<X className="w-4 h-4" />}
                    label=""
                    color="text-red-600"
                  />

                  <StatusButton
                    active={status === "LATE"}
                    onClick={() => mark(studentId, "LATE")}
                    icon={<Clock className="w-4 h-4" />}
                    label=""
                    color="text-yellow-600"
                  />

                  <StatusButton
                    active={status === "EXCUSED"}
                    onClick={() => mark(studentId, "EXCUSED")}
                    icon={<FileText className="w-4 h-4" />}
                    label=""
                    color="text-blue-600"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
