"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconNotes } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "next-intl";
import type { CursusStudentRef } from "@/lib/auth/cursus-scope";
import type { StudentNotesReadData } from "@/lib/student-notes-read";

type NotesReadClientProps = {
  role: "student" | "parent";
  studentLabel: string;
  childrenOptions: CursusStudentRef[];
  data: StudentNotesReadData;
  resultsHref: string;
};

export default function NotesReadClient({
  role,
  studentLabel,
  childrenOptions,
  data,
  resultsHref,
}: NotesReadClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("cursus.notes");

  const onSelectChild = (studentId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("studentId", studentId);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <BranchPageShell
      title={t("mine")}
          description={
            role === "parent"
              ? t("mineDescParent", { student: studentLabel.toLowerCase() })
              : t("mineDescStudent")
          }
          badge={
            <Badge variant="outline-primary" icon={<IconNotes size={14} />}>
              {t("readOnly")}
            </Badge>
          }
    >
      {role === "parent" && childrenOptions.length > 1 ? (
          <div className="flex max-w-sm flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {studentLabel}
            </span>
            <Select value={data.studentId} onValueChange={onSelectChild}>
              <SelectTrigger>
                <SelectValue placeholder={t("chooseStudent", { student: studentLabel.toLowerCase() })} />
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
        ) : null}

        <Card className="rounded-xl border p-4">
          <div className="mb-4 flex flex-col gap-1">
            <p className="text-sm font-semibold">{data.studentName}</p>
            <p className="text-xs text-muted-foreground">
              {data.classLabel ?? t("noClass")}
            </p>
          </div>

          {data.entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("course")}</TableHead>
                    <TableHead>{t("period")}</TableHead>
                    <TableHead>{t("type")}</TableHead>
                    <TableHead>{t("grade")}</TableHead>
                    <TableHead>{t("comment")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.map((entry) => (
                    <TableRow key={`${entry.ficheId}-${entry.typeFiche}`}>
                      <TableCell className="font-medium">
                        {entry.courseName}
                      </TableCell>
                      <TableCell>{entry.periodName}</TableCell>
                      <TableCell>{entry.typeFiche}</TableCell>
                      <TableCell>
                        {entry.score}
                        {entry.maxScore > 0 ? ` / ${entry.maxScore}` : ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.comment ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            {t("entryReserved")}{" "}
            <Link href={resultsHref} className="underline">
              {t("viewResults")}
            </Link>
          </p>
        </Card>
    </BranchPageShell>
  );
}
