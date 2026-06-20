# Admin Module Specification

> Status: Planning — data & forms TBD (owner will supply)
> Last updated: 2026-04-23

---

## Overview

Halaman admin adalah sistem internal untuk manajemen operasional multi-cabang. Mencakup lima domain utama: kehadiran karyawan, penilaian KPI, penggajian & bonus, manajemen akun karyawan, dan stok mata uang per cabang.

---

## 1. Absensi (Attendance)

Modul absensi mencatat kehadiran harian karyawan dengan dukungan beberapa tipe absensi.

### Tipe Absensi
- **Hadir** — kehadiran normal
- **Izin** — tidak masuk dengan izin tertulis/lisan
- **Sakit** — tidak masuk karena sakit (bisa dilampirkan surat dokter)
- **Cuti** — cuti tahunan atau cuti khusus
- **Alpha** — tidak hadir tanpa keterangan
- **WFH** (jika berlaku) — kerja dari rumah
- **Lembur** — tambahan jam kerja di luar jadwal normal

### Data yang Dicatat per Record Absensi
- Karyawan (employee)
- Cabang
- Tanggal
- Tipe absensi
- Jam masuk / jam keluar
- Foto clock-in (opsional — untuk verifikasi lapangan)
- Catatan / keterangan
- Disetujui oleh (approval flow untuk izin/cuti/lembur)

### Form & Table
- **Form Absensi Harian** — input per karyawan atau bulk per cabang
- **Form Pengajuan Izin/Cuti** — diajukan karyawan, disetujui atasan
- **Form Lembur** — nominal jam lembur + persetujuan
- **Table Rekap Absensi** — filter per bulan, cabang, karyawan, tipe
- **Table Rekap Lembur** — total jam lembur per periode

> Data detail (kolom, validasi, dropdown values) akan ditambahkan oleh owner.

---

## 2. KPI (Key Performance Indicator)

Modul KPI digunakan untuk penilaian performa karyawan secara periodik (bulanan).

### Struktur KPI
- KPI terdiri dari beberapa **kategori** (contoh: Sales, Kehadiran, Kualitas Kerja, dll.)
- Setiap kategori memiliki **bobot (weight)** dalam persen (total = 100%)
- Setiap kategori dinilai dengan **skor** (misal 1–100 atau skala custom)
- Skor akhir = jumlah (skor × bobot) per kategori
- Dari skor akhir, karyawan mendapat **grade**: A / B / C / D

### Grade KPI (sementara, TBD)
| Grade | Rentang Skor |
|-------|-------------|
| A     | 90–100      |
| B     | 75–89       |
| C     | 60–74       |
| D     | < 60        |

### Form & Table
- **Form Input KPI Bulanan** — input skor per kategori per karyawan
- **Form Setup Kategori KPI** — mendefinisikan kategori dan bobotnya
- **Table Rekap KPI** — skor dan grade per karyawan per bulan
- **Table Perbandingan KPI** — trend performa dari bulan ke bulan

> Kategori KPI, bobot, dan skala penilaian akan ditentukan oleh owner.

---

## 3. Payroll & Kompensasi

Penghitungan gaji dan kompensasi berdasarkan data absensi dan KPI.

### Komponen Gaji
1. **Gaji Pokok** — tetap sesuai kontrak
2. **Tunjangan** — transport, makan, jabatan, dll. (komponen TBD)
3. **Potongan** — keterlambatan, alpha, pinjaman, BPJS, pajak (TBD)
4. **Lembur** — dihitung dari total jam lembur × tarif per jam
5. **KPI Reward** — bonus berdasarkan grade KPI bulan tersebut
6. **Bonus Tahunan** — dihitung setahun sekali (akhir tahun / anniversary)
7. **Bonus Lebaran (THR)** — minimal 1 bulan gaji pokok, proporsional masa kerja
8. **Kontrak Kerja** — referensi data kontrak (masa kerja, jenis kontrak PKWT/PKWTT)

### Alur Penghitungan
```
Absensi bulan ini
  → total hadir, alpha, lembur, izin/sakit/cuti

KPI bulan ini
  → grade + skor

Gaji = Gaji Pokok
      + Tunjangan
      - Potongan (alpha, keterlambatan, dll.)
      + Lembur
      + KPI Reward (dari grade)

Payslip digenerate per karyawan per bulan
```

### Form & Table
- **Form Setup Komponen Gaji** — per karyawan atau per jabatan
- **Form Generate Payroll** — pilih periode, generate untuk semua/satu cabang
- **Form Input Bonus** — Bonus Tahunan, THR, input manual per karyawan
- **Table Payroll Bulanan** — ringkasan per karyawan: gross, potongan, net
- **Table Riwayat Payslip** — arsip slip gaji per karyawan
- **Table Kontrak Kerja** — daftar kontrak aktif, tanggal mulai/berakhir, jenis

> Besaran tarif lembur, potongan, KPI reward per grade, dan komponen tunjangan akan diisi oleh owner.

---

## 4. Manajemen Karyawan & Akun

Setiap karyawan memiliki akun sistem dengan role yang menentukan akses halaman.

### Role yang Direncanakan
| Role | Deskripsi |
|------|-----------|
| Super Admin | Akses penuh ke semua modul dan semua cabang |
| Owner | Akses baca semua cabang, approval payroll |
| Kepala Cabang | Manajemen cabang sendiri (absensi, KPI, stok) |
| Kasir | Input transaksi, stok mata uang harian |
| HR | Kelola absensi, KPI, payroll |
| Akuntan | Finance flow, payroll, laporan |

### Data Karyawan
- Nama lengkap, NIK, foto
- Jabatan & cabang
- Jenis kontrak (PKWT/PKWTT) + tanggal mulai/berakhir
- Email (untuk login), nomor WhatsApp
- Gaji pokok (sesuai kontrak)
- Status aktif/nonaktif

### Form & Table
- **Form Tambah/Edit Karyawan** — data lengkap + assign role + cabang
- **Form Reset Password** — oleh admin/HR
- **Table Daftar Karyawan** — filter per cabang, role, status
- **Table Kontrak Aktif / Akan Berakhir** — reminder kontrak yang hampir expired

---

## 5. Stok Mata Uang & Bank Account

Modul ini melacak inventori mata uang fisik di setiap cabang dan saldo rekening bank.

### Stok Mata Uang per Cabang
- Setiap cabang memiliki stok masing-masing mata uang
- Pergerakan stok: beli dari nasabah, jual ke nasabah, transfer antar cabang
- Rate beli / rate jual dicatat per transaksi
- Rekap stok harian (pembukaan & penutupan)

### Mata Uang yang Dikelola (TBD lengkapnya)
SGD, AUD, HKD, USD, JPY, GBP, EUR, CHF, NZD, CAD — dan lainnya sesuai operasional.

### Bank Account
- Setiap cabang bisa memiliki satu atau lebih rekening bank
- Dicatat: nama bank, nomor rekening, mata uang rekening, saldo
- Pergerakan saldo (masuk/keluar) terhubung ke transaksi remittance & money changer

### Form & Table
- **Form Stok Awal** — input stok pembukaan per mata uang per cabang
- **Form Penyesuaian Stok** — koreksi manual dengan alasan
- **Form Transfer Antar Cabang** — perpindahan fisik mata uang
- **Form Bank Account** — tambah/edit rekening bank per cabang
- **Table Stok Harian** — posisi stok per mata uang per cabang
- **Table Mutasi Stok** — riwayat pergerakan per currency
- **Table Bank Account** — daftar rekening + saldo terkini
- **Table Mutasi Bank** — riwayat debit/kredit per rekening

> Data aktual (nama cabang, rekening, mata uang yang aktif) akan ditambahkan oleh owner.

---

## Catatan Umum

- Semua tabel mendukung filter per **cabang** dan **periode (bulan/tahun)**
- Data payroll dan KPI bersifat **immutable setelah di-approve** (perlu flow approval)
- Akses data dibatasi sesuai role — Kepala Cabang hanya lihat cabangnya sendiri
- Form detail, validasi, dan nilai default akan dilengkapi setelah owner menyediakan data
