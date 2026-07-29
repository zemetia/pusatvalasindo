-- Track the value each SmartdealRate row held before its latest cron write,
-- so the UI can flag which currencies changed since the last fetch.

-- AlterTable
ALTER TABLE "SmartdealRate" ADD COLUMN "prevBuy" DOUBLE PRECISION;
ALTER TABLE "SmartdealRate" ADD COLUMN "prevSell" DOUBLE PRECISION;
