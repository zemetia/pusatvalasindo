-- Jam KLOP cross-check kas & bank harian.
--
-- Sebelum ini satu-satunya jam yang tersimpan adalah `confirmedAt`, dan dia
-- ditimpa setiap kali angka kepala cabang disimpan ulang — termasuk saat
-- angkanya masih selisih. Jadi jam itu tidak pernah bisa dibaca sebagai "jam
-- klop". `matchedAt` diisi sekali di detik kedua sisi cocok dan dikosongkan
-- lagi kalau selisihnya terbuka (saldo harian berubah setelah dikonfirmasi).

ALTER TABLE "KasHeadConfirmation" ADD COLUMN "matchedAt" TIMESTAMP(3);
ALTER TABLE "BankHeadConfirmation" ADD COLUMN "matchedAt" TIMESTAMP(3);

-- Backfill sengaja TIDAK dilakukan dari `confirmedAt`: baris lama tidak
-- menyimpan apakah angkanya saat itu cocok, jadi menyalin jamnya akan
-- mengarang "klop" untuk hari-hari yang mungkin selisih. Baris lama yang
-- memang cocok akan terisi sendiri saat halamannya dibuka — reconcile-nya
-- jalan tiap kali ringkasan cross-check dibaca.
