"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconCalendarTime } from "@tabler/icons-react";

import { Layout, LayoutBody } from "@/components/custom/layout";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onSelectChild = (studentId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("studentId", studentId);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Layout fadedBelow fixedHeight>
      <LayoutBody className="flex flex-col gap-6" fixedHeight>
        <PageHeader
          title="Horaire de l'année"
          description={
            role === "parent"
              ? `Emploi du temps annuel de chaque ${studentLabel.toLowerCase()} lié — lecture seule.`
              : "Vos cours / créneaux pour toute l'année scolaire active — lecture seule."
          }
          badge={
            <Badge
              variant="outline-primary"
              icon={<IconCalendarTime size={14} />}
            >
              Cursus
            </Badge>
          }
        />

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
                  placeholder={`Choisir un ${studentLabel.toLowerCase()}`}
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
          La planification des créneaux est réservée à l&apos;administration.{" "}
          <Link href={notesHref} className="underline">
            Voir les notes
          </Link>
        </p>
      </LayoutBody>
    </Layout>
  );
}
