-- Allow one atelier course to feed multiple secondary courses (schools).
DROP INDEX IF EXISTS "AtelierCourseLink_atelierCoursId_key";

CREATE UNIQUE INDEX "AtelierCourseLink_atelierCoursId_secondaryCoursId_key"
  ON "AtelierCourseLink"("atelierCoursId", "secondaryCoursId");

CREATE INDEX "AtelierCourseLink_atelierCoursId_idx"
  ON "AtelierCourseLink"("atelierCoursId");
