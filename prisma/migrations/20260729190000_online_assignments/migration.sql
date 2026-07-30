-- CreateEnum
CREATE TYPE "OnlineAssignmentType" AS ENUM ('DEVOIR', 'EVALUATION');
CREATE TYPE "OnlineAssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "OnlineQuestionType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'FILE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE');
CREATE TYPE "OnlineSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'GRADED');

-- CreateTable
CREATE TABLE "OnlineAssignment" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "teachingId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "periodId" INTEGER NOT NULL,
    "type" "OnlineAssignmentType" NOT NULL DEFAULT 'DEVOIR',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "OnlineAssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "startAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "activityDate" DATE NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "totalPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resultsPublished" BOOLEAN NOT NULL DEFAULT false,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnlineQuestion" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "type" "OnlineQuestionType" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "statementHtml" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "settingsJson" JSONB,
    "correctAnswerJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnlineQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OnlineQuestionOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnlineSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "OnlineSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "provisionalScore" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnlineAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerText" TEXT,
    "answerJson" JSONB,
    "awardedPoints" DOUBLE PRECISION,
    "isCorrect" BOOLEAN,
    "needsManual" BOOLEAN NOT NULL DEFAULT false,
    "teacherFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnlineSubmissionFile" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineSubmissionFile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "fiche" ADD COLUMN "onlineAssignmentId" TEXT;

CREATE UNIQUE INDEX "fiche_onlineAssignmentId_key" ON "fiche"("onlineAssignmentId");

CREATE UNIQUE INDEX "OnlineAssignment_branchId_classId_courseId_type_activityDate_key"
  ON "OnlineAssignment"("branchId", "classId", "courseId", "type", "activityDate");
CREATE INDEX "OnlineAssignment_branchId_idx" ON "OnlineAssignment"("branchId");
CREATE INDEX "OnlineAssignment_branchId_classId_dueAt_idx" ON "OnlineAssignment"("branchId", "classId", "dueAt");
CREATE INDEX "OnlineAssignment_teacherId_idx" ON "OnlineAssignment"("teacherId");
CREATE INDEX "OnlineAssignment_schoolYearId_idx" ON "OnlineAssignment"("schoolYearId");
CREATE INDEX "OnlineAssignment_status_startAt_dueAt_idx" ON "OnlineAssignment"("status", "startAt", "dueAt");

CREATE INDEX "OnlineQuestion_assignmentId_position_idx" ON "OnlineQuestion"("assignmentId", "position");
CREATE INDEX "OnlineQuestionOption_questionId_position_idx" ON "OnlineQuestionOption"("questionId", "position");
CREATE UNIQUE INDEX "OnlineSubmission_assignmentId_studentId_attempt_key" ON "OnlineSubmission"("assignmentId", "studentId", "attempt");
CREATE INDEX "OnlineSubmission_assignmentId_status_idx" ON "OnlineSubmission"("assignmentId", "status");
CREATE INDEX "OnlineSubmission_studentId_idx" ON "OnlineSubmission"("studentId");
CREATE UNIQUE INDEX "OnlineAnswer_submissionId_questionId_key" ON "OnlineAnswer"("submissionId", "questionId");
CREATE INDEX "OnlineAnswer_questionId_idx" ON "OnlineAnswer"("questionId");
CREATE INDEX "OnlineSubmissionFile_submissionId_idx" ON "OnlineSubmissionFile"("submissionId");

ALTER TABLE "OnlineAssignment" ADD CONSTRAINT "OnlineAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineAssignment" ADD CONSTRAINT "OnlineAssignment_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineAssignment" ADD CONSTRAINT "OnlineAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Classe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineAssignment" ADD CONSTRAINT "OnlineAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineAssignment" ADD CONSTRAINT "OnlineAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnlineQuestion" ADD CONSTRAINT "OnlineQuestion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "OnlineAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineQuestionOption" ADD CONSTRAINT "OnlineQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "OnlineQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineSubmission" ADD CONSTRAINT "OnlineSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "OnlineAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineSubmission" ADD CONSTRAINT "OnlineSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineAnswer" ADD CONSTRAINT "OnlineAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "OnlineSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineAnswer" ADD CONSTRAINT "OnlineAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "OnlineQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineSubmissionFile" ADD CONSTRAINT "OnlineSubmissionFile_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "OnlineSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fiche" ADD CONSTRAINT "fiche_onlineAssignmentId_fkey" FOREIGN KEY ("onlineAssignmentId") REFERENCES "OnlineAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
