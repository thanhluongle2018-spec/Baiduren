-- Phase 1: airport/node concurrency, job param snapshots stay on SpeedTest,
-- and a minimal SpeedTestSample table. No public probe endpoints are seeded.

-- AlterTable Airport
ALTER TABLE "Airport" ADD COLUMN "maxConcurrentTests" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Airport" ADD CONSTRAINT "Airport_maxConcurrentTests_min" CHECK ("maxConcurrentTests" >= 1);

-- AlterTable Node
ALTER TABLE "Node" ADD COLUMN "maxConcurrentTests" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Node" ADD CONSTRAINT "Node_maxConcurrentTests_min" CHECK ("maxConcurrentTests" >= 1);

-- SpeedTestServer already has maxConcurrentTests; enforce the same floor.
ALTER TABLE "SpeedTestServer" ADD CONSTRAINT "SpeedTestServer_maxConcurrentTests_min" CHECK ("maxConcurrentTests" >= 1);

-- Claim COUNT(*) helpers
CREATE INDEX "SpeedTest_airportId_status_idx" ON "SpeedTest"("airportId", "status");
CREATE INDEX "SpeedTest_nodeId_status_idx" ON "SpeedTest"("nodeId", "status");

-- CreateTable SpeedTestSample
CREATE TABLE "SpeedTestSample" (
    "id" TEXT NOT NULL,
    "speedTestId" TEXT NOT NULL,
    "stage" "SpeedTestStage" NOT NULL,
    "seq" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "bytes" INTEGER,
    "durationMs" INTEGER,
    "statusCode" INTEGER,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeedTestSample_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpeedTestSample_speedTestId_stage_seq_key" ON "SpeedTestSample"("speedTestId", "stage", "seq");
CREATE INDEX "SpeedTestSample_speedTestId_stage_idx" ON "SpeedTestSample"("speedTestId", "stage");

ALTER TABLE "SpeedTestSample" ADD CONSTRAINT "SpeedTestSample_speedTestId_fkey" FOREIGN KEY ("speedTestId") REFERENCES "SpeedTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
