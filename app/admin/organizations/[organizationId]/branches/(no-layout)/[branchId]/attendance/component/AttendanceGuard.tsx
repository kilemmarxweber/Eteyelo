"use client";

import { useEffect, useState } from "react";
import { checkTeacherAttendanceNeeded } from "../attendance.action";
import { getCurrentPosition } from "./attendance.client";
import { verifyRadius } from "./attendance.utils";

import TeacherAttendanceAutoModal from "./TeacherAttendanceAutoModal";
import { useSession } from "@/lib/auth-client";

export default function AttendanceGuard() {
  const [open, setOpen] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const { data: session } = useSession();
  const branchId = session?.branch?.id;
  const organizationId = session?.organization?.id;
  useEffect(() => {
    async function load() {
      if (!branchId || !organizationId) return;
      try {
        const res = await checkTeacherAttendanceNeeded({
          branchId,
          organizationId,
        });
        // const res = await mockCheck();
        // setSessionData(res);
        // setOpen(true);
        if (!res) {
          setOpen(false);
          return;
        }

        const position = await getCurrentPosition();

        const { allowed } = verifyRadius(
          position.coords.latitude,
          position.coords.longitude,
          res.branch.latitude,
          res.branch.longitude,
          res.branch.attendanceRadius,
        );

        if (allowed) {
          setSessionData(res);
          setOpen(true);
        }
      } catch (error) {
        console.error("AttendanceGuard error:", error);
        setOpen(false);
      }
    }

    load();
  }, []);

  return (
    <TeacherAttendanceAutoModal
      open={open}
      sessionData={sessionData}
      onClose={() => setOpen(false)}
    />
  );
}
