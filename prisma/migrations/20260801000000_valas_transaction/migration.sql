-- Transaksi Jual & Beli Valas — satu baris per transaksi nasabah di loket.
-- Harga diambil dari Harga Valas (CurrencyPrice) dan di-snapshot ke barisnya,
-- supaya laporan tanggal lampau tidak ikut berubah saat harga hari ini disimpan.

CREATE TYPE "ValasTransactionType"   AS ENUM ('BUY', 'SELL');
CREATE TYPE "ValasPaymentMethod"     AS ENUM ('CASH', 'TRANSFER');
CREATE TYPE "ValasTransactionStatus" AS ENUM ('COMPLETED', 'VOID');
CREATE TYPE "ValasCustomerIdType"    AS ENUM ('KTP', 'SIM', 'PASSPORT', 'KITAS', 'NPWP', 'LAINNYA');

CREATE TABLE "ValasTransaction" (
    "id"               TEXT NOT NULL,
    "companyId"        TEXT NOT NULL,
    "branchId"         TEXT,
    "invoiceNo"        TEXT NOT NULL,
    "date"             DATE NOT NULL,
    "type"             "ValasTransactionType" NOT NULL,
    "currencyId"       TEXT NOT NULL,
    "amount"           DECIMAL(18,4) NOT NULL,
    "rate"             DECIMAL(18,4) NOT NULL,
    "priceRate"        DECIMAL(18,4),
    "totalIdr"         DECIMAL(18,2) NOT NULL,
    "customerName"     TEXT NOT NULL,
    "customerPhone"    TEXT,
    "customerIdType"   "ValasCustomerIdType",
    "customerIdNumber" TEXT,
    "customerAddress"  TEXT,
    "paymentMethod"    "ValasPaymentMethod" NOT NULL DEFAULT 'CASH',
    "bankAccountId"    TEXT,
    "note"             TEXT,
    "status"           "ValasTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "voidedAt"         TIMESTAMP(3),
    "voidedBy"         TEXT,
    "voidReason"       TEXT,
    "createdBy"        TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValasTransaction_pkey" PRIMARY KEY ("id")
);

-- Nomor bukti unik per PT. Ini juga yang membuat penomoran aman dari balapan:
-- dua kasir yang menekan Simpan bersamaan menghasilkan satu kegagalan unik
-- yang di-retry dengan nomor berikutnya (lihat repository).
CREATE UNIQUE INDEX "ValasTransaction_companyId_invoiceNo_key"
  ON "ValasTransaction"("companyId", "invoiceNo");

CREATE INDEX "ValasTransaction_companyId_date_idx"
  ON "ValasTransaction"("companyId", "date");
CREATE INDEX "ValasTransaction_companyId_currencyId_date_idx"
  ON "ValasTransaction"("companyId", "currencyId", "date");
CREATE INDEX "ValasTransaction_branchId_date_idx"
  ON "ValasTransaction"("branchId", "date");

ALTER TABLE "ValasTransaction"
  ADD CONSTRAINT "ValasTransaction_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ValasTransaction"
  ADD CONSTRAINT "ValasTransaction_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ValasTransaction"
  ADD CONSTRAINT "ValasTransaction_currencyId_fkey"
  FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ValasTransaction"
  ADD CONSTRAINT "ValasTransaction_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
