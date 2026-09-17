-- AlterTable
ALTER TABLE "Node" ADD COLUMN "protocol" TEXT;
ALTER TABLE "Node" ADD COLUMN "server" TEXT;
ALTER TABLE "Node" ADD COLUMN "port" INTEGER;
ALTER TABLE "Node" ADD COLUMN "regionHint" TEXT;
ALTER TABLE "Node" ADD COLUMN "sourceFormat" TEXT;
ALTER TABLE "Node" ADD COLUMN "fingerprint" TEXT;
ALTER TABLE "Node" ADD COLUMN "rawConfig" TEXT;

-- CreateIndex
CREATE INDEX "Node_airportId_status_idx" ON "Node"("airportId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Node_airportId_fingerprint_key" ON "Node"("airportId", "fingerprint");
