-- CreateEnum
CREATE TYPE "SpeedTestServerStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterEnum
ALTER TYPE "SpeedTestStatus" ADD VALUE 'SUCCESS';

-- AlterTable SpeedTestServer: add demo-safe metadata (no real IPs)
ALTER TABLE "SpeedTestServer" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'XX';
ALTER TABLE "SpeedTestServer" ADD COLUMN "city" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SpeedTestServer" ADD COLUMN "bandwidthMbps" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "SpeedTestServer" ADD COLUMN "maxConcurrentTests" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SpeedTestServer" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- Replace ContentStatus with SpeedTestServerStatus on SpeedTestServer.status
ALTER TABLE "SpeedTestServer" ADD COLUMN "status_new" "SpeedTestServerStatus" NOT NULL DEFAULT 'DISABLED';
UPDATE "SpeedTestServer" SET "status_new" = 'ACTIVE' WHERE "status"::text = 'ACTIVE';
ALTER TABLE "SpeedTestServer" DROP COLUMN "status";
ALTER TABLE "SpeedTestServer" RENAME COLUMN "status_new" TO "status";

ALTER TABLE "SpeedTestServer" ALTER COLUMN "countryCode" DROP DEFAULT;
ALTER TABLE "SpeedTestServer" ALTER COLUMN "city" DROP DEFAULT;
ALTER TABLE "SpeedTestServer" ALTER COLUMN "bandwidthMbps" DROP DEFAULT;

CREATE INDEX "SpeedTestServer_region_status_idx" ON "SpeedTestServer"("region", "status");

-- AlterTable SpeedTest
ALTER TABLE "SpeedTest" ADD COLUMN "concurrency" INTEGER NOT NULL DEFAULT 1;

-- AlterTable SpeedTestResult: keep legacy columns, add explicit metrics
ALTER TABLE "SpeedTestResult" ADD COLUMN "minLatencyMs" DECIMAL(8,2);
ALTER TABLE "SpeedTestResult" ADD COLUMN "maxLatencyMs" DECIMAL(8,2);
ALTER TABLE "SpeedTestResult" ADD COLUMN "downloadSingleMbps" DECIMAL(10,2);
ALTER TABLE "SpeedTestResult" ADD COLUMN "downloadMultiMbps" DECIMAL(10,2);
ALTER TABLE "SpeedTestResult" ADD COLUMN "uploadSingleMbps" DECIMAL(10,2);
ALTER TABLE "SpeedTestResult" ADD COLUMN "uploadMultiMbps" DECIMAL(10,2);
ALTER TABLE "SpeedTestResult" ADD COLUMN "packetLossPercent" DECIMAL(5,2);
ALTER TABLE "SpeedTestResult" ADD COLUMN "successRatePercent" DECIMAL(5,2);
ALTER TABLE "SpeedTestResult" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- Backfill new metric columns from legacy values so existing demo rows stay valid
UPDATE "SpeedTestResult"
SET
  "minLatencyMs" = COALESCE("minLatencyMs", "latencyMs"),
  "maxLatencyMs" = COALESCE("maxLatencyMs", "latencyMs"),
  "downloadSingleMbps" = COALESCE("downloadSingleMbps", "downloadMbps"),
  "downloadMultiMbps" = COALESCE("downloadMultiMbps", "downloadMbps"),
  "uploadSingleMbps" = COALESCE("uploadSingleMbps", "uploadMbps"),
  "uploadMultiMbps" = COALESCE("uploadMultiMbps", "uploadMbps"),
  "packetLossPercent" = COALESCE("packetLossPercent", "packetLoss"),
  "successRatePercent" = COALESCE("successRatePercent", "successRate"),
  "isDemo" = true;

-- CreateIndex
CREATE INDEX "SpeedTestServer_status_idx" ON "SpeedTestServer"("status");
CREATE INDEX "SpeedTest_serverId_status_idx" ON "SpeedTest"("serverId", "status");
CREATE INDEX "SpeedTestResult_testedAt_idx" ON "SpeedTestResult"("testedAt");
