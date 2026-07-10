/*
  Warnings:

  - The values [UNIVERSITAIRE] on the enum `TypeBrache` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TypeBrache_new" AS ENUM ('PRIMAIRE', 'SECONDAIRE');
ALTER TABLE "Branch" ALTER COLUMN "typebranch" TYPE "TypeBrache_new" USING ("typebranch"::text::"TypeBrache_new");
ALTER TYPE "TypeBrache" RENAME TO "TypeBrache_old";
ALTER TYPE "TypeBrache_new" RENAME TO "TypeBrache";
DROP TYPE "public"."TypeBrache_old";
COMMIT;
