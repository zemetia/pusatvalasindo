-- Make branch relations orphan (SET NULL) when a Branch is deleted.
-- branchId becomes nullable on stock tables so the FK can be nulled out.

-- DropForeignKey
ALTER TABLE "CurrencyStock" DROP CONSTRAINT "CurrencyStock_branchId_fkey";

-- DropForeignKey
ALTER TABLE "StockItem" DROP CONSTRAINT "StockItem_branchId_fkey";

-- DropForeignKey
ALTER TABLE "StockMutation" DROP CONSTRAINT "StockMutation_branchId_fkey";

-- AlterTable
ALTER TABLE "CurrencyStock" ALTER COLUMN "branchId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StockItem" ALTER COLUMN "branchId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StockMutation" ALTER COLUMN "branchId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CurrencyStock" ADD CONSTRAINT "CurrencyStock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMutation" ADD CONSTRAINT "StockMutation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
