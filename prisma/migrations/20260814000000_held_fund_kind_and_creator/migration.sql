-- Dana Tertahan: arah hutang (credit/debit) + jejak siapa yang mencatatnya.
--
-- Sebelum ini satu angka "dana tertahan" hanya berarti piutang. Begitu hutang
-- perusahaan ikut dicatat di tabel yang sama, angka tanpa arah akan mencampur
-- uang yang akan MASUK dengan uang yang harus KELUAR — dua posisi berlawanan
-- yang tidak boleh saling menutupi. Karena itu kolomnya wajib, bukan opsional.

CREATE TYPE "HeldFundKind" AS ENUM ('CREDIT', 'DEBIT');

-- Default CREDIT sengaja: seluruh baris yang sudah ada dicatat sebagai hutang
-- orang KE perusahaan, jadi backfill-nya benar tanpa tebakan.
ALTER TABLE "HeldFund"
  ADD COLUMN "kind" "HeldFundKind" NOT NULL DEFAULT 'CREDIT';

-- `createdBy` / `settledBy` sudah menyimpan userId sebagai teks bebas. Sebelum
-- dijadikan foreign key, id yang tidak lagi punya akun harus dikosongkan —
-- kalau tidak, penambahan constraint-nya gagal di tengah jalan pada data lama.
UPDATE "HeldFund"
   SET "createdBy" = NULL
 WHERE "createdBy" IS NOT NULL
   AND "createdBy" NOT IN (SELECT "id" FROM "user");

UPDATE "HeldFund"
   SET "settledBy" = NULL
 WHERE "settledBy" IS NOT NULL
   AND "settledBy" NOT IN (SELECT "id" FROM "user");

-- ON DELETE SET NULL, bukan CASCADE: menghapus akun pencatat harus menghapus
-- jejak siapanya, tidak boleh ikut menghapus hutangnya.
ALTER TABLE "HeldFund"
  ADD CONSTRAINT "HeldFund_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HeldFund"
  ADD CONSTRAINT "HeldFund_settledBy_fkey"
  FOREIGN KEY ("settledBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sengaja tanpa index pada kedua kolom itu: tidak ada query yang mencari hutang
-- BERDASARKAN pencatatnya — namanya selalu ikut terbawa lewat join dari baris
-- yang sudah tersaring per PT. Index yang tidak pernah dipakai hanya memperlambat
-- tulis.
