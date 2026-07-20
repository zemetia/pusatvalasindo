-- Konfirmasi Kepala Cabang: hitung ulang manual kepala cabang atas total stock (per item)
-- dan total kas (gabungan), dibandingkan dengan total sistem hasil input teller dalam.
-- Selisih dihitung di aplikasi, tidak disimpan. totalIdr = rollup harian per PT.

-- CreateTable
CREATE TABLE "StockistHeadConfirmation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyStockItemId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "confirmedQuantity" DECIMAL(65,30) NOT NULL,
    "confirmedIdrValue" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockistHeadConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KasHeadConfirmation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "confirmedIdrValue" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KasHeadConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyHeadConfirmationTotal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalIdr" DECIMAL(65,30) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyHeadConfirmationTotal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockistHeadConfirmation_companyId_date_idx" ON "StockistHeadConfirmation"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StockistHeadConfirmation_companyId_companyStockItemId_date_key" ON "StockistHeadConfirmation"("companyId", "companyStockItemId", "date");

-- CreateIndex
CREATE INDEX "KasHeadConfirmation_companyId_date_idx" ON "KasHeadConfirmation"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "KasHeadConfirmation_companyId_date_key" ON "KasHeadConfirmation"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyHeadConfirmationTotal_companyId_date_key" ON "CompanyHeadConfirmationTotal"("companyId", "date");

-- AddForeignKey
ALTER TABLE "StockistHeadConfirmation" ADD CONSTRAINT "StockistHeadConfirmation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockistHeadConfirmation" ADD CONSTRAINT "StockistHeadConfirmation_companyStockItemId_fkey" FOREIGN KEY ("companyStockItemId") REFERENCES "CompanyStockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KasHeadConfirmation" ADD CONSTRAINT "KasHeadConfirmation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyHeadConfirmationTotal" ADD CONSTRAINT "CompanyHeadConfirmationTotal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
