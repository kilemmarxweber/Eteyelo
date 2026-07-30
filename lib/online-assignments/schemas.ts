import { z } from "zod";

export const onlineAssignmentTypeSchema = z.enum(["DEVOIR", "EVALUATION"]);
export const onlineQuestionTypeSchema = z.enum([
  "SHORT_TEXT",
  "LONG_TEXT",
  "FILE",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
]);

const optionSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  isCorrect: z.boolean().default(false),
  position: z.number().int().nonnegative().optional(),
});

export const questionInputSchema = z.object({
  id: z.string().optional(),
  type: onlineQuestionTypeSchema,
  position: z.number().int().nonnegative().default(0),
  statementHtml: z.string().min(1),
  points: z.number().positive().default(1),
  settingsJson: z.record(z.string(), z.unknown()).optional().nullable(),
  correctAnswerJson: z.unknown().optional().nullable(),
  options: z.array(optionSchema).optional().default([]),
});

export const createAssignmentSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(10000).optional().nullable(),
  type: onlineAssignmentTypeSchema.default("DEVOIR"),
  classId: z.string().min(1),
  courseId: z.string().min(1),
  teachingId: z.string().min(1),
  teacherId: z.string().min(1),
  periodId: z.number().int().positive(),
  schoolYearId: z.string().min(1),
  startAt: z.coerce.date(),
  dueAt: z.coerce.date(),
  activityDate: z.coerce.date(),
  shuffleOptions: z.boolean().optional().default(false),
  fridayPreset: z.boolean().optional().default(false),
  questions: z.array(questionInputSchema).optional().default([]),
});

export const updateAssignmentSchema = createAssignmentSchema
  .partial()
  .extend({
    id: z.string().min(1),
  });

export const assignmentIdSchema = z.object({
  id: z.string().min(1),
});

export const saveAnswersSchema = z.object({
  assignmentId: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      answerText: z.string().optional().nullable(),
      answerJson: z.unknown().optional().nullable(),
    }),
  ),
});

export const gradeAnswerSchema = z.object({
  submissionId: z.string().min(1),
  questionId: z.string().min(1),
  awardedPoints: z.number().min(0),
  teacherFeedback: z.string().max(2000).optional().nullable(),
});

export const publishResultsSchema = z.object({
  id: z.string().min(1),
  publish: z.boolean().default(true),
});
