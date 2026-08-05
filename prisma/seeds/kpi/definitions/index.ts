// Kumpulan definisi KPI, dipecah per tema agar mudah dicari saat sheet KPI
// berubah. Menambah KPI baru: buat/isi file tema yang sesuai, lalu daftarkan
// di sini.

import { OMZET_KPIS } from './omzet'
import { LAYANAN_KPIS } from './layanan'
import { KEPATUHAN_KPIS } from './kepatuhan'
import { KAS_OPERASIONAL_KPIS } from './kas-operasional'
import { PENGIRIMAN_KPIS } from './pengiriman'
import { STOK_KURS_KPIS } from './stok-kurs'
import { KEPEMIMPINAN_KPIS } from './kepemimpinan'
import { ABSENSI_KPIS } from './absensi'
import type { KpiSeed } from '../types'

export const KPI_DEFINITIONS: KpiSeed[] = [
  ...OMZET_KPIS,
  ...LAYANAN_KPIS,
  ...KEPATUHAN_KPIS,
  ...KAS_OPERASIONAL_KPIS,
  ...PENGIRIMAN_KPIS,
  ...STOK_KURS_KPIS,
  ...KEPEMIMPINAN_KPIS,
  ...ABSENSI_KPIS,
]
