-- CreateEnum
CREATE TYPE "SpeedTestStage" AS ENUM ('LATENCY', 'PACKET_LOSS', 'SINGLE_DOWNLOAD', 'MULTI_DOWNLOAD', 'SINGLE_UPLOAD', 'MULTI_UPLOAD', 'COMPLETE');

-- CreateEnum
CREATE TYPE "SpeedTestStageStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'TIMEOUT', 'FAILED', 'SKIPPED');

-- AlterTable SpeedTest: test parameter snapshot + capacity snapshot (all nullable)
ALTER TABLE "SpeedTest" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "SpeedTest" ADD COLUMN "testVersion" TEXT;
ALTER TABLE "SpeedTest" ADD COLUMN "currentStage" "SpeedTestStage";
ALTER TABLE "SpeedTest" ADD COLUMN "latencyAttempts" INTEGER;
ALTER TABLE "SpeedTest" ADD COLUMN "pingTimeoutMs" INTEGER;
ALTER TABLE "SpeedTest" ADD COLUMN "downloadConcurrency" INTEGER;
ALTER TABLE "SpeedTest" ADD COLUMN "uploadConcurrency" INTEGER;
ALTER TABLE "SpeedTest" ADD COLUMN "singleDownloadCapBytes" INTEGER;
ALTER TABLE "SpeedTest" ADD COLUMN "multiDownloadCapBytes" INTEGER;
ALTER TABLE "SpeedTest" ADD COLUMN "singleUploadCapBytes" INTEGER;
ALTER TABLE "SpeedTest" ADD COLUMN "multiUploadCapBytes" INTEGER;
ALTER TABLE "SpeedTest" ADD COLUMN "totalTrafficCapBytes" INTEGER;
ALTER TABLE "SpeedTest" ADD COLUMN "serverMaxConcurrencySnapshot" INTEGER;
ALTER TABLE "SpeedTest" ADD COLUMN "serverBandwidthMbpsSnapshot" INTEGER;
ALTER TABLE "SpeedTest" ADD COLUMN "nodeConcurrencySnapshot" INTEGER;
ALTER TABLE "SpeedTest" ADD COLUMN "airportConcurrencySnapshot" INTEGER;

-- AlterTable SpeedTestResult: raw metrics. No backfill of fabricated real values.
ALTER TABLE "SpeedTestResult" ADD COLUMN "latencyAvgMs" DECIMAL(12,6);
ALTER TABLE "SpeedTestResult" ADD COLUMN "latencyP50Ms" DECIMAL(12,6);
ALTER TABLE "SpeedTestResult" ADD COLUMN "latencyP90Ms" DECIMAL(12,6);
ALTER TABLE "SpeedTestResult" ADD COLUMN "latencyAttempts" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "latencySuccessCount" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "packetLossTotal" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "packetLossSuccess" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "successRateTotal" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "successRateSuccess" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "singleDownloadBytes" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "singleDownloadDurationMs" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "singleDownloadStatus" "SpeedTestStageStatus";
ALTER TABLE "SpeedTestResult" ADD COLUMN "multiDownloadBytes" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "multiDownloadDurationMs" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "multiDownloadConcurrency" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "multiDownloadStatus" "SpeedTestStageStatus";
ALTER TABLE "SpeedTestResult" ADD COLUMN "singleUploadBytes" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "singleUploadDurationMs" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "singleUploadStatus" "SpeedTestStageStatus";
ALTER TABLE "SpeedTestResult" ADD COLUMN "multiUploadBytes" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "multiUploadDurationMs" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "multiUploadConcurrency" INTEGER;
ALTER TABLE "SpeedTestResult" ADD COLUMN "multiUploadStatus" "SpeedTestStageStatus";
ALTER TABLE "SpeedTestResult" ADD COLUMN "skippedStages" JSONB;
ALTER TABLE "SpeedTestResult" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "SpeedTestResult" ADD COLUMN "errorMessage" TEXT;
ALTER TABLE "SpeedTestResult" ADD COLUMN "exitVerified" BOOLEAN;
ALTER TABLE "SpeedTestResult" ADD COLUMN "directIdentityHash" TEXT;
ALTER TABLE "SpeedTestResult" ADD COLUMN "proxiedIdentityHash" TEXT;
