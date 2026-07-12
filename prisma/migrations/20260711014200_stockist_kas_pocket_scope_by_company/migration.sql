-- Stockist & Kas pockets now belong to a Company (PT), shared across all its branches,
-- instead of belonging to a single Branch. Both tables are empty pre-launch, so this is
-- a straight column swap with no data backfill needed.

-- StockistPocket: branchId -> companyId
ALTER TABLE "StockistPocket" DROP CONSTRAINT "StockistPocket_branchId_fkey";
DROP INDEX "StockistPocket_branchId_idx";
DROP INDEX "StockistPocket_branchId_name_key";

ALTER TABLE "StockistPocket" RENAME COLUMN "branchId" TO "companyId";

CREATE INDEX "StockistPocket_companyId_idx" ON "StockistPocket"("companyId");
CREATE UNIQUE INDEX "StockistPocket_companyId_name_key" ON "StockistPocket"("companyId", "name");

ALTER TABLE "StockistPocket" ADD CONSTRAINT "StockistPocket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- KasPocket: branchId -> companyId
ALTER TABLE "KasPocket" DROP CONSTRAINT "KasPocket_branchId_fkey";
DROP INDEX "KasPocket_branchId_idx";
DROP INDEX "KasPocket_branchId_name_key";

ALTER TABLE "KasPocket" RENAME COLUMN "branchId" TO "companyId";

CREATE INDEX "KasPocket_companyId_idx" ON "KasPocket"("companyId");
CREATE UNIQUE INDEX "KasPocket_companyId_name_key" ON "KasPocket"("companyId", "name");

ALTER TABLE "KasPocket" ADD CONSTRAINT "KasPocket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
