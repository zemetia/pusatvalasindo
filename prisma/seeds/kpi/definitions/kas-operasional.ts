// KPI operasional kas & closing harian (jabatan teller).

import type { KpiSeed } from '../types'

export const KAS_OPERASIONAL_KPIS: KpiSeed[] = [
  {
    code: 'ketelitian-perhitungan',
    name: 'Ketelitian Perhitungan',
    objective: 'Memastikan ketelitian dalam perhitungan',
    description: '3 poin minus setiap kali ada kesalahan hitung.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'closing-tepat-waktu',
    name: 'Closing Tepat Waktu',
    objective: 'Memastikan closing laporan tepat waktu',
    description:
      'Batas maksimal 1 jam setelah jam closing; 1 hari terlambat = 4 poin minus. Diambil otomatis dari jam absen pulang.',
    scoringType: 'PENALTY_POINT',
    unit: 'DAY',
    // Jam absen pulang sudah tercatat di modul absensi — mengetik ulang
    // keterlambatan closing secara manual hanya menambah beban dan celah lupa.
    defaultInputSource: 'SYSTEM',
    defaultRequiresApproval: false,
    systemSourceKey: 'ATTENDANCE_CLOSING',
  },
  {
    code: 'kesesuaian-jumlah-kas',
    name: 'Kesesuaian Jumlah Kas',
    description: 'Selisih kas maksimal Rp 100.000 per hari; di atas itu dikenakan 4 poin minus.',
    scoringType: 'TOLERANCE_LIMIT',
    unit: 'CURRENCY',
    defaultInputSource: 'SELF',
    defaultRequiresApproval: true,
  },
  {
    code: 'checklist-in-out',
    name: 'Checklist In/Out Harian',
    description: 'Apakah semua transaksi in dan out sudah dilakukan checklist pada hari itu.',
    scoringType: 'BOOLEAN_DAILY',
    unit: 'DAY',
    defaultInputSource: 'SELF',
    defaultRequiresApproval: true,
  },
]
