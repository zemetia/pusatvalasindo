-- StockistDailyCheck.quantitySnapshot was auto-filled from the system running balance the
-- moment the grid was opened, which made every cell reviewable immediately. It's replaced by
-- a manually-entered opname value that starts empty and can only be set once, on the day of.
ALTER TABLE "StockistDailyCheck" RENAME COLUMN "quantitySnapshot" TO "enteredQuantity";
ALTER TABLE "StockistDailyCheck" ALTER COLUMN "enteredQuantity" DROP DEFAULT;
ALTER TABLE "StockistDailyCheck" ALTER COLUMN "enteredQuantity" DROP NOT NULL;
ALTER TABLE "StockistDailyCheck" ADD COLUMN "filledAt" TIMESTAMP(3);
ALTER TABLE "StockistDailyCheck" ADD COLUMN "filledBy" TEXT;
