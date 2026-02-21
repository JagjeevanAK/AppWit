-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "lastDeployedAt" TIMESTAMP(3),
ADD COLUMN     "vercelDeployUrl" TEXT,
ADD COLUMN     "vercelProjectId" TEXT;
