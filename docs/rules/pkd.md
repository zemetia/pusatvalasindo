# Aturan KPI & Insentif — PT Pusat Kirim Duit (PKD)

Versi 2, berlaku sejak 2026-07-01. Dokumen ini adalah terjemahan sheet manajemen menjadi aturan yang bisa ditegakkan mesin — beserta setiap keputusan yang diambil saat menerjemahkannya.

## Di mana aturan ini hidup

| Bagian | Tempatnya |
|---|---|
| Bobot, target, tarif penalti KPI | `prisma/seeds/role-kpi/pkd.ts` |
| Definisi KPI | `prisma/seeds/kpi/definitions/` |
| Matriks bonus & potongan | `prisma/seeds/payroll-rules/pkd.ts` → tabel `PayrollRule` |
| Penulis ke database | `prisma/seeds/payroll-rules/payroll-rules.seeder.ts` |

Setelah database terisi, HR menyunting rule lewat halaman **Rule Reward & Denda**; file benih tidak lagi berpengaruh.

### Env yang wajib ada

- PAYROLL_RULE_SIGNING_KEY — tanpa ini seedPayrollRules melewati SELURUH impor rule (hanya mencetak peringatan), jadi database selesai di-seed tanpa satu rule pun
- DATABASE_VIEW_ONLY_URL — tanpa ini setiap rule berstatus ERROR saat payroll dijalankan

## Sumber

| Berkas | Sheet | Peran |
|---|---|---|
| `docs/PVI Data/PUSAT KPI SEMUA_2.xlsx` | PKD, target rekap PKD, target omzet | PRIMARY — Laporan KPI Juli 2026 — versi aturan yang berlaku. |
| `docs/PVI Data/PUSAT KPI SEMUA_1.xlsx` | PKD | PREVIOUS — Template lama. Sheet MATRIX BONUS kosong — tidak memuat aturan insentif. |
| `docs/PVI Data/PERHITUNGAN KOMISI KPI_.xlsx` | PUSAT KIRIM DUIT , MATRIX PUSAT KIRIM DUIT | PREVIOUS — Sumber seed yang sekarang ada di repo. |

## Cara skor dihitung

- Periode MONTHLY, 4 bucket mingguan.
- Plafon pencapaian: **TIDAK dipakai**. Sistem juga TIDAK memakai cap. Migrasi 20260804000000_kpi_no_achievement_bounds menghapus kolom RoleKpi.maxAchievement dan minAchievement; mesin penilaian sekarang memakai angka apa adanya, sama seperti sheet.
- Selama tidak ada cap, skor leader Juli 2026 tetap 124.5% dan bonusnya Rp 1.500.000. Dengan cap 120% skornya akan menjadi 97.8% dan bonusnya Rp 500.000 — selisih Rp 1.000.000.
- Pencocokan tier memakai persen bulat, `ROUND(total_score * 100)`.

## KPI per jabatan

### Marketing — Nadine, Vinny

Sumber sel: `PUSAT KPI SEMUA_2.xlsx :: PKD!A3:N9`  

| KPI | Bobot sheet | Bobot dipakai | Penilaian | Aturan |
|---|---|---|---|---|
| Jumlah Omzet | 0.4 | **0.3** | target 100.000.000.000 | — |
| Tingkat complain tracking | 0.15 | **0.15** | −5% per kejadian | 5 point minus setiap ada komplain |
| Tingkat Kesesuaian SOP | 0.25 | **0.25** | −2% per kejadian | 2 point setiap kesalahan |
| Laporan compliance & Hasil Rekonsiliasi Tepat Waktu | 0.2 | **0.2** | −5% per kejadian | Setiap kali ada telat maka akan kena potongan 5% |
| Tingkat kepuasan nasabah (survey) | 0.1 | **0.1** | +5 poin, target 100 | 5 point setiap survey (target 20 survey per bulan) |

Total bobot sheet 1.1, yang di-seed 1. Opsi A dijalankan di prisma/seeds/role-kpi/pkd.ts: bobot jumlah-omzet 0.4 → 0.3 sehingga total pas 1.0. Dipilih karena kelebihan 0.1 persis sebesar kenaikan bobot omzet dari versi sebelumnya, dan karena perlakuan yang sama sudah dipakai lebih dulu untuk Kepala Cabang PVI & PTU (catatan bobotnya ada di prisma/seeds/role-kpi/shared.ts). Tetap perlu diketok manajemen — kalau potongannya diambil dari KPI lain, ubah blok PKD/Marketing di seeder itu.

Catatan data:

- Jumlah Omzet: Sheet 'target rekap PKD'!C3 menulis 'JULI (TARGET 100.000.000)' — salah 1000x dari target sebenarnya. Label saja, tidak dipakai rumus.
- Laporan compliance & Hasil Rekonsiliasi Tepat Waktu: Batas jam 17.30 yang ada di versi lama hilang dari teks aturan v2. Perlu ditegaskan ulang agar bisa dinilai otomatis.
- Tingkat kepuasan nasabah (survey): Juli 2026 dihitung 1.25 (= 25/20) padahal rekap mencatat week 2 = 9 dan week 3 = 25, total 34 survey. Week 2 tidak ikut dijumlah. Nilai benar 170%, setelah cap = 120%.

### Kepala Cabang — Ambar

Sumber sel: `PUSAT KPI SEMUA_2.xlsx :: PKD!A15:N21`  
> ⚠ Sel PKD!A16 tertulis 'Team leader PTU' — salah salin dari sheet PTU. Blok ini milik PKD.

| KPI | Bobot sheet | Bobot dipakai | Penilaian | Aturan |
|---|---|---|---|---|
| Jumlah omzet team | 0.4 | **0.4** | target 100.000.000.000 | — |
| Kepatuhan Regulasi SOP (pengawasan operasional) | 0.15 | **0.15** | −5% per kejadian | Setiap temuan dianggap -5% |
| Complain Nasabah | 0.2 | **0.2** | −5% per kejadian | Setiap temuan dianggap -5% |
| Akurasi Pelaporan dan monitoring | 0.15 | **0.15** | −5% per kejadian | Setiap temuan dianggap -5% |
| Team Management (briefing) | 0.1 | **0.1** | +10 poin, target 100 | Target 10 briefing per bulan, setiap briefing +10% |

Total bobot sheet 1, yang di-seed 1. 

Catatan data:

- Jumlah omzet team: Di sheet, PKD!F16:I16 hanya menyalin PKD!F4:I4 — omzet leader identik dengan omzet sales. Di sistem harus dinyatakan eksplisit sebagai rollup tim (bukan angka terpisah) supaya tidak terbaca sebagai double counting.
- Team Management (briefing): PKD!J20 diisi angka 1 secara manual (bukan rumus). Kebetulan cocok dengan 10 briefing di rekap, tapi tidak ada jejak audit.

Dihapus dari versi sebelumnya:

- `net-profit-margin` (bobot 0.35) — Satu-satunya metrik profitabilitas leader, dihapus dan diganti volume omzet. Perlu konfirmasi apakah memang disengaja.
- `akurasi-pembukuan-pajak` (bobot 0.02) — Hilang di v2. Tidak ada padanan di KpiDefinition.
- `kedisiplinan-team` (bobot 0.1) — Diserap sebagian oleh team-management.

## Matriks bonus & potongan

Sumber sel: `PUSAT KPI SEMUA_2.xlsx :: PKD!A27:C40`. Dasar: KPI_MONTHLY_SCORE.

> Sheet menulis rentang tumpang tindih ('86%-100%' dan '100%-120%' sama-sama mengklaim 100%). Di sini dinormalkan menjadi setengah terbuka supaya tidak ambigu.

### Marketing

| Skor | Hasil | Nominal |
|---|---|---|
| ≥ 100% | PENDING_DECISION | **belum ditetapkan** |
| 86–100% | BONUS_CASH | Rp 250.000 |
| 76–86% | SAFE_ZONE | — |
| 10–76% | DEDUCTION | Rp 0 + wajib Sabtu |
| 0–10% | DEDUCTION | Rp 0 + wajib Sabtu |

> ⚠ Sheet menulis '250000 PER ORANG' tetapi omzet tidak dipecah per admin — kolom NAMA ADMIN (VINNY / NADINE) di 'target rekap PKD'!B5:B6 kosong. Selama attribution per orang belum ada, dua pemegang jabatan selalu dapat nilai identik.

> TIDAK ADA ATURAN di sheet untuk sales di atas 100%. Juli 2026 skor 144.3% jatuh di sini. Engine harus menolak menghitung, bukan diam-diam memakai tier 250rb. Di benih rule bonus_kpi_pkd_marketing tier tertinggi berhenti di 100, sehingga skor 101%+ jatuh ke `default` dengan flag `butuh_review`. Entri tetap muncul di slip bernilai Rp 0 dan slip ditandai perlu diperiksa HR.

### Kepala Cabang

| Skor | Hasil | Nominal |
|---|---|---|
| ≥ 121% | BONUS_CASH | Rp 1.500.000 |
| 100–121% | BONUS_CASH | Rp 1.000.000 |
| 86–100% | BONUS_CASH | Rp 500.000 |
| 75–86% | SAFE_ZONE | — |
| 10–75% | DEDUCTION | Rp 300.000 + SP |
| 0–10% | DEDUCTION | Rp 300.000 + SP |

> ⚠ Sheet hanya menyebut 'kepala cabang'. Jabatan yang dinilai di blok KPI adalah team leader PKD. Pemetaan ini perlu ditegaskan manajemen.

Perubahan dari versi sebelumnya: Ambang 500rb naik 80% → 86%; potongan turun 500rb → 300rb tetapi ditambah SP.

### Syarat kelayakan

- Yang masih belum di kontrak belum bisa mendapatkan bonus tambahan. (`PKD!C40`)
- Skor tetap dihitung dan disimpan; payout = 0 dengan alasan CONTRACT_NOT_ACTIVE tercatat di slip.
- **Sudah ditegakkan** sejak migrasi `20260805020000`: kolom `user.employmentStatus` + `contractStartDate/contractEndDate`, dibuka ke rule lewat `hv_employees.berkontrak`, dan dipasang sebagai guard `belum_berkontrak` di seluruh rule bonus. Karyawan yang belum berkontrak menghasilkan entri SKIPPED berbendera — slip menyatakan alasannya, bukan diam. Potongan tetap berlaku bagi siapa pun.
- **Catatan lama**: Apakah gate ini juga meniadakan POTONGAN, atau hanya bonus? Sheet hanya menyebut 'bonus tambahan'. Default sementara: potongan tetap berlaku.

### Sanksi non-uang

- **Wajib masuk setiap Sabtu** — kini tersimpan sebagai kolom `PayrollRuleTier.mandatorySaturday`, bukan hanya teks pada label. Sheet tidak menyebut berapa lama berlaku, apakah dibayar, dan apakah dihitung sebagai hari kerja untuk absensi/lembur. Harus ditentukan sebelum masuk modul payroll.
- **Surat Peringatan (SP)** — kini tersimpan sebagai kolom `PayrollRuleTier.warningLetter`. Tingkat SP (SP1/SP2/SP3) dan masa berlakunya tidak diatur.

## Keputusan yang masih menggantung

| Kode | Topik | Status | Pertanyaan |
|---|---|---|---|
| PKD-D1 | Total bobot Marketing 110% | `PROVISIONAL_A_APPLIED` | Bobot mana yang diturunkan agar total kembali 100%? |
| PKD-D2 | Tier bonus Marketing di atas 100% tidak ada | `PENDING_APPROVAL` | Berapa bonus sales bila skor melebihi 100%? |
| PKD-D3 | Cap pencapaian per KPI 120% | `TIDAK_DIPAKAI` | Setujui cap 120% per KPI atau ikuti sheet yang tanpa cap? |
| PKD-D4 | Cakupan gate kontrak | `PENDING_APPROVAL` | Karyawan belum berkontrak: hanya bonus yang hangus, atau potongan juga tidak diberlakukan? |
| PKD-D5 | Pemetaan jabatan pada matriks | `PENDING_APPROVAL` | Apakah baris 'kepala cabang' pada matriks memang berlaku untuk Team Leader PKD? |
| PKD-D6 | Sanksi 'wajib masuk setiap Sabtu' | `PENDING_APPROVAL` | Berapa lama berlaku, dibayar atau tidak, dan bagaimana pencatatannya di modul absensi? |

**PKD-D1 — Total bobot Marketing 110%**

- **Opsi A** — jumlah-omzet 0.40 → 0.30. Total pas 1.00 tanpa menyentuh KPI lain (mengembalikan bobot v1).
- **Opsi B** — kesesuaian-sop 0.25 → 0.20 dan kepuasan-nasabah 0.10 → 0.05. Omzet tetap 0.40 sesuai niat menaikkan fokus penjualan.
- **Opsi C** — Normalisasi proporsional (setiap bobot dibagi 1.1). Menjaga bobot relatif persis seperti sheet, tapi angkanya jadi tidak bulat.

Dampak Juli 2026: Skor Marketing 144.28% (basis 110%) vs 131.16% (dinormalisasi).

Sudah diterapkan sementara di: `prisma/seeds/role-kpi/pkd.ts — blok PKD / Marketing, jumlah-omzet 0.3`

**PKD-D2 — Tier bonus Marketing di atas 100% tidak ada**

Mei 86%, Juni 108%, Juli 144.3% — dua dari tiga bulan jatuh di luar matriks. Kepala cabang punya tier sampai >120% (Rp 1.500.000), sales berhenti di 100% (Rp 250.000), padahal omzet yang dinilai sama.

- **Opsi A** — Tambah tier 101-120% dan >120% untuk sales. Simetris dengan kepala cabang.
- **Opsi B** — Nyatakan tier 86-100% sebagai '>=86%' (tanpa batas atas). Perubahan minimal; bonus tetap flat Rp 250.000 berapa pun overshoot-nya.
- **Opsi C** — Tambah komponen komisi progresif di atas target. Insentif marjinal tidak nol setelah 100%. Perlu aturan baru di luar matriks tier.

**PKD-D3** — Sistem memilih TANPA CAP: migrasi 20260804000000_kpi_no_achievement_bounds menghapus RoleKpi.maxAchievement/minAchievement, sehingga perilakunya kini sama persis dengan sheet. Kalau manajemen menghendaki cap, itu harus dikembalikan sebagai kolom/kebijakan baru — bukan sekadar setelan di rule payroll.

## Validasi yang wajib dijalankan engine

| Kode | Aturan | Tingkat |
|---|---|---|
| V1 | Total bobot KPI aktif per jabatan harus = 1.0 | ERROR |
| V2 | Tier insentif harus menutup rentang 0..∞ tanpa celah dan tanpa tumpang tindih | ERROR |
| V3 | Tier tertinggi setiap jabatan wajib open-ended (maxScore = null) | ERROR |
| V4 | Setiap KPI wajib punya achievementCap; tanpa cap eksplisit dipakai defaultAchievementCap 1.2 | WARNING |
| V5 | Semua pendingDecisions harus berstatus APPROVED sebelum gaji periode itu ditandai sudah dibayar | ERROR |
| V6 | KpiEntry wajib punya tanggal kejadian; realisasi tidak boleh ditumpuk seluruhnya di minggu ke-4 | WARNING |

## Masalah alur data pada sheet

**F1 (HIGH)** — Arah data terbalik. Sheet 'target rekap PKD' seharusnya jadi sumber bukti, tetapi satu-satunya rumus di sana ('target rekap PKD'!D8 = PKD!I4) justru menarik dari sheet KPI. Jumlah temuan diketik di rekap lalu dikonversi MANUAL jadi persentase di sheet KPI — tanpa rumus, tanpa jejak audit.

Penyelesaian di sistem: KpiEntry (kejadian harian) menjadi satu-satunya input; skor dan persentase dihitung engine.

**F2 (HIGH)** — Omzet leader menyalin sel omzet sales (PKD!F16:I16 = PKD!F4:I4), terbaca sebagai double counting.

Penyelesaian di sistem: Deklarasikan sebagai TEAM_ROLLUP dari omzet cabang, bukan angka terpisah.

**F3 (MEDIUM)** — Rekap bulanan skor (PKD!B43:G44) tidak diisi untuk Juli, dan angka Juni sales (108) sama persis dengan persentase omzet Juni — indikasi rekap itu mencatat pencapaian omzet, bukan skor komposit. Beda basis dengan angka Juli.

Penyelesaian di sistem: skor dan seluruh alasannya dibekukan sebagai PayrollSlip + PayrollSlipEntry saat gaji ditandai sudah dibayar.

**F4 (MEDIUM)** — Bonus 'per orang' tanpa data per orang (kolom VINNY/NADINE kosong).

Penyelesaian di sistem: Wajibkan employeeId pada setiap KpiEntry omzet, atau ubah aturan menjadi bonus tim.

## Angka nyata untuk uji regresi

Angka nyata untuk dipakai sebagai test fixture. 'sheet' = hasil di Excel apa adanya, 'expected' = hasil yang seharusnya menurut aturan di file ini (cap 120% aktif, bobot Marketing belum diputuskan sehingga skornya masih memakai basis sheet).

| Periode | Omzet | Skor sheet | Skor seharusnya | Bonus |
|---|---|---|---|---|
| 2026-07 | 186.948.043.619 | M 1.442792174 / L 1.245292174 | M 1.3008 / L 1.2453 | L 1500000 |
| 2026-06 | 108.281.970.021 | M 1.08 / L 0.93 | M — / L — | L 500000 |
| 2026-05 | 72.005.276.700 | M 0.86 / L 0.75 | M — / L — | L 0 |
| 2026-04 | 195.430.945.366 | M — / L — | M — / L — | — |

Rincian Juli 2026:

- Marketing: Tanpa cap, dengan bobot hasil PKD-D1 (omzet 0.3): 0.3*1.8695 + 0.15*1.0 + 0.25*0.88 + 0.2*1.0 + 0.1*1.7 = 1.3008 → skor_persen 130. Survey memakai 34 survey (week 2 + week 3), bukan 25 seperti di sheet.
- Leader: 0.4*1.8695 + 0.15*0.70 + 0.20*0.90 + 0.15*0.75 + 0.10*1.00 = 1.2453 — sama dengan sheet, karena sistem juga tidak memakai cap → 1.500.000
- Kesalahan data yang diketahui: Survey nasabah dihitung 25/20 = 1.25, mengabaikan 9 survey di week 2. / Seluruh realisasi diinput di kolom week 4; week 1-3 nol.

Omzet bulanan (`target rekap PKD!E59:H59`):

- 2026-04: 195.430.945.366
- 2026-05: 72.005.276.700
- 2026-06: 108.281.970.021
- 2026-07: 186.948.043.619

> ⚠ Angka mingguan di sheet 'target omzet' tidak konsisten dengan total 186.9M di sheet PKD, dan week4 di sini justru sama dengan total omzet Juni. Perlu diklarifikasi sebelum dipakai sebagai sumber data mingguan.
