-- Revert: Rekening Harian tidak pakai approval kepala cabang (marketing input saja,
-- selisih dari approval tidak diperlukan). Edit tanggal lewat sekarang diotorisasi
-- lewat role check di aplikasi (Super Admin/Owner), bukan lewat kolom approval ini.
ALTER TABLE "DailyBankEntry" DROP COLUMN "approvedBalance";
ALTER TABLE "DailyBankEntry" DROP COLUMN "approvedAt";
ALTER TABLE "DailyBankEntry" DROP COLUMN "approvedBy";
