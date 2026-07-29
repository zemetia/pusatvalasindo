-- ═══════════════════════════════════════════════════════════════════════════
-- KOLEKTOR KPI OTOMATIS
--
-- Menyiapkan dua hal yang dibutuhkan agar KPI bersumber SYSTEM bisa diisi
-- otomatis dari modul lain (mulai dari absensi):
--   1. tempat menyimpan parameter kolektor per jabatan (jam closing berbeda
--      antar PT: PVI 05.15, PTU 05.00)
--   2. entri tanpa penulis manusia
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "RoleKpi" ADD COLUMN "systemConfig" JSONB;

-- Entri hasil kolektor tidak dicatat siapa pun. Sebelumnya kolom ini wajib,
-- sehingga satu-satunya cara adalah mengarang penulis — yang merusak arti
-- jejak audit "siapa mencatat penilaian ini".
ALTER TABLE "KpiEntry" ALTER COLUMN "createdById" DROP NOT NULL;

-- Relasi opsional: penulis yang dihapus meninggalkan entri tanpa penulis,
-- bukan menghalangi penghapusan akunnya.
ALTER TABLE "KpiEntry" DROP CONSTRAINT "KpiEntry_createdById_fkey";
ALTER TABLE "KpiEntry" ADD CONSTRAINT "KpiEntry_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
