-- ═══════════════════════════════════════════════════════════════════════════
-- Kosongkan seluruh data payroll.
--
-- Angka payroll yang ada di database sekarang lahir dari perhitungan versi
-- lama (matriks insentif + potongan yang dihitung di payroll.service). Rule
-- engine memberi hasil yang berbeda untuk bulan yang sama, jadi menyimpan
-- keduanya berdampingan berarti dua jawaban untuk satu periode tanpa cara
-- membedakan mana yang dipakai — dan slip lama tidak bisa dijelaskan ulang
-- karena `inputs`-nya memang tidak pernah dicatat.
--
-- Ini keputusan sadar: data payroll lama DIBUANG, bukan dikonversi. Sistem
-- masih dalam pengembangan dan periode gaji akan digenerate ulang dari nol
-- lewat rule engine.
--
-- YANG TIDAK IKUT DIHAPUS: `SalaryComponent` dan `UserSalaryComponent` —
-- keduanya konfigurasi karyawan (nominal tunjangan/potongan tetap), bukan
-- hasil perhitungan, dan tetap benar di rule engine.
-- ═══════════════════════════════════════════════════════════════════════════

-- Slip & entri ikut terhapus lewat CASCADE dari PayrollRun, tapi ditulis
-- eksplisit supaya jelas apa saja yang hilang.
TRUNCATE TABLE
  "PayrollSlipEntry",
  "PayrollSlip",
  "PayrollRun"
RESTART IDENTITY CASCADE;

-- Rule ikut dikosongkan, bukan dipertahankan. Kolom sanksi non-uang yang
-- ditambahkan migrasi 20260805020000 membuat tanda tangan seluruh rule lama
-- tidak lagi cocok, sehingga engine menolaknya. Menandatangani ulang baris
-- lama sama saja dengan menulis ulang isinya — lebih jujur diseed ulang dari
-- prisma/seeds/payroll-rules/, yang memang sumber kebenarannya.
--
-- Aman dilakukan karena tidak ada lagi slip yang merujuk `ruleKey@version`:
-- semuanya baru saja dihapus di atas.
TRUNCATE TABLE
  "PayrollRuleTier",
  "PayrollRule"
RESTART IDENTITY CASCADE;
