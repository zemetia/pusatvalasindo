// Bonus omzet TIM — rule reward/denda slip gaji.
//
// Satu tim = semua karyawan berjabatan sama di cabang yang sama. Timnya TIDAK
// ditulis di rule: `:branch_id` dan `:custom_role_id` yang disuntikkan engine
// adalah cabang dan jabatan karyawan yang sedang dihitung, sehingga satu rule
// ini melayani seluruh tim di seluruh PT sekaligus. Budi di Cengkareng dinilai
// terhadap timnya sendiri, Sari di Pluit terhadap timnya.
//
// Karena `omzet_tim` bernilai sama bagi seluruh anggota, hasilnya otomatis
// "bareng-bareng": satu tim naik atau turun bersama.

import type { RuleSeed } from './types'

/**
 * Omzet satu tim pada periode berjalan.
 *
 * Memakai `hv_kpi_logs` + `kpi_code`, BUKAN `hv_revenue_monthly`. Kolom
 * `total_revenue` pada view itu adalah SUM seluruh KpiEntry ber-unit CURRENCY,
 * sehingga ia mencampur "Jumlah Omzet" dengan "Net Profit Margin" dan
 * "Kesesuaian Jumlah Kas" — yang terakhir itu SELISIH KAS. Memakainya berarti
 * membayar bonus omzet atas angka yang sebagian bukan omzet.
 *
 * `kpi_code` (bukan `kpi_name`) karena kodenya dijamin stabil dan unik;
 * mengganti nama KPI di halaman admin tidak boleh mematikan rule gaji.
 *
 * `status = 'APPROVED'` karena entri yang belum disetujui belum boleh jadi
 * uang. Konsekuensinya nyata: tim yang omzetnya sudah diinput tapi belum
 * disetujui terbaca nol — itulah yang dijaga guard `jumlah_baris == 0`.
 *
 * SENGAJA tidak memakai `:employee_id`: yang dicari angka TIM, bukan angka
 * orangnya. Validator memberi peringatan untuk ini, dan di sini peringatan itu
 * memang jawabannya "ya, sengaja".
 */
const SQL_OMZET_TIM =
  'SELECT COUNT(*)::int AS jumlah_baris, ' +
  'COUNT(DISTINCT l.employee_id)::int AS jumlah_anggota, ' +
  'COALESCE(SUM(l.quantity), 0)::bigint AS omzet_tim ' +
  'FROM hv_kpi_logs l ' +
  'WHERE l.month = :periode_bulan AND l.year = :periode_tahun ' +
  "AND l.branch_id = :branch_id AND l.role_id = :custom_role_id " +
  "AND l.kpi_code = 'jumlah-omzet' AND l.status = 'APPROVED'"

export const OMZET_TIM_RULES: RuleSeed[] = [
  {
    ruleKey: 'bonus_omzet_tim',
    effectiveFrom: '2026-09-01',
    effectiveTo: null,
    mode: 'agregat',
    sql: SQL_OMZET_TIM,
    tierField: 'omzet_tim',

    guards: [
      // Tanpa ini, tim yang omzetnya belum diinput/belum disetujui terbaca
      // Rp 0 dan langsung kena potongan Rp 200.000 — seluruh anggotanya.
      // Jabatan yang memang tidak punya KPI omzet sama sekali (Teller Dalam,
      // Kurir) juga berhenti di sini, sehingga rule ini boleh menyasar semua
      // orang tanpa memotong yang tidak relevan.
      { if: 'jumlah_baris == 0', aksi: 'skip', flag: 'omzet_belum_masuk' },

      // Karyawan yang baru masuk di tengah periode ikut menanggung hasil tim
      // sebulan penuh — termasuk potongannya, atas bulan yang sebagian besar
      // ia belum bekerja. Bonusnya tetap boleh diterima; yang dibatalkan hanya
      // sisi potongannya.
      {
        if: 'karyawan.tgl_masuk > periode.awal and omzet_tim < 50000000',
        aksi: 'terapkan',
        nominal: 0,
        label: 'Karyawan baru — tidak ikut menanggung potongan omzet tim bulan ini',
        flag: 'karyawan_baru',
      },
    ],

    tiers: [
      { max: 49_999_999, nominal: -200000, label: 'Omzet tim di bawah Rp 50 juta — potongan bersama' },
      { min: 50_000_000, max: 69_999_999, nominal: 0, label: 'Omzet tim Rp 50–70 juta — tanpa bonus maupun potongan' },
      { min: 70_000_000, max: 89_999_999, nominal: 50000, label: 'Bonus omzet tim Rp 70–90 juta' },
      { min: 90_000_000, max: 100_000_000, nominal: 100000, label: 'Bonus omzet tim Rp 90–100 juta' },
      { min: 100_000_001, nominal: 500000, label: 'Bonus omzet tim di atas Rp 100 juta' },
    ],

    defaults: {
      nominal: 0,
      label: 'Omzet tim di luar seluruh band — tidak berdampak pada gaji',
    },

    // Tim ditentukan oleh cabang & jabatan karyawan yang sedang dihitung, jadi
    // sasarannya justru TIDAK dibatasi. Yang menyaring siapa ikut adalah
    // datanya: hanya jabatan yang punya KPI "Jumlah Omzet" yang menghasilkan
    // baris, sisanya berhenti di guard pertama.
    targets: [{ company: '*', branch: '*', roles: '*' }],

    note:
      'Bonus/potongan omzet per TIM (cabang + jabatan yang sama), berlaku lintas PT.\n\n' +
      'BATAS BAND. Angka yang diminta bertumpang tindih di tepinya (50jt, 70jt, 90jt, ' +
      '100jt masing-masing diklaim dua band). Diselesaikan ke arah yang menguntungkan ' +
      'karyawan — nilai batas masuk band yang lebih tinggi — mengikuti konvensi yang ' +
      'sama dengan rule KPI PVI/PTU/PKD. Karena itu Rp 100.000.000 tepat membayar ' +
      'Rp 100.000, dan band Rp 500.000 mulai di Rp 100.000.001.\n\n' +
      'SUMBER ANGKA. hv_kpi_logs disaring kpi_code = "jumlah-omzet" dan status = ' +
      '"APPROVED". Kalau suatu saat ada KPI omzet kedua dengan kode berbeda, kode itu ' +
      'WAJIB ditambahkan di sini — kalau tidak, omzetnya tidak ikut terhitung tanpa ' +
      'ada yang error.\n\n' +
      'YANG PERLU DIPUTUSKAN MANAJEMEN. Potongan Rp 200.000 berlaku untuk SETIAP ' +
      'anggota tim, jadi tim berisi 5 orang kehilangan Rp 1.000.000 secara total. ' +
      'Kalau yang dimaksud potongan Rp 200.000 untuk timnya (dibagi rata), ubah ' +
      'nominalnya menjadi formula `-200000 / jumlah_anggota` — kolom `jumlah_anggota` ' +
      'sudah ikut diambil query supaya perubahan itu tidak perlu menyentuh SQL.\n\n' +
      'Berlaku mulai 1 September 2026 — bukan periode berjalan, supaya slip Agustus ' +
      'yang mungkin sudah dihitung tidak berubah surut.',
  },
]
