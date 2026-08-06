"use client";

import * as React from "react";
import type { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useRefresh } from "@/src/hooks/RefreshContext";
import {
  IStudent,
  StudentCategoryEnum,
  studentSchema,
} from "@/src/interfaces/Student";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import { StudentUpForm } from "./student-form";

type StudentFormData = z.infer<typeof studentSchema>;

const DEFAULT_PHONE = "+243000000000";

function normalizeDate(value: Date | string | null | undefined) {
  const date = value instanceof Date ? value : value ? new Date(value) : null;

  return date && !Number.isNaN(date.getTime()) ? date : new Date();
}

function normalizeSexe(value?: string | null) {
  const sexe = value?.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lower = sexe?.toLowerCase();

  if (lower === "m" || lower === "masculin") return "M";
  if (lower === "f" || lower === "feminin") return "F";

  return "";
}

function normalizePhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  const local = digits.startsWith("243") ? digits.slice(3) : digits;

  return local.length === 9 ? `+243${local}` : DEFAULT_PHONE;
}

function normalizeCategory(value: unknown): StudentFormData["category"] {
  const parsed = StudentCategoryEnum.safeParse(value);

  return parsed.success ? parsed.data : "NORMAL";
}

interface UpdateStudentDialogProps
  extends React.ComponentPropsWithoutRef<typeof Sheet> {
  onSuccess?: () => void;
  student: IStudent;
}

export function UpdateStudentDialog({
  onSuccess,
  student,
  open,
  onOpenChange,
  ...props
}: UpdateStudentDialogProps) {
  const peopleLabels = useBranchPeopleLabels();
  const { refresh } = useRefresh();

  const initialData: StudentFormData & {
    studentExtra: {
      nationalite: string;
      autreNationalite: string;
      territoireAutreNationalite: string;
      langue: string;
    };
  } = {
    studentId: student.id,
    memberId: student.memberId,
    username: student.username ?? "",
    name: student.nom ?? "",
    email: student.email ?? "",
    telephone: normalizePhone(student.telephone),
    prenom: student.prenom ?? "",
    postnom: student.postnom ?? "",
    sexe: normalizeSexe(student.sexe),
    dateOfBirth: normalizeDate(student.dateOfBirth),
    parentId: student.parent?.id ?? "",
    address: student.address ?? "",
    placeOfBirth: student.placeOfBirth ?? "",
    category: normalizeCategory(student.category),
    studentExtra: {
      nationalite: student.nationalite ?? "",
      autreNationalite: student.autreNationalite ?? "",
      territoireAutreNationalite: student.territoireAutreNationalite ?? "",
      langue: student.langue ?? "",
    },
  };

  const handleUpdated = () => {
    refresh();
    onSuccess?.();
    onOpenChange?.(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} {...props}>
      <SheetContent
        side="right"
        className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
      >
        <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
          <SheetTitle>{peopleLabels.editTitle}</SheetTitle>
          <SheetDescription>{peopleLabels.editDescription}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {open ? (
            <StudentUpForm
              key={student.id}
              layout="dialog"
              mode="update"
              initialData={initialData}
              onStudentUpdate={handleUpdated}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
