// Bahan bersama untuk rule KPI bulanan PVI / PTU / PKD.
//
// Sebelas rule KPI memakai query dan syarat yang sama persis — yang berbeda
// hanya sasaran dan angkanya. Disatukan di sini supaya memperbaiki query (mis.
// menambah kolom baru) tidak berarti menyunting sebelas string yang saling
// menyimpang diam-diam.
//
// Acuan field: docs/tasks/spesifikasi-rule-slip-gaji.md

import type { GuardSeed } from './types'

/**
 * Skor KPI satu karyawan pada satu periode, sebagai PERSEN BULAT.
 *
 * `ROUND(total_score * 100)` bukan kosmetik: sheet manajemen menulis bandnya
 * dalam persen bulat ("86%-100%"), dan validator tier memeriksa celah/tumpang
 * tindih pada bilangan bulat — skor pecahan akan lolos di antara dua band tanpa
 * suara.
 *
 * `berkontrak` ikut diambil (0/1) karena bonus mensyaratkannya; lihat
 * `GATE_BERKONTRAK`.
 */
export const KPI_BULANAN_SQL =
  'SELECT COUNT(*)::int AS jumlah_baris, ' +
  'COALESCE(MAX(ROUND(k.total_score * 100))::int, 0) AS skor_persen, ' +
  'COALESCE(MAX(e.berkontrak), 0)::int AS berkontrak ' +
  'FROM hv_kpi_monthly k ' +
  'LEFT JOIN hv_employees e ON e.id = k.employee_id ' +
  'WHERE k.employee_id = :employee_id ' +
  'AND k.month = :periode_bulan AND k.year = :periode_tahun'

/**
 * Guard bersama, urutannya berarti — yang pertama cocok menang.
 *
 * @param minBandBonus skor terendah yang mulai berbonus di rule tersebut.
 */
export function guardsKpi(minBandBonus: number): GuardSeed[] {
  return [
    { if: 'jumlah_baris == 0', aksi: 'skip', flag: 'kpi_belum_dihitung' },

    // Aturan manajemen: "yang masih belum di kontrak belum bisa mendapatkan
    // bonus tambahan" (ekstraksi-kpi-bonus.md §5, Syarat universal).
    //
    // Ditulis sebagai kondisi MAJEMUK, bukan sekadar `berkontrak == 0`, dan itu
    // yang membuat penggabungan bonus+denda ke satu rule mungkin: kalau
    // syaratnya membatalkan seluruh rule, karyawan yang belum berkontrak juga
    // lolos dari POTONGAN — padahal potongan berlaku bagi siapa pun. Kondisi
    // ini karena itu hanya menyala di band yang berbonus.
    {
      if: `berkontrak == 0 and skor_persen >= ${minBandBonus}`,
      aksi: 'terapkan',
      nominal: 0,
      label: 'Skor mencukupi, tapi bonus belum bisa dibayar — status masih belum berkontrak',
      flag: 'belum_berkontrak',
    },
  ]
}

/**
 * Dipakai kalau tidak ada tier yang cocok.
 *
 * Tier di seluruh rule KPI sudah menutup −∞…+∞, jadi baris ini sesungguhnya
 * tidak pernah terpakai — validator mewajibkannya ada. SENGAJA tanpa flag
 * `butuh_review`: setiap band sudah punya angka pasti, jadi tidak ada keadaan
 * yang perlu diputuskan manusia per kasus.
 */
export const DEFAULT_KPI = {
  nominal: 0,
  label: 'Skor di luar seluruh band — tidak berdampak pada gaji',
}
