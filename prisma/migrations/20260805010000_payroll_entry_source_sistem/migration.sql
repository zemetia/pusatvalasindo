-- Sumber entri slip untuk perhitungan yang dilakukan payroll.service sendiri,
-- di luar rule engine — saat ini hanya potongan ketidakhadiran.
--
-- Sebelumnya potongan itu hanya muncul sebagai angka di kolom total, tanpa
-- baris yang menjelaskannya. Dibedakan dari MANUAL (tidak ada manusia yang
-- memutuskannya) dan dari RULE (tidak punya ruleId yang bisa ditelusuri).
ALTER TYPE "PayrollEntrySource" ADD VALUE IF NOT EXISTS 'SISTEM';
