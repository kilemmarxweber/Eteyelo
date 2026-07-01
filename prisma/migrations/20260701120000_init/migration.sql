-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Day" AS ENUM ('Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi');

-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('JOURNALIER', 'HEBDOMADAIRE', 'MENSUEL', 'SEMESTRIEL', 'TRIMESTRIEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('LOGIN', 'LOGOUT', 'VISITED_PAGE', 'ACTION');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('MOBILE', 'DESKTOP', 'TABLET', 'OTHER');

-- CreateEnum
CREATE TYPE "DiscountScope" AS ENUM ('PARENT', 'GROUP', 'ORPHAN');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'CARTE_BANCAIRE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ESPECES', 'MPESA', 'AIRTEL_MONEY', 'ORANGE_MONEY', 'CARTE', 'BANQUE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('VALIDE', 'ANNULE', 'EN_ATTENTE', 'REMBOURSE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "StudentCategory" AS ENUM ('NORMAL', 'ORPHAN', 'VIP', 'SPONSORED', 'GROUPE');

-- CreateEnum
CREATE TYPE "BranchRole" AS ENUM ('DIRECTOR', 'CAISSIER', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "postnom" TEXT,
    "prenom" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "sexe" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "address" TEXT,
    "statusUser" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parent" (
    "id" TEXT NOT NULL,
    "branchMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "branchMemberId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "category" "StudentCategory" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "teachingId" TEXT NOT NULL,
    "validatedByTeacherId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "schoolYearId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "justification" TEXT,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "StudentAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAttendance" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "TeacherAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelAttendance" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "PersonnelAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentFeedback" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "month" INTEGER NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "ParentFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGrade" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "periodId" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "StudentGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Personnel" (
    "id" TEXT NOT NULL,
    "branchMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Frais" (
    "id" TEXT NOT NULL,
    "nameFrais" TEXT NOT NULL,
    "montantFrais" DECIMAL(10,2) NOT NULL,
    "statusFrais" BOOLEAN NOT NULL DEFAULT true,
    "classeId" TEXT NOT NULL,
    "typeFraisId" TEXT NOT NULL,
    "echeance" TIMESTAMP(3),
    "schoolYearId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 99,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "Frais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TypeFrais" (
    "id" TEXT NOT NULL,
    "codeType" TEXT NOT NULL,
    "nameType" TEXT NOT NULL,
    "description" TEXT,
    "statusType" BOOLEAN NOT NULL DEFAULT true,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TypeFrais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classe" (
    "id" TEXT NOT NULL,
    "codeClasse" TEXT NOT NULL,
    "nameClasse" TEXT NOT NULL,
    "optionId" TEXT,
    "statusClasse" BOOLEAN,
    "creneauId" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creneau" (
    "id" TEXT NOT NULL,
    "nameCreneau" TEXT NOT NULL,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    "durationCourse" INTEGER NOT NULL,
    "recreationHour" TIME NOT NULL,
    "recreationDuration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "Creneau_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" TEXT NOT NULL,
    "codeOption" TEXT NOT NULL,
    "nameOption" TEXT NOT NULL,
    "sectionId" TEXT,
    "statusOption" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "codeSection" TEXT NOT NULL,
    "nameSection" TEXT NOT NULL,
    "statusSection" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolYear" (
    "id" TEXT NOT NULL,
    "nameYear" TEXT NOT NULL,
    "startYear" TIMESTAMP(3) NOT NULL,
    "endYear" TIMESTAMP(3) NOT NULL,
    "isCurrentYear" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "SchoolYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassEnrollment" (
    "id" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "statusEnrollment" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "ClassEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "branchMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teaching" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "titulaire" BOOLEAN,
    "statusTeaching" BOOLEAN,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "coursId" TEXT NOT NULL,

    CONSTRAINT "Teaching_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cours" (
    "id" TEXT NOT NULL,
    "codeCours" TEXT NOT NULL,
    "nameCours" TEXT NOT NULL,
    "description" TEXT,
    "ponderation" INTEGER NOT NULL,
    "statusCours" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "Cours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "day" "Day" NOT NULL,
    "hour" TIME NOT NULL,
    "teachingId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "dateStart" TIMESTAMP(3) NOT NULL,
    "dateEnd" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "teachingId" TEXT,
    "typeId" TEXT,
    "classeId" TEXT,
    "branchId" TEXT NOT NULL,
    "recurrence" "Recurrence" DEFAULT 'HEBDOMADAIRE',

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semester" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "semesterId" INTEGER NOT NULL,
    "gradesGenerated" BOOLEAN NOT NULL DEFAULT false,
    "gradesGeneratedAt" TIMESTAMP(3),
    "branchId" TEXT NOT NULL,

    CONSTRAINT "period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodResultLock" (
    "id" TEXT NOT NULL,
    "periodId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAT" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "PeriodResultLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiche" (
    "id" TEXT NOT NULL,
    "dateCreated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateUpdated" TIMESTAMP(3) NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "teacherId" TEXT NOT NULL,
    "typeFiche" TEXT NOT NULL,
    "classSectionId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "coursName" TEXT NOT NULL,
    "classeName" TEXT NOT NULL,
    "periodId" INTEGER NOT NULL,
    "periodeName" TEXT NOT NULL,
    "anneeId" TEXT NOT NULL,
    "anneeName" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "autres" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "fiche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "YearId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "branchId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentBatch" (
    "id" SERIAL NOT NULL,
    "parentId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "PaymentBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyPayment" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "batchId" INTEGER,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "notes" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fraisId" TEXT NOT NULL,
    "classEnrollmentId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "FamilyPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashierExpense" (
    "id" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "CashierExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" SERIAL NOT NULL,
    "familyPaymentId" TEXT NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileMoneyTransaction" (
    "id" SERIAL NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" "PaymentMethod" NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "rawResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "MobileMoneyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" SERIAL NOT NULL,
    "paymentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountRule" (
    "id" SERIAL NOT NULL,
    "scope" "DiscountScope" NOT NULL,
    "category" "StudentCategory",
    "parentId" TEXT,
    "minChildren" INTEGER,
    "percentage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,
    "activeOrganizationId" TEXT,
    "activeBranchId" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizationRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "organizationRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "attendanceRadius" INTEGER NOT NULL DEFAULT 100,
    "organizationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchMember" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" "BranchRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "role" "BranchRole" NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PeriodSubjects" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PeriodSubjects_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_telephone_idx" ON "user"("telephone");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE INDEX "user_statusUser_idx" ON "user"("statusUser");

-- CreateIndex
CREATE UNIQUE INDEX "Parent_branchMemberId_key" ON "Parent"("branchMemberId");

-- CreateIndex
CREATE INDEX "Student_parentId_idx" ON "Student"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_branchMemberId_key" ON "Student"("branchMemberId");

-- CreateIndex
CREATE INDEX "AttendanceSession_branchId_idx" ON "AttendanceSession"("branchId");

-- CreateIndex
CREATE INDEX "AttendanceSession_schoolYearId_idx" ON "AttendanceSession"("schoolYearId");

-- CreateIndex
CREATE INDEX "AttendanceSession_validatedByTeacherId_idx" ON "AttendanceSession"("validatedByTeacherId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSession_teachingId_date_startTime_key" ON "AttendanceSession"("teachingId", "date", "startTime");

-- CreateIndex
CREATE INDEX "StudentAttendance_studentId_idx" ON "StudentAttendance"("studentId");

-- CreateIndex
CREATE INDEX "StudentAttendance_status_idx" ON "StudentAttendance"("status");

-- CreateIndex
CREATE INDEX "StudentAttendance_recordedAt_idx" ON "StudentAttendance"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAttendance_branchId_sessionId_studentId_key" ON "StudentAttendance"("branchId", "sessionId", "studentId");

-- CreateIndex
CREATE INDEX "TeacherAttendance_branchId_idx" ON "TeacherAttendance"("branchId");

-- CreateIndex
CREATE INDEX "TeacherAttendance_branchId_date_idx" ON "TeacherAttendance"("branchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAttendance_teacherId_sessionId_branchId_key" ON "TeacherAttendance"("teacherId", "sessionId", "branchId");

-- CreateIndex
CREATE INDEX "PersonnelAttendance_branchId_idx" ON "PersonnelAttendance"("branchId");

-- CreateIndex
CREATE INDEX "PersonnelAttendance_branchId_date_idx" ON "PersonnelAttendance"("branchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PersonnelAttendance_personnelId_date_branchId_key" ON "PersonnelAttendance"("personnelId", "date", "branchId");

-- CreateIndex
CREATE INDEX "ParentFeedback_branchId_idx" ON "ParentFeedback"("branchId");

-- CreateIndex
CREATE INDEX "ParentFeedback_branchId_schoolYearId_idx" ON "ParentFeedback"("branchId", "schoolYearId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentFeedback_parentId_month_schoolYearId_key" ON "ParentFeedback"("parentId", "month", "schoolYearId");

-- CreateIndex
CREATE INDEX "StudentGrade_studentId_idx" ON "StudentGrade"("studentId");

-- CreateIndex
CREATE INDEX "StudentGrade_schoolYearId_idx" ON "StudentGrade"("schoolYearId");

-- CreateIndex
CREATE INDEX "StudentGrade_periodId_idx" ON "StudentGrade"("periodId");

-- CreateIndex
CREATE INDEX "StudentGrade_branchId_idx" ON "StudentGrade"("branchId");

-- CreateIndex
CREATE INDEX "StudentGrade_branchId_schoolYearId_idx" ON "StudentGrade"("branchId", "schoolYearId");

-- CreateIndex
CREATE INDEX "StudentGrade_branchId_periodId_idx" ON "StudentGrade"("branchId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGrade_studentId_periodId_key" ON "StudentGrade"("studentId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_branchMemberId_key" ON "Personnel"("branchMemberId");

-- CreateIndex
CREATE INDEX "Frais_classeId_idx" ON "Frais"("classeId");

-- CreateIndex
CREATE INDEX "Frais_schoolYearId_idx" ON "Frais"("schoolYearId");

-- CreateIndex
CREATE INDEX "Frais_typeFraisId_idx" ON "Frais"("typeFraisId");

-- CreateIndex
CREATE INDEX "Frais_branchId_idx" ON "Frais"("branchId");

-- CreateIndex
CREATE INDEX "Frais_branchId_schoolYearId_idx" ON "Frais"("branchId", "schoolYearId");

-- CreateIndex
CREATE INDEX "Frais_branchId_classeId_idx" ON "Frais"("branchId", "classeId");

-- CreateIndex
CREATE UNIQUE INDEX "TypeFrais_codeType_key" ON "TypeFrais"("codeType");

-- CreateIndex
CREATE INDEX "TypeFrais_branchId_idx" ON "TypeFrais"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Classe_codeClasse_key" ON "Classe"("codeClasse");

-- CreateIndex
CREATE INDEX "Classe_branchId_idx" ON "Classe"("branchId");

-- CreateIndex
CREATE INDEX "Classe_optionId_idx" ON "Classe"("optionId");

-- CreateIndex
CREATE INDEX "Classe_branchId_optionId_idx" ON "Classe"("branchId", "optionId");

-- CreateIndex
CREATE INDEX "Creneau_branchId_idx" ON "Creneau"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Option_codeOption_key" ON "Option"("codeOption");

-- CreateIndex
CREATE INDEX "Option_branchId_idx" ON "Option"("branchId");

-- CreateIndex
CREATE INDEX "Option_sectionId_idx" ON "Option"("sectionId");

-- CreateIndex
CREATE INDEX "Option_branchId_sectionId_idx" ON "Option"("branchId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_codeSection_key" ON "Section"("codeSection");

-- CreateIndex
CREATE UNIQUE INDEX "Section_nameSection_key" ON "Section"("nameSection");

-- CreateIndex
CREATE INDEX "Section_branchId_idx" ON "Section"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolYear_nameYear_key" ON "SchoolYear"("nameYear");

-- CreateIndex
CREATE INDEX "SchoolYear_branchId_startYear_endYear_idx" ON "SchoolYear"("branchId", "startYear", "endYear");

-- CreateIndex
CREATE INDEX "SchoolYear_branchId_isCurrentYear_idx" ON "SchoolYear"("branchId", "isCurrentYear");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolYear_branchId_startYear_endYear_key" ON "SchoolYear"("branchId", "startYear", "endYear");

-- CreateIndex
CREATE INDEX "ClassEnrollment_schoolYearId_idx" ON "ClassEnrollment"("schoolYearId");

-- CreateIndex
CREATE INDEX "ClassEnrollment_classeId_idx" ON "ClassEnrollment"("classeId");

-- CreateIndex
CREATE INDEX "ClassEnrollment_studentId_idx" ON "ClassEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "ClassEnrollment_branchId_idx" ON "ClassEnrollment"("branchId");

-- CreateIndex
CREATE INDEX "ClassEnrollment_branchId_classeId_idx" ON "ClassEnrollment"("branchId", "classeId");

-- CreateIndex
CREATE INDEX "ClassEnrollment_branchId_schoolYearId_idx" ON "ClassEnrollment"("branchId", "schoolYearId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassEnrollment_schoolYearId_studentId_key" ON "ClassEnrollment"("schoolYearId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_branchMemberId_key" ON "Teacher"("branchMemberId");

-- CreateIndex
CREATE INDEX "Teaching_teacherId_idx" ON "Teaching"("teacherId");

-- CreateIndex
CREATE INDEX "Teaching_classeId_idx" ON "Teaching"("classeId");

-- CreateIndex
CREATE INDEX "Teaching_schoolYearId_idx" ON "Teaching"("schoolYearId");

-- CreateIndex
CREATE INDEX "Teaching_branchId_idx" ON "Teaching"("branchId");

-- CreateIndex
CREATE INDEX "Teaching_branchId_teacherId_idx" ON "Teaching"("branchId", "teacherId");

-- CreateIndex
CREATE INDEX "Teaching_branchId_classeId_idx" ON "Teaching"("branchId", "classeId");

-- CreateIndex
CREATE INDEX "Teaching_branchId_schoolYearId_idx" ON "Teaching"("branchId", "schoolYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Teaching_classeId_schoolYearId_coursId_key" ON "Teaching"("classeId", "schoolYearId", "coursId");

-- CreateIndex
CREATE UNIQUE INDEX "Cours_codeCours_key" ON "Cours"("codeCours");

-- CreateIndex
CREATE INDEX "Cours_branchId_idx" ON "Cours"("branchId");

-- CreateIndex
CREATE INDEX "Schedule_teachingId_idx" ON "Schedule"("teachingId");

-- CreateIndex
CREATE INDEX "Schedule_createdBy_idx" ON "Schedule"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "unique_schedule_per_teacher" ON "Schedule"("day", "hour", "teachingId");

-- CreateIndex
CREATE INDEX "CalendarEvent_schoolYearId_idx" ON "CalendarEvent"("schoolYearId");

-- CreateIndex
CREATE INDEX "CalendarEvent_typeId_idx" ON "CalendarEvent"("typeId");

-- CreateIndex
CREATE INDEX "CalendarEvent_branchId_idx" ON "CalendarEvent"("branchId");

-- CreateIndex
CREATE INDEX "CalendarEvent_branchId_schoolYearId_idx" ON "CalendarEvent"("branchId", "schoolYearId");

-- CreateIndex
CREATE INDEX "CalendarEvent_branchId_dateStart_idx" ON "CalendarEvent"("branchId", "dateStart");

-- CreateIndex
CREATE UNIQUE INDEX "EventType_name_key" ON "EventType"("name");

-- CreateIndex
CREATE INDEX "EventType_branchId_idx" ON "EventType"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "EventType_branchId_name_key" ON "EventType"("branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_label_key" ON "semester"("label");

-- CreateIndex
CREATE INDEX "semester_branchId_idx" ON "semester"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "semester_branchId_label_key" ON "semester"("branchId", "label");

-- CreateIndex
CREATE INDEX "Period_semesterId_fkey" ON "period"("semesterId");

-- CreateIndex
CREATE INDEX "period_branchId_idx" ON "period"("branchId");

-- CreateIndex
CREATE INDEX "period_branchId_semesterId_idx" ON "period"("branchId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "period_branchId_semesterId_label_key" ON "period"("branchId", "semesterId", "label");

-- CreateIndex
CREATE INDEX "PeriodResultLock_branchId_idx" ON "PeriodResultLock"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodResultLock_periodId_key" ON "PeriodResultLock"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodResultLock_branchId_periodId_key" ON "PeriodResultLock"("branchId", "periodId");

-- CreateIndex
CREATE INDEX "Fiche_lessonId_fkey" ON "fiche"("lessonId");

-- CreateIndex
CREATE INDEX "Fiche_periodId_fkey" ON "fiche"("periodId");

-- CreateIndex
CREATE INDEX "fiche_branchId_idx" ON "fiche"("branchId");

-- CreateIndex
CREATE INDEX "fiche_branchId_anneeId_idx" ON "fiche"("branchId", "anneeId");

-- CreateIndex
CREATE INDEX "fiche_branchId_periodId_idx" ON "fiche"("branchId", "periodId");

-- CreateIndex
CREATE INDEX "fiche_branchId_teacherId_idx" ON "fiche"("branchId", "teacherId");

-- CreateIndex
CREATE INDEX "Invoice_branchId_idx" ON "Invoice"("branchId");

-- CreateIndex
CREATE INDEX "Invoice_branchId_YearId_idx" ON "Invoice"("branchId", "YearId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_branchId_enrollmentId_YearId_key" ON "Invoice"("branchId", "enrollmentId", "YearId");

-- CreateIndex
CREATE INDEX "PaymentBatch_branchId_idx" ON "PaymentBatch"("branchId");

-- CreateIndex
CREATE INDEX "PaymentBatch_branchId_parentId_idx" ON "PaymentBatch"("branchId", "parentId");

-- CreateIndex
CREATE INDEX "FamilyPayment_fraisId_idx" ON "FamilyPayment"("fraisId");

-- CreateIndex
CREATE INDEX "FamilyPayment_classEnrollmentId_idx" ON "FamilyPayment"("classEnrollmentId");

-- CreateIndex
CREATE INDEX "FamilyPayment_transactionRef_idx" ON "FamilyPayment"("transactionRef");

-- CreateIndex
CREATE INDEX "FamilyPayment_branchId_idx" ON "FamilyPayment"("branchId");

-- CreateIndex
CREATE INDEX "FamilyPayment_branchId_parentId_idx" ON "FamilyPayment"("branchId", "parentId");

-- CreateIndex
CREATE INDEX "FamilyPayment_branchId_createdAt_idx" ON "FamilyPayment"("branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyPayment_branchId_transactionRef_key" ON "FamilyPayment"("branchId", "transactionRef");

-- CreateIndex
CREATE INDEX "CashierExpense_branchId_idx" ON "CashierExpense"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "CashierExpense_branchId_transactionRef_key" ON "CashierExpense"("branchId", "transactionRef");

-- CreateIndex
CREATE INDEX "PaymentAllocation_branchId_idx" ON "PaymentAllocation"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_familyPaymentId_invoiceId_key" ON "PaymentAllocation"("familyPaymentId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "MobileMoneyTransaction_paymentId_key" ON "MobileMoneyTransaction"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "MobileMoneyTransaction_externalId_key" ON "MobileMoneyTransaction"("externalId");

-- CreateIndex
CREATE INDEX "MobileMoneyTransaction_branchId_idx" ON "MobileMoneyTransaction"("branchId");

-- CreateIndex
CREATE INDEX "MobileMoneyTransaction_branchId_externalId_idx" ON "MobileMoneyTransaction"("branchId", "externalId");

-- CreateIndex
CREATE INDEX "PaymentEvent_branchId_idx" ON "PaymentEvent"("branchId");

-- CreateIndex
CREATE INDEX "PaymentEvent_branchId_paymentId_idx" ON "PaymentEvent"("branchId", "paymentId");

-- CreateIndex
CREATE INDEX "DiscountRule_branchId_idx" ON "DiscountRule"("branchId");

-- CreateIndex
CREATE INDEX "DiscountRule_branchId_scope_idx" ON "DiscountRule"("branchId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");

-- CreateIndex
CREATE INDEX "Transaction_branchId_idx" ON "Transaction"("branchId");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "session_activeOrganizationId_idx" ON "session"("activeOrganizationId");

-- CreateIndex
CREATE INDEX "session_activeBranchId_idx" ON "session"("activeBranchId");

-- CreateIndex
CREATE INDEX "session_userId_activeOrganizationId_idx" ON "session"("userId", "activeOrganizationId");

-- CreateIndex
CREATE INDEX "session_userId_activeBranchId_idx" ON "session"("userId", "activeBranchId");

-- CreateIndex
CREATE INDEX "session_expiresAt_idx" ON "session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "account_providerId_idx" ON "account"("providerId");

-- CreateIndex
CREATE INDEX "account_accountId_idx" ON "account"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "verification_expiresAt_idx" ON "verification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "organizationRole_organizationId_idx" ON "organizationRole"("organizationId");

-- CreateIndex
CREATE INDEX "organizationRole_role_idx" ON "organizationRole"("role");

-- CreateIndex
CREATE UNIQUE INDEX "organizationRole_organizationId_role_key" ON "organizationRole"("organizationId", "role");

-- CreateIndex
CREATE INDEX "member_organizationId_idx" ON "member"("organizationId");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "member"("userId");

-- CreateIndex
CREATE INDEX "member_organizationId_role_idx" ON "member"("organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

-- CreateIndex
CREATE INDEX "invitation_organizationId_status_idx" ON "invitation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "invitation_expiresAt_idx" ON "invitation"("expiresAt");

-- CreateIndex
CREATE INDEX "invitation_inviterId_idx" ON "invitation"("inviterId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_email_idx" ON "invitation"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Branch_organizationId_idx" ON "Branch"("organizationId");

-- CreateIndex
CREATE INDEX "Branch_organizationId_isActive_idx" ON "Branch"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Branch_code_idx" ON "Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_organizationId_code_key" ON "Branch"("organizationId", "code");

-- CreateIndex
CREATE INDEX "BranchMember_branchId_idx" ON "BranchMember"("branchId");

-- CreateIndex
CREATE INDEX "BranchMember_memberId_idx" ON "BranchMember"("memberId");

-- CreateIndex
CREATE INDEX "BranchMember_branchId_role_idx" ON "BranchMember"("branchId", "role");

-- CreateIndex
CREATE INDEX "BranchMember_memberId_role_idx" ON "BranchMember"("memberId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "BranchMember_branchId_memberId_key" ON "BranchMember"("branchId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchInvitation_token_key" ON "BranchInvitation"("token");

-- CreateIndex
CREATE INDEX "BranchInvitation_branchId_idx" ON "BranchInvitation"("branchId");

-- CreateIndex
CREATE INDEX "BranchInvitation_email_idx" ON "BranchInvitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BranchInvitation_branchId_email_key" ON "BranchInvitation"("branchId", "email");

-- CreateIndex
CREATE INDEX "_PeriodSubjects_B_index" ON "_PeriodSubjects"("B");

-- AddForeignKey
ALTER TABLE "Parent" ADD CONSTRAINT "Parent_branchMemberId_fkey" FOREIGN KEY ("branchMemberId") REFERENCES "BranchMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_branchMemberId_fkey" FOREIGN KEY ("branchMemberId") REFERENCES "BranchMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_teachingId_fkey" FOREIGN KEY ("teachingId") REFERENCES "Teaching"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_validatedByTeacherId_fkey" FOREIGN KEY ("validatedByTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAttendance" ADD CONSTRAINT "TeacherAttendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAttendance" ADD CONSTRAINT "TeacherAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAttendance" ADD CONSTRAINT "TeacherAttendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelAttendance" ADD CONSTRAINT "PersonnelAttendance_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelAttendance" ADD CONSTRAINT "PersonnelAttendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentFeedback" ADD CONSTRAINT "ParentFeedback_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentFeedback" ADD CONSTRAINT "ParentFeedback_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentFeedback" ADD CONSTRAINT "ParentFeedback_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrade" ADD CONSTRAINT "StudentGrade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrade" ADD CONSTRAINT "StudentGrade_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrade" ADD CONSTRAINT "StudentGrade_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrade" ADD CONSTRAINT "StudentGrade_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_branchMemberId_fkey" FOREIGN KEY ("branchMemberId") REFERENCES "BranchMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Frais" ADD CONSTRAINT "Frais_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Frais" ADD CONSTRAINT "Frais_typeFraisId_fkey" FOREIGN KEY ("typeFraisId") REFERENCES "TypeFrais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Frais" ADD CONSTRAINT "Frais_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Frais" ADD CONSTRAINT "Frais_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TypeFrais" ADD CONSTRAINT "TypeFrais_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classe" ADD CONSTRAINT "Classe_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classe" ADD CONSTRAINT "Classe_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classe" ADD CONSTRAINT "Classe_creneauId_fkey" FOREIGN KEY ("creneauId") REFERENCES "Creneau"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creneau" ADD CONSTRAINT "Creneau_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolYear" ADD CONSTRAINT "SchoolYear_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_branchMemberId_fkey" FOREIGN KEY ("branchMemberId") REFERENCES "BranchMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teaching" ADD CONSTRAINT "Teaching_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teaching" ADD CONSTRAINT "Teaching_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teaching" ADD CONSTRAINT "Teaching_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teaching" ADD CONSTRAINT "Teaching_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teaching" ADD CONSTRAINT "Teaching_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "Cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cours" ADD CONSTRAINT "Cours_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "BranchMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_teachingId_fkey" FOREIGN KEY ("teachingId") REFERENCES "Teaching"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_teachingId_fkey" FOREIGN KEY ("teachingId") REFERENCES "Teaching"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "EventType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventType" ADD CONSTRAINT "EventType_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester" ADD CONSTRAINT "semester_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period" ADD CONSTRAINT "period_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period" ADD CONSTRAINT "period_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodResultLock" ADD CONSTRAINT "PeriodResultLock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiche" ADD CONSTRAINT "Fiche_Id_fkey" FOREIGN KEY ("classSectionId") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiche" ADD CONSTRAINT "fiche_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Teaching"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiche" ADD CONSTRAINT "fiche_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiche" ADD CONSTRAINT "Fiche_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiche" ADD CONSTRAINT "fiche_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ClassEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_YearId_fkey" FOREIGN KEY ("YearId") REFERENCES "SchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyPayment" ADD CONSTRAINT "FamilyPayment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyPayment" ADD CONSTRAINT "FamilyPayment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PaymentBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyPayment" ADD CONSTRAINT "FamilyPayment_fraisId_fkey" FOREIGN KEY ("fraisId") REFERENCES "Frais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyPayment" ADD CONSTRAINT "FamilyPayment_classEnrollmentId_fkey" FOREIGN KEY ("classEnrollmentId") REFERENCES "ClassEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyPayment" ADD CONSTRAINT "FamilyPayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierExpense" ADD CONSTRAINT "CashierExpense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_familyPaymentId_fkey" FOREIGN KEY ("familyPaymentId") REFERENCES "FamilyPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileMoneyTransaction" ADD CONSTRAINT "MobileMoneyTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileMoneyTransaction" ADD CONSTRAINT "MobileMoneyTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "FamilyPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "FamilyPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizationRole" ADD CONSTRAINT "organizationRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMember" ADD CONSTRAINT "BranchMember_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMember" ADD CONSTRAINT "BranchMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchInvitation" ADD CONSTRAINT "BranchInvitation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PeriodSubjects" ADD CONSTRAINT "_PeriodSubjects_A_fkey" FOREIGN KEY ("A") REFERENCES "Cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PeriodSubjects" ADD CONSTRAINT "_PeriodSubjects_B_fkey" FOREIGN KEY ("B") REFERENCES "period"("id") ON DELETE CASCADE ON UPDATE CASCADE;
