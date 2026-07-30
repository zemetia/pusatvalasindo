-- Harga Valas: harga beli & jual milik Pusat Valas Indo per mata uang, diisi
-- manual. Satu baris per mata uang (global, bukan per cabang/PT).

CREATE TABLE "CurrencyPrice" (
    "id"         TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "buyPrice"   DECIMAL(18,4) NOT NULL,
    "sellPrice"  DECIMAL(18,4) NOT NULL,
    "note"       TEXT,
    "updatedBy"  TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencyPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CurrencyPrice_currencyId_key" ON "CurrencyPrice"("currencyId");

ALTER TABLE "CurrencyPrice"
  ADD CONSTRAINT "CurrencyPrice_currencyId_fkey"
  FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
