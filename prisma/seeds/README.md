# Struktur seeder

`prisma/seed.ts` hanya orkestrator: ia memanggil tiap modul di direktori ini
dalam urutan dependensinya (mata uang → PT → jabatan → cabang → sisanya) dan
meneruskan id yang sudah terbentuk.

**Berkas yang menyentuh database selalu bernama `*.seeder.ts`.** Berkas lain di
direktori yang sama hanyalah data atau tipe — tidak boleh menyentuh Prisma.
Tidak ada seeder yang membaca JSON: seluruh data benih adalah modul TypeScript,
supaya salah ketik ketahuan saat kompilasi, bukan saat seed berjalan.

Satu domain = satu modul. Domain yang datanya kecil cukup satu berkas
(`companies.seeder.ts`, `branches.seeder.ts`, …). Domain yang datanya besar
dipecah jadi direktori:

| Modul | Isi |
|---|---|
| `kpi/` | `types.ts`, `definitions/` per tema (omzet, layanan, kepatuhan, kas-operasional, pengiriman, stok-kurs, kepemimpinan, absensi), `kpi.seeder.ts` |
| `role-kpi/` | `types.ts`, `shared.ts` (parameter lintas PT), `pvi.ts` / `ptu.ts` / `pkd.ts`, `role-kpi.seeder.ts` |
| `payroll-rules/` | `types.ts`, `umum.ts` / `pvi.ts` / `ptu.ts` / `pkd.ts`, `payroll-rules.seeder.ts` |
| `users/` | `types.ts`, `system.ts` (akun & role global), `pvi.ts` / `ptu.ts` / `pkd.ts`, `users.seeder.ts` |

Pola yang dipegang:

- **Data terpisah dari penulisan.** File data hanya berisi array konstanta tanpa
  akses Prisma; `*.seeder.ts` yang menggabung, memeriksa, lalu menulis.
- **Seeder memeriksa dulu, baru menulis.** Penulisan lewat `upsert` membuat
  data ganda antar file lolos tanpa error, jadi tiap seeder yang menyatukan
  beberapa file punya audit ganda (`auditDuplicateCodes`, `auditDuplicates`,
  `auditDuplicateKeys`) dan audit bobot (`auditWeights`) yang menyuarakan
  masalah setiap kali seed jalan.
- **Ringkasan dihitung dari data**, tidak ditulis tangan — jumlah yang diketik
  manual langsung basi begitu satu baris data ditambah.
- **Menambah data:** isi file per PT / per tema yang sesuai, lalu daftarkan di
  `*.seeder.ts` (atau `definitions/index.ts` untuk KPI). Modul baru: buat file/
  direktorinya, lalu panggil dari `prisma/seed.ts` pada posisi urutan yang benar.

## Rule reward/denda slip gaji

`payroll-rules/` mengikuti pola yang sama, dengan dua hal khusus:

- **Rule tinggal di database**, bukan di berkas. Data di `payroll-rules/*.ts`
  hanya isi awal; sesudah terisi, HR menyuntingnya lewat halaman *Rule Reward &
  Denda*. Seeder sengaja hanya membuat rule yang `ruleKey`-nya belum ada —
  menjalankan ulang seed tidak boleh menimpa suntingan HR.
- **Ditandatangani dan divalidasi memakai modul engine yang asli**
  (`src/backend/payroll-rules/signature.ts` dan `validate.ts`), bukan salinan.
  Rule yang cacat menggagalkan seed, bukan baru ketahuan saat payroll berjalan.
  Tanpa `PAYROLL_RULE_SIGNING_KEY` seluruh impor rule dilewati.

Acuan lengkap bentuk rule: [`docs/tasks/spesifikasi-rule-slip-gaji.md`](../../docs/tasks/spesifikasi-rule-slip-gaji.md).
Terjemahan aturan per PT beserta jejak sel Excel-nya: [`docs/rules/`](../../docs/rules/).
