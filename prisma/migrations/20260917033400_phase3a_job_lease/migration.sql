-- AlterTable
ALTER TABLE "SpeedTest" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
ALTER TABLE "SpeedTest" ADD COLUMN "heartbeatAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SpeedTest_status_leaseExpiresAt_idx" ON "SpeedTest"("status", "leaseExpiresAt");
