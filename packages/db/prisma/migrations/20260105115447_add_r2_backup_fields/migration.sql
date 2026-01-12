-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "lastBackupAt" TIMESTAMP(3),
ADD COLUMN     "r2BackupPath" TEXT;
