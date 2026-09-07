CREATE TABLE "AttendanceFaceDescriptor" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "personType" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "descriptor" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceFaceDescriptor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendanceFaceDescriptor_branchId_personType_personId_key"
  ON "AttendanceFaceDescriptor"("branchId", "personType", "personId");

CREATE INDEX "AttendanceFaceDescriptor_branchId_idx"
  ON "AttendanceFaceDescriptor"("branchId");

ALTER TABLE "AttendanceFaceDescriptor"
  ADD CONSTRAINT "AttendanceFaceDescriptor_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
