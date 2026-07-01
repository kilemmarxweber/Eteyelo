"use client";

import * as React from "react";
import type { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRefresh } from "@/src/hooks/RefreshContext";
import {
  IStudent,
  StudentCategoryEnum,
  studentSchema,
} from "@/src/interfaces/Student";
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
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  student: IStudent;
}

export function UpdateStudentDialog({
  onSuccess,
  student,
  onOpenChange,
  ...props
}: UpdateStudentDialogProps) {
  const { refresh } = useRefresh();
  const initialData: StudentFormData = {
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
    category: normalizeCategory(student.category),
  };

  const handleUpdate = () => {
    refresh();
    onSuccess?.();
    onOpenChange?.(false);
  };

  return (
    <Dialog onOpenChange={onOpenChange} {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editer l'eleve</DialogTitle>
          <DialogDescription>
            Modifiez les details de l'eleve ici. Cliquez sur Enregistrer lorsque
            vous avez termine.
          </DialogDescription>
        </DialogHeader>
        <StudentUpForm
          mode="update"
          initialData={initialData}
          onStudentUpdate={handleUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
