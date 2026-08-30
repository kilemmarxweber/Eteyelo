-- CreateTable
CREATE TABLE "TeacherProfileDocument" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherProfileDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherProfileDocument_teacherId_createdAt_idx"
ON "TeacherProfileDocument"("teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherProfileDocument_branchId_createdAt_idx"
ON "TeacherProfileDocument"("branchId", "createdAt");

-- AddForeignKey
ALTER TABLE "TeacherProfileDocument"
ADD CONSTRAINT "TeacherProfileDocument_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfileDocument"
ADD CONSTRAINT "TeacherProfileDocument_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
