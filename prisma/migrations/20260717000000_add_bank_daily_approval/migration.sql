-- Rekening Harian: kepala cabang approval terhadap saldo yang diinput marketing.
-- approvedBalance = hitungan kepala cabang sendiri; selisih dihitung di aplikasi
-- terhadap `balance`. approvedAt diisi begitu kepala cabang menyimpan approvalnya.
ALTER TABLE "DailyBankEntry" ADD COLUMN "approvedBalance" DECIMAL(65,30);
ALTER TABLE "DailyBankEntry" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "DailyBankEntry" ADD COLUMN "approvedBy" TEXT;
