// Bonus peringkat 1 — rule reward/denda slip gaji.
//
// Dasar: PUSAT KPI SEMUA_2.xlsx, matriks bonus PVI (ekstraksi-kpi-bonus.md §5),
// yang untuk Sales/Marketing dan Kurir menulis "86%-100% → 250.000/org" dengan
// tambahan "top number 1 → 500.000".
//
// Sheet menulis `PVI!F62 = 500` untuk bonus ini — hampir pasti salah ketik dari
// 500.000 (masalah #18), dan dibaca sebagai 500.000 di sini. Rp 500 sebagai
// bonus peringkat tidak masuk akal di tengah band yang lain bernilai ratusan
// ribu.
//
// Rule ini yang menjawab masalah #20 ("bonus top number 1 butuh ranking antar
// karyawan dalam role yang sama — belum ada mekanismenya"): peringkatnya
// dihitung di dalam query, bukan disiapkan lebih dulu di tabel mana pun.

import type { RuleSeed } from './types'

/**
 * Peringkat skor KPI di dalam satu PT + jabatan, untuk periode berjalan.
 *
 * `RANK()` dipilih, bukan `ROW_NUMBER()`: kalau dua orang berskor sama persis,
 * keduanya memang peringkat 1 dan keduanya berhak. `ROW_NUMBER()` akan memilih
 * salah satu secara sewenang-wenang — urutan baris yang tidak ditentukan apa
 * pun menjadi penentu siapa dibayar.
 *
 * Pemeringkatan dilakukan atas SELURUH karyawan pada periode itu lalu barisnya
 * disaring di akhir, sehingga peringkat seseorang tetap dihitung relatif
 * terhadap rekan sejawatnya — bukan terhadap dirinya sendiri.
 */
const SQL_PERINGKAT =
  'WITH peringkat AS (' +
  'SELECT k.employee_id, ' +
  'ROUND(k.total_score * 100)::int AS skor_persen, ' +
  'RANK() OVER (PARTITION BY k.company_id, k.role_name ORDER BY k.total_score DESC)::int AS posisi ' +
  'FROM hv_kpi_monthly k ' +
  'WHERE k.month = :periode_bulan AND k.year = :periode_tahun' +
  ') ' +
  'SELECT COUNT(*)::int AS jumlah_baris, ' +
  'COALESCE(MAX(p.posisi), 0)::int AS posisi, ' +
  'COALESCE(MAX(p.skor_persen), 0)::int AS skor_persen, ' +
  'COALESCE(MAX(e.berkontrak), 0)::int AS berkontrak ' +
  'FROM peringkat p ' +
  'LEFT JOIN hv_employees e ON e.id = p.employee_id ' +
  'WHERE p.employee_id = :employee_id'

export const TOP_PERFORMER_RULES: RuleSeed[] = [
  {
    ruleKey: 'bonus_top_kpi_pvi',
    effectiveFrom: '2026-08-01',
    effectiveTo: null,
    mode: 'agregat',
    sql: SQL_PERINGKAT,
    tierField: 'posisi',

    // Angka kebijakan ditaruh sebagai konstanta bernama, bukan ditulis langsung
    // di formula. `bonus_top - bonus_reguler` menjelaskan dirinya sendiri;
    // `500000 - 250000` menuntut pembacanya menebak dari mana dua angka itu.
    constants: {
      bonus_top: 500000,
      bonus_reguler: 250000,
      skor_minimum: 86,
    },

    guards: [
      { if: 'jumlah_baris == 0', aksi: 'skip', flag: 'kpi_belum_dihitung' },

      // Dua kondisi di bawah ini tidak bisa ditulis sebagai tier: tier hanya
      // mencocokkan rentang pada `posisi`, sementara keduanya menyangkut kolom
      // LAIN (`berkontrak`, `skor_persen`). Inilah yang dijawab `terapkan` —
      // dan nominal 0 dipakai, bukan `skip`, supaya slip tetap menyatakan
      // "peringkat 1 tapi tidak dibayar, ini sebabnya" alih-alih diam.
      {
        if: 'berkontrak == 0 and posisi == 1',
        aksi: 'terapkan',
        nominal: 0,
        label: 'Peringkat 1, tapi bonus belum bisa dibayar — status masih belum berkontrak',
        flag: 'belum_berkontrak',
      },
      {
        if: 'posisi == 1 and skor_persen < skor_minimum',
        aksi: 'terapkan',
        nominal: 0,
        label: 'Peringkat 1 di jabatannya, tapi skor belum mencapai band berbonus',
        flag: 'top_skor_kurang',
      },
    ],

    tiers: [
      { max: 0, nominal: 0, label: 'Peringkat tidak bisa ditentukan — tidak ada skor KPI periode ini' },
      {
        min: 1,
        max: 1,
        // SELISIHNYA, bukan Rp 500.000 penuh. Rule KPI jabatan (kpi_pvi_marketing
        // / kpi_pvi_kurir) sudah membayar Rp 250.000 untuk skor 86% ke atas, dan
        // engine menjumlahkan seluruh rule yang cocok — membayar 500.000 di sini
        // membuat peringkat 1 menerima 750.000, bukan 500.000 seperti yang
        // ditulis sheet.
        formula: 'bonus_top - bonus_reguler',
        label: 'Tambahan bonus peringkat 1 KPI — melengkapi bonus reguler menjadi Rp 500.000',
      },
      { min: 2, nominal: 0, label: 'Bukan peringkat 1 di jabatannya — tanpa tambahan bonus' },
    ],

    defaults: {
      nominal: 0,
      label: 'Peringkat di luar seluruh band — tidak berdampak pada gaji',
    },

    // Hanya dua jabatan ini yang punya klausa "top number 1" di sheet, dan
    // keduanya kebetulan berbonus reguler Rp 250.000 — sehingga selisih yang
    // sama berlaku untuk keduanya. Jabatan lain SENGAJA tidak dimasukkan:
    // menambahkannya berarti mengarang kebijakan yang tidak pernah ditulis.
    targets: [{ company: ['PVI'], branch: '*', roles: ['Marketing', 'Kurir'] }],

    note:
      'Sumber: PUSAT KPI SEMUA_2.xlsx, matriks bonus PVI (ekstraksi-kpi-bonus.md §5) ' +
      '— "top number 1 → 500.000" untuk Sales/Marketing dan Kurir. Menjawab masalah ' +
      '#20: peringkat dihitung di dalam query dengan RANK(), bukan disiapkan manual.\n\n' +
      'Nominalnya SELISIH (Rp 250.000), bukan Rp 500.000 penuh — lihat komentar pada ' +
      'tier peringkat 1. Kalau suatu saat bonus reguler jabatan diubah, konstanta ' +
      '`bonus_reguler` di rule ini WAJIB ikut diubah, kalau tidak peringkat 1 akan ' +
      'menerima jumlah yang salah tanpa ada yang error.\n\n' +
      'Seri (dua orang berskor sama persis) membuat keduanya berperingkat 1 dan ' +
      'keduanya dibayar. Itu pilihan sadar — lihat komentar pada SQL_PERINGKAT.\n\n' +
      'Peringkat dihitung per (PT, nama jabatan) memakai kolom hv_kpi_monthly, jadi ' +
      'cabang TIDAK memisahkan persaingan: seluruh Kurir PVI bersaing dalam satu ' +
      'daftar. Itu mengikuti sheet, yang juga tidak memecah bonus per cabang.',
  },
]
