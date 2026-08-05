# Aturan KPI & Insentif per PT

Satu dokumen Markdown per PT: terjemahan sheet manajemen menjadi aturan yang
bisa ditegakkan mesin, lengkap dengan jejak sel Excel-nya dan setiap keputusan
yang diambil saat menerjemahkannya.

| Dokumen | PT | Status |
|---|---|---|
| [`pkd.md`](pkd.md) | Pusat Kirim Duit (`PKD`) | ✅ v2, berlaku 2026-07-01 |
| `pvi.md` | Pusat Valas Indo (`PVI`) | ⏳ belum ditulis |
| `ptu.md` | Pusat Tukar Uang (`PTU`) | ⏳ belum ditulis |

Dokumen di sini **menjelaskan**, tidak dieksekusi. Yang dieksekusi:

| Isi | Tempatnya |
|---|---|
| Definisi KPI | `prisma/seeds/kpi/definitions/` |
| Bobot & parameter KPI per jabatan | `prisma/seeds/role-kpi/<pt>.ts` |
| Matriks bonus & potongan | `prisma/seeds/payroll-rules/<pt>.ts` → tabel `PayrollRule` |

Sesudah database terisi, HR menyunting rule lewat halaman **Rule Reward &
Denda**. Berkas benih tidak lagi berpengaruh — lihat
[`prisma/seeds/README.md`](../../prisma/seeds/README.md).

## Konvensi

- **Nama file** = kode PT huruf kecil, sesuai `prisma/seeds/companies.seeder.ts`.
- **Angka persen ditulis sebagai persen bulat** (`86%`), sama seperti sheet
  manajemen dan sama seperti cara tier dicocokkan (`ROUND(total_score * 100)`).
- **Sebutkan sel asalnya** pada setiap aturan, supaya bisa ditelusuri saat
  manajemen mengubah sheet.
- **Jangan mengoreksi angka manajemen secara diam-diam.** Tulis nilai apa adanya
  dari sheet, lalu catat koreksi yang diusulkan sebagai keputusan tersendiri
  beserta dampak rupiahnya.
- **Versi lama jangan dihapus.** Payroll bulan lampau harus tetap bisa dijelaskan
  dengan aturan yang berlaku saat itu.
