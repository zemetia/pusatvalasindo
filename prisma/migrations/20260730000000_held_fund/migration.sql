-- Dana Tertahan (hutang orang ke perusahaan): piutang harian per PT.
--
-- Tanpa kunci unik per tanggal — beda dari DailyBankEntry/KasDailyEntry. Satu
-- tanggal boleh punya nol baris (kondisi normal, bukan "belum diisi") maupun
-- banyak baris, satu per pihak yang uangnya belum masuk.
CREATE TABLE "HeldFund" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "note" TEXT,
    -- settledAt != null adalah satu-satunya penanda lunas; tidak ada boolean
    -- terpisah supaya tidak pernah ada dua sumber kebenaran yang bisa beda.
    "settledAt" TIMESTAMP(3),
    "settledBy" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeldFund_pkey" PRIMARY KEY ("id")
);

-- Dua pola baca yang berbeda: halaman membaca 1 PT × 1 tanggal, laporan membaca
-- yang belum lunas lintas tanggal.
CREATE INDEX "HeldFund_companyId_date_idx" ON "HeldFund"("companyId", "date");
CREATE INDEX "HeldFund_companyId_settledAt_idx" ON "HeldFund"("companyId", "settledAt");

ALTER TABLE "HeldFund"
  ADD CONSTRAINT "HeldFund_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
