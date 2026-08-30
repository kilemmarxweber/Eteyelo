"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconCalendarTime } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StudentScheduleSection } from "../student/[id]/components/student-schedule-section";
import type { CursusStudentRef } from "@/lib/auth/cursus-scope";
import type { StudentScheduleData } from "@/lib/student-schedule-types";

type CursusScheduleReadClientProps = {
  role: "student" | "parent";
  studentLabel: string;
  childrenOptions: CursusStudentRef[];
  selectedStudent: CursusStudentRef;
  schedule: StudentScheduleData | null;
  notesHref: string;
};

export default function CursusScheduleReadClient({
  role,
  studentLabel,
  childrenOptions,
  selectedStudent,
  schedule,
  notesHref,
}: CursusScheduleReadClientProps) {
  const t = useTranslations("teaching.schedule");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onSelectChild = (studentId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("studentId", studentId);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <BranchPageShell
      title={t("yearTitle")}
          description={
            role === "parent"
              ? t("parentYearReadOnlyDesc", {
                  studentLabel: studentLabel.toLowerCase(),
                })
              : t("yearReadOnlyDesc")
          }
          badge={
            <Badge
              variant="outline-primary"
              icon={<IconCalendarTime size={14} />}
            >
              {t("cursusBadge")}
            </Badge>
          }
      fixedHeight
      fadedBelow
    >
      {role === "parent" && childrenOptions.length > 1 ? (
          <div className="flex max-w-sm flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {studentLabel}
            </span>
            <Select
              value={selectedStudent.id}
              onValueChange={onSelectChild}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("chooseStudent", {
                    studentLabel: studentLabel.toLowerCase(),
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                {childrenOptions.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.fullName}
                    {child.classCode ? ` · ${child.classCode}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {selectedStudent.fullName}
            {selectedStudent.classCode
              ? ` · ${selectedStudent.classCode}`
              : ""}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          <StudentScheduleSection schedule={schedule} />
        </div>

        <p className="text-xs text-muted-foreground">
          {t("planningAdminOnly")}{" "}
          <Link href={notesHref} className="underline">
            {t("seeGrades")}
          </Link>
        </p>
    </BranchPageShell>
  );
}
