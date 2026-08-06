-- Tanggal merah (hari libur nasional & cuti bersama).
--
-- Alpha kini diturunkan dari KETIADAAN baris presensi: hari kerja yang sudah
-- lewat tanpa satu pun baris berarti tidak masuk tanpa keterangan. Tanpa daftar
-- tanggal merah, setiap hari libur nasional akan ikut terbaca alpha dan
-- dipotong dari gaji — jadi tabel ini adalah bagian dari perhitungan uang,
-- bukan sekadar hiasan kalender. Hari Minggu tidak dicatat di sini; ia sudah
-- bukan hari kerja menurut src/lib/workday.ts.

CREATE TABLE "PublicHoliday" (
  "id"           TEXT NOT NULL,
  "date"         DATE NOT NULL,
  "name"         TEXT NOT NULL,
  "isJointLeave" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- Satu tanggal hanya boleh punya satu baris: dua baris untuk tanggal yang sama
-- tidak menambah informasi, tapi membuat "berapa hari kerja bulan ini" punya
-- dua jawaban.
CREATE UNIQUE INDEX "PublicHoliday_date_key" ON "PublicHoliday"("date");
CREATE INDEX "PublicHoliday_date_idx" ON "PublicHoliday"("date");
