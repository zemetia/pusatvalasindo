-- Sinkronisasi Harga Valas dari Patokan Harga.
--
-- `isLocked` adalah satu-satunya pelindung baris dari ditimpa sync; `source`
-- mencatat asal angka yang sedang tampil. Saklar auto-sync disimpan di tabel
-- satu baris tersendiri.

CREATE TYPE "PriceSource" AS ENUM ('MANUAL', 'SYNCED');

ALTER TABLE "CurrencyPrice"
  ADD COLUMN "source"       "PriceSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "isLocked"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE TABLE "CurrencyPriceSyncSetting" (
    "id"             TEXT NOT NULL DEFAULT 'singleton',
    "autoSync"       BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt"      TIMESTAMP(3),
    "lastRunSummary" TEXT,
    "updatedBy"      TEXT,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencyPriceSyncSetting_pkey" PRIMARY KEY ("id")
);
