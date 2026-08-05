# Ekstraksi Sistem KPI & Bonus — PVI / PTU / PKD

Sumber: `docs/PVI Data/PUSAT KPI SEMUA_1.xlsx` (template lama, kosong) dan
`docs/PVI Data/PUSAT KPI SEMUA_2.xlsx` (versi kerja, terisi).
Versi `_2` adalah acuan. Perbedaan terhadap `_1` dicatat sebagai *(lama: …)*.

---

## 1. Model perhitungan

Terverifikasi dari sheet `PKD` + `target rekap PKD` (satu-satunya blok yang rekap dan
sheet KPI-nya konsisten penuh).

```
week[n]  = jumlah_kejadian × penalti_persen          -- diisi manual per minggu
Actual   = Target − Σ(week[1..4])                    -- metrik PENALTI
         = Σ(week[1..4])                             -- metrik AKUMULATIF
         = week[4]                                   -- metrik SNAPSHOT (dipakai tak konsisten)
%Ach     = Actual / Target
Score    = %Ach × Weight
Total    = Σ Score  (per role)
Bonus    = lookup(Total, matrix_bonus[entitas][role])
```

Bukti kalibrasi (PKD, Juli 2026):

| Metrik | Rekap | Rule | Sel week 4 | Status |
|---|---|---|---|---|
| Kesesuaian SOP (sales) | 6 kesalahan | 2% / kesalahan | `I6 = 0.12` | ✅ |
| Kepatuhan regulasi SOP (leader) | 6 temuan | 5% / temuan | `I17 = 0.30` | ✅ |
| Complain nasabah (leader) | 2 | 5% / temuan | `I18 = 0.10` | ✅ |
| Akurasi pelaporan (leader) | 5 | 5% / temuan | `I19 = 0.25` | ✅ |
| Kepuasan nasabah survey | 25 survey | +5% / survey | `I8 = 1.25` | ✅ |

**Tiga mode agregasi kolom `Actual` (J)** dipakai bercampur tanpa penanda:

| Mode | Rumus | Contoh |
|---|---|---|
| `ACCUMULATE` | `=F+G+H+I` | omzet, survey, google review, rute kurir |
| `DEDUCT_FROM_TARGET` | `=E-F-G-H-I` | semua metrik berbasis penalti |
| `LAST_WEEK` | `=I` | closing teller dalam, sebagian omzet team leader |
| `HARDCODE` | *(tanpa formula)* | sisanya |

Ini wajib jadi field eksplisit (`accrualMode`) saat diimplementasikan.

---

## 2. PVI — PT Pusat Valas Indo

Periode di file: `Q59 = DESEMBER`; rekap bertanggal `may` / `APRIL` (tidak konsisten).

### 2.1 SALES / MARKETING
Objective: *Meningkatkan pelayanan kepada nasabah dan menaikan omzet*

| # | Key Result | Target | Bobot | Rule penalti/insentif | Actual | %Ach | Score |
|---|---|---|---|---|---|---|---|
| 1 | Jumlah Omzet | 500.000.000.000 | 0.40 | — | 200.000.000 | **0.84** ⚠️ | 0.336 |
| 2 | Tingkat complain tracking | 1 | 0.10 | −5% per komplain per hari | 0.90 | 0.90 | 0.090 |
| 3 | Tingkat Kesesuaian SOP | 1 | 0.15 | −2% per kesalahan | 1.00 | 1.00 | 0.150 |
| 4 | Laporan & Hasil Rekonsiliasi Tepat Waktu | 1 | 0.15 | −5 point jika lewat 17.30 | 1.00 | 1.00 | 0.150 |
| 5 | Laporan Compliance Tepat Waktu (LTKT/LTKM) | 1 | 0.10 | −5% per kesalahan | 1.00 | 1.00 | 0.100 |
| 6 | Tingkat kepuasan nasabah | 100 | 0.10 | +1 point per survey (target 100/bln) | 64 | 0.64 | 0.064 |
| | **Total** | | **1.00** | | | | **0.89** |

> *(lama: omzet target 700.000.000 bobot 0.30; complain 0.15; SOP 0.20; kepuasan target 1; penalti dalam satuan "point" bukan "%")*

⚠️ `K4 = 0.84` **di-hardcode**. Rasio riil `200.000.000 / 500.000.000.000 = 0.04%`.
Target omzet individual disamakan dengan target perusahaan (500 M) sehingga rasionya mustahil.

### 2.2 TELLER LUAR
Objective: *Meningkatkan Pelayanan Kepada Customer Dan Memastikan Ketelitian Dalam Perhitungan*

| # | Key Result | Target | Bobot | Rule | Actual | %Ach | Score |
|---|---|---|---|---|---|---|---|
| 1 | Jumlah Omzet | 10.000.000.000 | 0.40 | — | 8.000.000.000 | 0.80 | 0.320 |
| 2 | Tingkat Ketelitian Perhitungan | 1 | 0.10 | −5 point per kesalahan | 0.55 | 0.55 | 0.055 |
| 3 | Tingkat Kesesuaian SOP | 1 | 0.15 | −3 point per kesalahan | 1.00 | 1.00 | 0.150 |
| 4 | Tingkat Kepuasan Pelanggan | 1 | 0.30 | 20 google review; +5 positif / −5 negatif | 0.20 | 0.20 | 0.060 |
| 5 | Tingkat Kebersihan | 1 | 0.05 | −5 point per tempat tidak bagus | 0.70 | 0.70 | 0.035 |
| | **Total** | | **1.00** | | | | **0.62** |

> *(lama: omzet 0.35; kebersihan 0.10; kepuasan = "1 google review +2 point, target 50 point"; ketelitian & SOP −3 point)*

### 2.3 TELLER DALAM
Objective: *Memastikan Closing Laporan Tepat Waktu*

| # | Key Result | Target | Bobot | Rule | Actual | %Ach | Score |
|---|---|---|---|---|---|---|---|
| 1 | Closing Tepat Waktu | 1 | 0.45 | 1 hari = 4 point; batas maksimal **05.45** | 0.68 | 0.68 | 0.306 |
| 2 | Tingkat Kesesuaian SOP | 1 | 0.20 | checklist semua in & out; 1 hari = 4 point | 1.00 | 1.00 | 0.200 |
| 3 | Tingkat Kesesuaian Jumlah Kas | 1 | 0.35 | selisih maks 100 rb/hari; di atas itu −4 point | 0.84 | 0.84 | 0.294 |
| | **Total** | | **1.00** | | | | **0.80** |

> *(lama: batas closing "1 jam setelah 05.15"; SOP tanpa klausa 4 point)*

### 2.4 KURIR
Objective: *Memastikan Pengiriman On Time & Customer Happy*

| # | Key Result | Target | Bobot | Rule | Actual | %Ach | Score |
|---|---|---|---|---|---|---|---|
| 1 | Tingkat Ketepatan Waktu & Jumlah Pengiriman | **500** | 0.70 | — | 469 | 0.938 | 0.6566 |
| 2 | Laporan serah terima barang tepat waktu | 1 | 0.20 | −5 point per kesalahan | 0.25 | 0.25 | 0.050 |
| 3 | Tingkat Kesesuaian SOP | 1 | 0.10 | −5 point per kesalahan | 0.10 | 0.10 | 0.010 |
| | **Total** | | **1.00** | | | | **0.7166** |

> *(lama: target 900 rute; penalti −4 point)*

Data rute per kurir (`target omzet` R17–R29): amir 98, agus 114, hasan 146, husni 142,
rico 127, dede 32 → **total 659** vs target 900.
⚠️ Total rute 659 ≠ angka 469 yang dipakai di sheet KPI.

### 2.5 TEAM LEADER MARKETING
Objective: *Memastikan resiko likuiditas minimal dan stok mata uang terjaga*

| # | Key Result | Target | Bobot | Rule | Actual | %Ach | Score |
|---|---|---|---|---|---|---|---|
| 1 | Omzet | 500.000.000.000 | 0.40 | — | 355.000.000.000 | 0.71 | 0.284 |
| 2 | Tingkat Ketersediaan Stok Mata Uang | 1 | 0.10 | −5% tiap cust datang stok tidak ada | 0.78 | 0.78 | 0.078 |
| 3 | Complain nasabah (kepuasan nasabah) | 1 | 0.05 | −5% tiap complain | 1.00 | 1.00 | 0.050 |
| 4 | Kurs updating / tingkat kesesuaian SOP | 1 | 0.25 | −5% tiap telat update | 0.25 | 0.25 | 0.0625 |
| 5 | Team management (rata2 score KPI team) | 10 | 0.20 | — | 10 | 1.00 | 0.200 |
| | *(sel gantung `M44`)* | — | — | — | — | — | **0.025** ⚠️ |
| | **Total** | | **1.00** | | | | **0.6995** |

> *(lama: KR#1 = "Net Profit Margin" target 700.000.000; stok 0.20; complain 0.15;
> kurs 0.10; team mgmt 0.10 → **total bobot hanya 0.95** tapi ditulis 1.00)*

⚠️ `M44 = 0.025` tidak punya label KR maupun bobot tapi ikut terjumlah di `M46=sum(M39:M44)`.
Skor yang benar: **0.6745**.

### 2.6 TEAM LEADER PVI
Objective: *Memastikan resiko likuiditas minimal dan stok mata uang terjaga*

| # | Key Result | Target | Bobot | Rule | Actual | %Ach | Score |
|---|---|---|---|---|---|---|---|
| 1 | Jumlah omzet team | 500.000.000.000 | 0.15 | — | 355.000.000.000 | 0.71 | 0.1065 |
| 2 | Target team teller luar | 1 | 0.30 | +5% tiap temuan | 1.00 | 1.00 | 0.300 |
| 3 | Target team marketing | 1 | 0.20 | +5% tiap temuan | 1.00 | 1.00 | 0.200 |
| 4 | Pelanggaran SOP diri sendiri | 1 | 0.25 | +5% tiap temuan | 0.03 | 0.03 | 0.0075 |
| 5 | Team management (briefing) | 1 | 0.10 | 10 briefing; 10% per briefing | 0.70 | 0.70 | 0.070 |
| | **Total** | | **1.00** | | | | **0.684** |

> *(lama — KR sepenuhnya berbeda: omzet team 700 M **0.40** / Kepatuhan Regulasi SOP **0.25** /
> Resiko Likuiditas **0.20** / Efisiensi Pelaporan & monitoring kurs **0.15** / Team management **0.10**
> → **total bobot 1.10** tapi ditulis 1.00)*

---

## 3. PTU — PT Pusat Tukar Uang

Struktur kolom **berbeda** dari PVI/PKD: tidak ada week 1–4, melainkan
`achievement` (F) → `Actual` (G). Perlu penyeragaman.

### 3.1 TELLER LUAR

| # | Key Result | Target | Bobot | Rule | Actual | %Ach | Score |
|---|---|---|---|---|---|---|---|
| 1 | Jumlah Omzet | 85.000.000.000 | 0.40 | — | 81.687.840.156 | 0.961 | 0.3844 |
| 2 | Tingkat Ketelitian Perhitungan | ⚠️ `0.15` | *(kosong)* | −5 point per kesalahan | — | — | 0 |
| 3 | Tingkat Kesesuaian SOP | ⚠️ `0.1` | *(kosong)* | −5 point per kesalahan | — | — | 0 |
| 4 | Tingkat Kepuasan Pelanggan | 1 | *(kosong)* | 20 google review (1 review = 5%) | — | — | 0 |
| 5 | Tingkat Kebersihan | *(kosong)* | *(kosong)* | −5 point per tempat tidak bersih | — | — | 0 |
| | **Total** | | *ditulis 1.00* | | | | **0.3844** |

⚠️ **Rusak.** Bobot 0.15 dan 0.10 masuk ke kolom *Target*, kolom *Weight* kosong.
60% bobot hilang dari perhitungan → skor teller luar PTU tidak valid.

> *(lama: omzet 0.35 / ketelitian 0.10 / SOP 0.15 / kepuasan 0.30 / kebersihan 0.10 = 1.00, utuh)*

### 3.2 TELLER DALAM

| # | Key Result | Target | Bobot | Rule | Score |
|---|---|---|---|---|---|
| 1 | Closing Tepat Waktu | 1 | *(kosong)* | 1 hari = 4 point; batas **1 jam setelah 05.30**; *bulan ini +8% karena 2 hari libur* | 0 |
| 2 | Tingkat Kesesuaian SOP | ⚠️ `0.535` | *(kosong)* | checklist semua in & out | 0 |
| 3 | Tingkat Kesesuaian Jumlah Kas | 1 | *(kosong)* | maks 100 rb/hari, di atas itu −5 point | 0 |
| | **Total** | | *ditulis 1.00* | | **0** |

⚠️ Sama rusaknya. Catatan *"bulan ini tambah 8% karena 2 hari libur"* menunjukkan ada
**penyesuaian target berbasis hari kerja** yang belum diformalkan.

> *(lama: closing 0.45 / SOP 0.20 / kas 0.35 = 1.00; batas closing "1 jam setelah 05.00"; kas −4 point)*

### 3.3 TEAM LEADER PTU

| # | Key Result | Target | Bobot | Rule | Actual | %Ach | Score |
|---|---|---|---|---|---|---|---|
| 1 | Jumlah omzet team | 85.000.000.000 | 0.40 | — | 81.687.840.156 | 0.961 | 0.3844 |
| 2 | Kepatuhan Regulasi SOP (pengawasan operasional) | — | 0.20 | +5% tiap temuan | — | — | 0 |
| 3 | **Marketing Survey** | — | 0.20 | **+2% tiap survey** | — | — | 0 |
| 4 | Efisiensi Pelaporan dan monitoring | — | 0.10 | +5% tiap temuan | — | — | 0 |
| 5 | Team management (skor KPI team) | 1 | 0.10 | — | — | — | 0 |
| | **Total** | | **1.00** | | | | **0.3844** |

> *(lama: omzet 0.40 / Kepatuhan SOP 0.25 / **Complain Nasabah** 0.20 / Efisiensi Pelaporan 0.15 /
> Team management 0.10 = 1.10 ⚠️. Di `_2` "Complain Nasabah" diganti "Marketing Survey" dan bobot dirapikan ke 1.00)*

---

## 4. PKD — PT Pusat Kirim Duit

Periode: **Juli 2026**. Blok paling konsisten; dipakai sebagai referensi kalibrasi rumus.

### 4.1 SALES / MARKETING (nadine dan vinny)

| # | Key Result | Target | Bobot | Rule | Actual | %Ach | Score |
|---|---|---|---|---|---|---|---|
| 1 | Jumlah Omzet | 100.000.000.000 | 0.40 | — | 186.948.043.619 | **1.8695** | 0.7478 |
| 2 | Tingkat complain tracking | 1 | 0.15 | −5 point per komplain | 1.00 | 1.00 | 0.150 |
| 3 | Tingkat Kesesuaian SOP | 1 | 0.25 | −2 point per kesalahan | 0.88 | 0.88 | 0.220 |
| 4 | Laporan compliance & Hasil Rekonsiliasi Tepat Waktu | 1 | 0.20 | −5% tiap telat | 1.00 | 1.00 | 0.200 |
| 5 | Tingkat kepuasan nasabah (survey) | 1 | 0.10 | +5 point per survey (20 survey/bln) | 1.25 | 1.25 | 0.125 |
| | **Total** | | **1.10** ⚠️ | | | | **1.4428** |

⚠️ Total bobot **1.10**, bukan 1.00 → skor otomatis inflasi 10%.
⚠️ `%Ach` omzet **187% tidak di-cap**, langsung dikali bobot. Kombinasi keduanya menghasilkan
skor 144% — di luar semua band matrix bonus PKD (tertinggi 86–100%).

### 4.2 TEAM LEADER PKD *(label di sheet tertulis "Team leader PTU" — salah)*

| # | Key Result | Target | Bobot | Rule | Actual | %Ach | Score |
|---|---|---|---|---|---|---|---|
| 1 | Jumlah omzet team | 100.000.000.000 | 0.40 | — | 186.948.043.619 | 1.8695 | 0.7478 |
| 2 | Kepatuhan Regulasi SOP (pengawasan operasional) | 1 | 0.15 | −5% tiap temuan | 0.70 | 0.70 | 0.105 |
| 3 | Complain nasabah | 1 | 0.20 | −5% tiap temuan | 0.90 | 0.90 | 0.180 |
| 4 | Akurasi pelaporan dan monitoring | 1 | 0.15 | −5% tiap temuan | 0.75 | 0.75 | 0.1125 |
| 5 | Team management (briefing 10× sebulan) | 1 | 0.10 | **+10% tiap meeting** | 1.00 | 1.00 | 0.100 |
| | **Total** | | **1.00** | | | | **1.2453** |

`F16 = {=F4}` — satu-satunya link antar-blok yang benar di seluruh workbook
(omzet team leader mengambil omzet sales).

### 4.3 KEPALA CABANG PKD (Ambar) — **hanya ada di `_1`, dihapus di `_2`**

| # | Key Result | Target | Bobot | Rule | Catatan operasional |
|---|---|---|---|---|---|
| 1 | Net Profit Margin | 85.000.000.000 | 0.35 | −5 point/hari (target 2,8 M/hari) | update rumus kurs; +40 member grup PKD & +15 grup Corporate per minggu; riset harga saingan (Transfez, Wise) |
| 2 | Kepatuhan Regulasi SOP (pengawasan operasional) | 100 | 0.25 | −5 point/hari | jawaban pengedealan dalam 10 menit; data agent/harga/stok selalu ter-update |
| 3 | Complain nasabah | — | 0.20 | −5 point/hari | SOP refund step-by-step; pantau problem setiap hari |
| 4 | Efisiensi pelaporan | — | 0.08 | −5 point/hari | — |
| 5 | Tingkat kedisiplinan team | — | 0.10 | −5 point/hari | harus achieve target |
| 6 | Akurasi pembukuan pajak | — | 0.02 | −5 point/hari | tiap tanggal 25 jurnal umum gaji + PPh 21 & 25 |
| | **Total** | | **1.00** | | |

Blok ini hilang di `_2` — perlu konfirmasi apakah sengaja dihapus atau kelewat.

---

## 5. Matrix bonus

Lookup memakai **skor KPI total** (kolom `% Score` baris total).

### PVI

| Role | Bonus | Safe zone | Sanksi |
|---|---|---|---|
| Sales & compliance | 86–100% → 250.000/org · top #1 → `500` ⚠️ | 70–85% | 10–69% sabtu wajib masuk |
| Teller luar | 86–100% → 250.000/org | 60–85% | 10–60% sabtu + potong 100.000 |
| Teller dalam | 86–100% → 500.000 | 60–85% | 10–60% sabtu + potong 300.000 |
| Kurir | 86–100% → 250.000/org · top #1 → 500.000 | 61–85% | 10–70% sabtu wajib masuk |
| Kepala cabang | >120% → 1.500.000 · 101–120% → 1.000.000 · 86–100% → 500.000 | 75–85% | 10–74% potong 300.000 + SP |
| Kepala marketing | >120% → 1.250.000 · 86–100% → 500.000 | 80–85% | 10–79% potong 200.000 + teguran lisan |

### PTU

| Role | Bonus | Safe zone | Sanksi |
|---|---|---|---|
| Teller luar | 85–100% → 250.000/org | 70–85% | 10–69% sabtu + potong 150.000 |
| Teller dalam | 85–100% → 250.000 | 60–85% | 10–60% sabtu + potong 150.000 |
| Kepala cabang | 101–120% → 1.500.000 · 86–100% → 500.000 | 80–85% | 10–79% potong 200.000 + teguran lisan |

> *(lama `BONUS PTU`: teller luar 80–100% → 250.000, safe 60–79%, 10–60% potong 150.000;
> teller dalam 80–100% → 250.000, safe 60–79%, 10–60% potong 300.000;
> kepala cabang >120% → 1.500.000, 101–120% → 1.000.000, 80–100% → 500.000, safe 60–79%, 10–59% potong 300.000)*

### PKD

| Role | Bonus | Safe zone | Sanksi |
|---|---|---|---|
| Sales & compliance | 86–100% → 250.000/org | 76–85% | 10–75% sabtu wajib masuk |
| Kepala cabang | >120% → 1.500.000 · 100–120% → 1.000.000 · 86–100% → 500.000 | 75–85% | 10–74% potong 300.000 + SP |

### Syarat universal
> *"Yang masih belum di kontrak belum bisa mendapatkan bonus tambahan."*

Bonus hanya berlaku untuk karyawan berstatus kontrak/tetap (PKWT/PKWTT).

---

## 6. Data pendukung (`target omzet`, `target rekap *`)

### Omzet marketing PVI — bulan 7 (Rp)

| Nama | Week 3 admin | Week 3 biru | Week 3 total | Week 4 admin | Week 4 biru | Week 4 total |
|---|---|---|---|---|---|---|
| penny | 24.835.495.455 | 49.978.990.650 | 74.814.486.105 | 25.857.905.755 | 61.821.262.900 | 87.679.168.655 |
| bruce | 8.352.477.250 | 58.413.001.847 | 66.765.479.097 | 9.108.337.070 | 61.340.890.847 | 70.449.227.917 |
| fenny | 25.933.574.220 | 49.761.839.250 | 75.695.413.470 | 27.719.149.800 | 61.116.315.050 | 88.835.464.850 |
| vero | 34.759.927.895 | 54.309.620.325 | 89.069.548.220 | 41.382.827.395 | 67.194.412.325 | 108.577.239.720 |
| **Total** | | | **306.344.926.892** | | | **355.541.101.142** |

Target: **500.000.000.000**. Kanal omzet: `admin` / `orange` / `biru`.

### Omzet teller PVI — bulan 7 (Rp)

| Nama | Week 3 total | Week 4 total |
|---|---|---|
| manda | 1.661.590.140 | 1.818.353.840 |
| lisia | 1.794.307.385 | 2.042.201.260 |
| alifia | 3.092.093.175 | 3.300.521.855 |
| liza | 1.092.023.830 | 1.324.892.630 |
| **Total** | **7.640.014.530** | **8.485.969.585** |

Target: **10.000.000.000**. ⚠️ Sheet KPI memakai 8.000.000.000 (bukan 8.485.969.585);
sheet `target rekap pvi` memakai 8.154.517.090. **Tiga angka berbeda untuk metrik yang sama.**

### Omzet marketing PTU — (Rp)

| Nama | Week 3 total | Week 4 total |
|---|---|---|
| yeni | 31.110.830.485 | 51.189.635.530 |
| ardi | 1.761.440.005 | 3.092.639.831 |
| jose | 2.046.936.615 | 2.944.110.570 |
| kiki | 649.623.560 | 1.126.450.485 |
| **Total** | **35.568.830.665** | **58.352.836.416** |

Target: **85.000.000.000**.

### Omzet PKD

`ambar and team`: week2 69.483.197.020 · week3 86.406.426.910 · week4 108.281.970.021.
Target: **100.000.000.000**. Realisasi Juli 2026: **186.948.043.619**.

### Riwayat omzet PKD (`target rekap PKD` R59)

| APRIL | MAY | JUNE | JULY |
|---|---|---|---|
| 195.430.945.366 | 72.005.276.700 | 108.281.970.021 | 186.948.043.619 |

### Tally kejadian mingguan

**`target rekap pvi`**

| Divisi | Metrik | W1 | W2 | W3 | W4 | Total |
|---|---|---|---|---|---|---|
| Sales | Complain tracking | 1 | 1 | 1 | 2 | 5 |
| Sales | Ketidaksesuaian SOP | 2 | 4 | 5 | 5 | 16 |
| Sales | Rekonsiliasi tidak tepat waktu | 1 | 1 | 1 | 1 | 4 |
| Sales | Survey kepuasan nasabah | 17 | 17 | 29 | 35 | 98 |
| Teller luar | Ketelitian perhitungan | 4 | 1 | 3 | 3 | 11 |
| Teller luar | Kesesuaian SOP | 5 | 5 | 3 | 4 | 17 |
| Teller luar | Google review | 74 | 24 | 0 | 0 | 98 |
| Teller luar | Kebersihan | 1 | 0 | 0 | 0 | 1 |
| Teller dalam | Closing tepat waktu | 3 | 6 | 7 | 10 | 26 |
| Teller dalam | Kesesuaian SOP | 3 | 6 | 7 | 10 | 26 |
| Teller dalam | Kesesuaian jumlah kas | 2 | 6 | 7 | 6 | 21 |
| Kurir | Laporan serah terima | 17 | 13 | 20 | 34 | 84 |
| Kurir | Kesesuaian SOP | 0 | 1 | 0 | — | 1 |
| TL PVI | Kepatuhan regulasi SOP | 2 | 5 | — | — | 7 |
| TL PVI | Resiko likuiditas | 1 | 7 | — | — | 8 |
| TL PVI | Efisiensi pelaporan & kurs | 2 | 6 | — | — | 8 |
| TL PVI | Team management | 2 | 3 | 1 | 1 | 7 |

⚠️ Team Leader Marketing PVI praktis kosong (hanya 1 sel terisi).
⚠️ Deret teller dalam (3, 6, 7, 10) monoton naik — kemungkinan **kumulatif**, bukan increment
mingguan. Sales complain (1, 1, 1, 2) jelas increment. Konvensinya tidak konsisten.

**`target rekap ptu`**

| Divisi | Metrik | W1 | W2 | W3 | W4 | Total |
|---|---|---|---|---|---|---|
| Teller luar | Ketelitian perhitungan | 0 | 0 | 0 | 0 | 0 |
| Teller luar | Kesesuaian SOP | 2 | 4 | 5 | 5 | 16 |
| Teller luar | Kepuasan pelanggan | 9 | 9 | 16 | 27 | 61 |
| Teller luar | Kebersihan | 0 | 0 | 0 | 0 | 0 |
| Teller dalam | Closing tepat waktu | 9 | 15 | 0 | 28 | 52 |
| Teller dalam | Kesesuaian SOP | 1 | 15 | 23 | 28 | 67 |
| Teller dalam | Kesesuaian jumlah kas | 0 | 15 | 23 | 28 | 66 |
| TL PTU | Kepatuhan regulasi SOP | 1 | 4 | 5 | 0 | 10 |
| TL PTU | Marketing survey (ulasan Google) | 0 | 9 | 0 | 0 | 9 |
| TL PTU | Efisiensi pelaporan & kurs | 0 | 0 | 0 | 0 | 0 |
| TL PTU | Team management | 0 | 4 | 7 | 10 | 21 |

Catatan sheet: *"ULASAN MULAI DARI AKUN GLOSS INDUSTRY"*. Teller luar PTU: ARDY, JOESE, kiki.

**`target rekap PKD`**

| Divisi | Metrik | W1 | W2 | W3 | W4 | Total |
|---|---|---|---|---|---|---|
| Sales | Complain tracking | 0 | 0 | 0 | 0 | 0 |
| Sales | Kesesuaian SOP | 0 | 0 | 0 | 6 | 6 |
| Sales | Laporan compliance & rekonsiliasi | 0 | 0 | 0 | 0 | 0 |
| Sales | Kepuasan nasabah (survey) | 0 | 9 | 25 | 0 | 34 |
| Leader PKD | Kepatuhan regulasi SOP | 0 | 0 | 0 | 6 | 6 |
| Leader PKD | Complain nasabah | 0 | 0 | 0 | 2 | 2 |
| Leader PKD | Akurasi pelaporan & monitoring | 0 | 0 | 0 | 5 | 5 |
| Leader PKD | Team management (briefing) | 0 | 0 | 0 | 10 | 10 |

Sales PKD: VINNY, NADINE.

### Riwayat skor KPI bulanan

Tabel "target achievement KPI" ada di 3 sheet, hampir seluruhnya kosong:

| Sheet | Baris | Terisi |
|---|---|---|
| `pvi` | sales, teller luar, teller dalam, kurir, team leader, team leader pvi | MAY: teller luar 62 · teller dalam 81 · team leader 86 |
| `PTU` | sales, teller luar, teller dalam, team leader pvi | *(kosong)* |
| `PKD` | sales, team leader PKD | MAY: sales 86 / leader 75 · JUNE: sales 108 / leader 93 |

⚠️ Header bulan di sheet `pvi` dan `PKD`: JANUARY…SEPTEMBER, **NOVEMBER**, Desember —
**OKTOBER hilang**. Header di sheet `PTU` malah lompat: JANUARY, FEBUARY, MARCH, APRIL,
**AGUSTUS**, SEPTEMBER, NOVEMBER, Desember (MAY, JUNE, JULY, OKTOBER hilang).
⚠️ Nilai `86` untuk "team leader" PVI tidak cocok dengan skor manapun
(TL Marketing 0.6995, TL PVI 0.684).

### Link pelaporan (Google Forms, PTU saja)

| Form | URL |
|---|---|
| Kepala Cabang PTU | https://forms.gle/TPZ8ZWM9i2pq55aC8 |
| Teller Luar PTU | https://forms.gle/TRZVBSESVxLw9wtC9 |
| Teller Dalam PTU | https://forms.gle/nJcskY7k7NZWoDUy5 |
| PTU Marketing Survey | https://forms.gle/ZvEPKRi51C4DT61v5 |

PVI dan PKD belum punya form pelaporan.

### `Sheet9` — omzet marketing bulan 9/10/11 (Rp)

| Nama | Bulan 9 | Bulan 10 | Bulan 11 |
|---|---|---|---|
| yoga | 62.092.748.785 | 92.988.211.191 | 53.592.620.030 |
| vero | 58.273.185.494 | 155.006.667.280 | 170.649.110.080 |
| fenny | 51.134.177.955 | 83.271.588.900 | 61.805.346.531 |
| penny | 17.142.585.920 | 32.314.963.215 | 28.420.958.817 |
| lisia | 1.941.270.900 | 3.481.934.125 | 4.035.428.955 |
| **Total** | **190.583.969.054** | **367.063.364.711** | **318.503.464.413** |

`hoker`: 521.375.822.341 (344.519.567.691 + 176.856.254.650).

---

## 7. Daftar masalah

### Perhitungan
1. **`PVI!K4 = 0.84` di-hardcode**; rasio riil 0.04%. Target omzet sales individual (500 M) = target perusahaan.
2. **`PKD` sales total bobot 1.10** (bukan 1.00) → skor inflasi.
3. **`PTU` teller luar & teller dalam: kolom Weight kosong**, bobot salah masuk ke kolom Target. 60%+ bobot tidak terhitung.
4. **`PVI!M44 = 0.025` sel gantung** tanpa KR/bobot, ikut terjumlah.
5. **`%Ach` tidak di-cap** — omzet PKD 187% langsung dikali bobot, hasil akhir 144% di luar semua band bonus.
6. **Kolom Actual pakai 4 mode berbeda** tanpa penanda (`ACCUMULATE` / `DEDUCT_FROM_TARGET` / `LAST_WEEK` / hardcode).
7. **Nol traceability rekap → sheet KPI.** Tidak ada satu pun formula lintas-sheet (kecuali `PKD!F16={=F4}`).

### Data PVI tidak cocok dengan rekapnya sendiri

| Item | Rekap | Seharusnya | Tercatat |
|---|---|---|---|
| Sales – Kesesuaian SOP | 16 × 2% | 0.68 | **1.00** |
| Sales – Rekonsiliasi telat | 4 × 5% | 0.80 | **1.00** |
| Sales – Survey | 98 / 100 | 0.98 | **0.64** |
| Sales – Complain tracking | 5 × 5% | 0.75 | **0.90** |
| Teller luar – Ketelitian | 11 × 5% | 0.45 | **0.55** |
| Teller luar – Kesesuaian SOP | 17 × 3% | 0.49 | **1.00** |
| Teller luar – Kebersihan | 1 × 5% | 0.95 | **0.70** |
| Kurir – Kesesuaian SOP | 1 × 5% | 0.95 | **0.10** |
| Teller luar – Omzet | 8.485.969.585 | — | **8.000.000.000** |
| Kurir – Rute | 659 | — | **469** |

### Matrix bonus
11. **PVI kepala marketing: band 101–120% tidak ada.**
12. **PVI kurir: 61–85% (safe) bertabrakan dengan 10–70% (sanksi)** — 61–70% ambigu.
13. **PVI/PTU teller: nilai 60 dan 85 masuk dua band.** PKD kepala cabang: nilai 100 masuk dua band.
14. **PTU kepala cabang kehilangan band >120%** (ada di `_1`, hilang di `_2`).
15. **Semua matrix: 0–9% tidak terdefinisi.**
16. **Staf di-cap 100%** — tidak ada reward overachievement, padahal sales PKD mencapai 144%.
17. **Role sama, aturan beda antar entitas** tanpa alasan tercatat (teller luar bonus mulai 86%/85%/80%; teller dalam bonus 500rb PVI vs 250rb PTU; potongan 300rb PVI vs 150rb PTU).
18. **`PVI!F62 = 500`** untuk bonus "top number 1" sales — hampir pasti typo dari 500.000.
19. **Konsekuensi non-moneter tercampur** di matrix payroll: "sabtu wajib masuk" (jadwal kerja) dan "SP / teguran lisan" (disipliner).
20. **Bonus "top number 1"** butuh ranking antar karyawan dalam role yang sama — belum ada mekanismenya.

### Struktur & metadata
21. **Periode tidak konsisten dalam satu file**: `pvi` bertanda DESEMBER, rekapnya `may`/`APRIL`, PKD `JULI 2026`.
22. **PTU pakai layout kolom berbeda** (achievement/Actual) vs PVI & PKD (week 1–4).
23. **Week 1–3 kosong di sheet `pvi`** — semua data ditumpuk di kolom week 4 meski rekapnya per minggu.
24. **Bulan OKTOBER hilang** di semua tabel riwayat; sheet `PTU` juga kehilangan MAY, JUNE, JULY.
25. **`PKD!A16` salah label** — tertulis "Team leader PTU", seharusnya "Team leader PKD".
26. **Blok Kepala Cabang PKD (6 KR, bobot 1.00) hilang** dari `_2`.
27. **Penyesuaian target berbasis hari kerja belum diformalkan** — hanya catatan bebas *"bulan ini tambah 8% karena 2 hari libur"* (`PTU!K14`).
28. **Google Forms hanya untuk PTU**; PVI & PKD belum punya kanal input.

---

## 8. Implikasi desain

| Kebutuhan | Bentuk |
|---|---|
| Periode KPI | `KpiPeriod` (entitas × bulan × tahun), status draft/final |
| KR sebagai master | `KpiKeyResult` — `entity`, `role`, `name`, `target`, `weight`, `accrualMode`, `capAch` |
| Rule penalti terstruktur | `penaltyPerIncident` + `unit: POINT \| PERCENT` + `direction: PENALTY \| INCENTIVE` (ganti teks bebas kolom N) |
| Validasi bobot | Σ weight per role **harus = 1.00** — tolak simpan jika tidak (3 blok saat ini melanggar) |
| Input kejadian | `KpiIncident` per minggu per KR — sumber tunggal, week cell dihitung, tidak diketik |
| Konvensi week | Tetapkan **increment**, bukan kumulatif; tampilkan running total sebagai turunan |
| Cap achievement | Flag per KR: cap 100% atau uncapped |
| Scope target omzet | `INDIVIDUAL \| TEAM \| COMPANY` — akar bug `PVI!K4` |
| Band bonus | `BonusBand` (entity, role, minPct, maxPct, amount, type) + validasi **non-overlap & non-gap, cakupan 0–∞** |
| Konsekuensi non-moneter | Channel terpisah: `WorkScheduleSanction` (sabtu masuk) & `DisciplinaryAction` (SP/teguran) — bukan komponen gaji |
| Bonus peringkat | `topPerformerBonus` dengan ranking per (entity, role, period) |
| Syarat kelayakan | Gate `employmentStatus ∈ {PKWT, PKWTT}` sebelum bonus dibayar |
| Penyesuaian hari kerja | Field `targetAdjustmentPct` + alasan, per periode per role |
