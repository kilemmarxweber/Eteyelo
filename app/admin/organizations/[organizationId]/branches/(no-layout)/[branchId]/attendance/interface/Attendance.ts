import { z } from "zod";
import { AttendanceStatus } from "@/prisma/generated/prisma/client";

/* =========================
   STUDENT
========================= */
export const studentAttendanceSchema = z.object({
  sessionId: z.string(),
  studentId: z.string(),
  status: z.nativeEnum(AttendanceStatus),
  remark: z.string().optional(),
  justification: z.string().optional(),
});

/* =========================
   TEACHER
========================= */
export const teacherAttendanceSchema = z.object({
  teacherId: z.string(),
  teachingId: z.string().nullable().optional(),
  date: z.coerce.date(),
  status: z.nativeEnum(AttendanceStatus),
  remark: z.string().optional(),
});

/* =========================
   PERSONNEL
========================= */
export const personnelAttendanceSchema = z.object({
  personnelId: z.string(),
  date: z.coerce.date(),
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().optional(),
  status: z.nativeEnum(AttendanceStatus),
  remark: z.string().optional(),
});

export type StudentAttendanceInput = z.infer<typeof studentAttendanceSchema>;

export type TeacherAttendanceInput = z.infer<typeof teacherAttendanceSchema>;

export type PersonnelAttendanceInput = z.infer<
  typeof personnelAttendanceSchema
>;

// export type AttendanceSessionRow = {
//   id: string;

//   date: string;
//   status: string;
//   nom: string;

//   isClosed: boolean | null;

//   type?: "Teacher" | "Student" | "Personnel";

//   cours?: string;
//   classe?: string;

//   teaching?: {
//     classe?: {
//       nameClasse: string;
//     };
//     cours?: {
//       nameCours: string;
//     };
//   };

//   attendances?: any[];
// };
export type AttendanceSessionRow = {
  id: string;
  date: Date;
  status: AttendanceStatus;
  nom: string;
  isClosed: boolean | null;
  type: "Teacher" | "Student" | "Personnel";
  cours?: string;
  classe?: string;
  startTime: Date;
  endTime: Date;
};
