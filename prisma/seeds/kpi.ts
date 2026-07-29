import type { PrismaClient } from '../../src/generated/prisma/client'

/**
 * Definisi KPI beserta cara penilaiannya.
 *
 * Setiap baris di bawah adalah terjemahan langsung dari kolom catatan pada
 * docs/PVI Data/PUSAT KPI SEMUA_.xlsx — teks aslinya disalin ke `description`
 * supaya aturan yang dipakai HR bisa dicek ulang tanpa membuka Excel.
 *
 * `defaultInputSource` menentukan siapa yang boleh mencatat:
 *   SELF       — karyawan mencatat sendiri (biasanya + persetujuan atasan)
 *   SUPERVISOR — hanya atasan/HR; karyawan tidak bisa menghapus temuan atas dirinya
 *   SYSTEM     — diambil otomatis dari modul lain, tidak bisa diinput manual
 */

type KpiSeed = {
  code: string
  name: string
  objective?: string
  description: string
  scoringType:
    | 'TARGET_VALUE'
    | 'PENALTY_POINT'
    | 'REWARD_POINT'
    | 'PENALTY_PERCENT'
    | 'TOLERANCE_LIMIT'
    | 'BOOLEAN_DAILY'
  unit: 'OCCURRENCE' | 'CURRENCY' | 'POINT' | 'PERCENT' | 'DAY' | 'PERSON'
  direction?: 'HIGHER_BETTER' | 'LOWER_BETTER'
  defaultInputSource: 'SELF' | 'SUPERVISOR' | 'SYSTEM'
  defaultRequiresApproval: boolean
  defaultRequiresEvidence?: boolean
  systemSourceKey?: string
}

export const KPI_DEFINITIONS: KpiSeed[] = [
  {
    code: 'jumlah-omzet',
    name: 'Jumlah Omzet',
    objective: 'Meningkatkan pelayanan kepada nasabah dan menaikkan omzet',
    description: 'Total omzet yang dibukukan dalam satu bulan dibandingkan target jabatan.',
    scoringType: 'TARGET_VALUE',
    unit: 'CURRENCY',
    defaultInputSource: 'SELF',
    defaultRequiresApproval: true,
    defaultRequiresEvidence: true,
  },
  {
    code: 'net-profit-margin',
    name: 'Net Profit Margin',
    objective: 'Memastikan resiko likuiditas minimal dan stok mata uang terjaga',
    description: 'Margin laba bersih bulan berjalan dibandingkan target.',
    scoringType: 'TARGET_VALUE',
    unit: 'CURRENCY',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'complain-nasabah',
    name: 'Complain Nasabah',
    description: '3 poin minus setiap ada komplain nasabah.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'kesesuaian-sop',
    name: 'Kesesuaian SOP',
    description: '2 poin minus setiap kesalahan prosedur.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'laporan-rekonsiliasi-tepat-waktu',
    name: 'Laporan & Rekonsiliasi Tepat Waktu',
    description: 'Lewat dari jam 17.30 minus 2 poin.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'laporan-compliance-tepat-waktu',
    name: 'Laporan Compliance Tepat Waktu',
    description: '4 poin minus setiap kesalahan pelaporan LTKT/LTKM.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'kepuasan-nasabah',
    name: 'Kepuasan Nasabah (Survey)',
    objective: 'Meningkatkan pelayanan kepada nasabah dan menaikkan omzet',
    description: '1 poin setiap survey terkumpul, target 100 survey per bulan.',
    scoringType: 'REWARD_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SELF',
    defaultRequiresApproval: true,
    defaultRequiresEvidence: true,
  },
  {
    code: 'kepuasan-pelanggan-review',
    name: 'Kepuasan Pelanggan (Google Review)',
    objective: 'Meningkatkan pelayanan kepada customer',
    description: '1 Google review ulasan bagus = +2 poin, target 50 poin.',
    scoringType: 'REWARD_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SELF',
    defaultRequiresApproval: true,
    defaultRequiresEvidence: true,
  },
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
    code: 'kebersihan-booth',
    name: 'Kebersihan & Kerapihan Booth',
    description: 'Minus 5 poin setiap tempat yang tidak bagus.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
    defaultRequiresEvidence: true,
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
    code: 'ketepatan-pengiriman',
    name: 'Ketepatan Waktu & Jumlah Pengiriman',
    objective: 'Memastikan pengiriman on time & customer happy',
    description: 'Jumlah pengiriman tepat waktu dibandingkan target bulanan.',
    scoringType: 'TARGET_VALUE',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SELF',
    defaultRequiresApproval: true,
    defaultRequiresEvidence: true,
  },
  {
    code: 'serah-terima-barang-tepat-waktu',
    name: 'Laporan Serah Terima Barang Tepat Waktu',
    description: 'Setiap kesalahan laporan serah terima dikenakan 4 poin minus.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'ketersediaan-stok-mata-uang',
    name: 'Ketersediaan Stok Mata Uang',
    description: 'Setiap kali customer datang dan stok tidak ada, minus 5%.',
    scoringType: 'PENALTY_PERCENT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'update-kurs',
    name: 'Update Kurs',
    description: 'Minus 5% setiap kali telat update kurs.',
    scoringType: 'PENALTY_PERCENT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'score-okr-tim-kurir',
    name: 'Score OKR Tim Kurir',
    objective: 'Memastikan kinerja tim kurir di bawah koordinasinya',
    description:
      'Rata-rata pencapaian KPI tim kurir pada periode yang sama, dalam persen (100 = seluruh target tim tercapai).',
    scoringType: 'TARGET_VALUE',
    unit: 'PERCENT',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'team-management',
    name: 'Team Management',
    description: 'Target 10 briefing tim per bulan.',
    scoringType: 'TARGET_VALUE',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SELF',
    defaultRequiresApproval: true,
  },
  {
    code: 'kepatuhan-regulasi-sop',
    name: 'Kepatuhan Regulasi SOP',
    objective: 'Pengawasan operasional',
    description: 'Setiap temuan pengawasan operasional dihitung 5%.',
    scoringType: 'PENALTY_PERCENT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'resiko-likuiditas',
    name: 'Resiko Likuiditas',
    description: 'Setiap temuan resiko likuiditas dihitung 5%.',
    scoringType: 'PENALTY_PERCENT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'efisiensi-pelaporan-monitoring',
    name: 'Efisiensi Pelaporan & Monitoring',
    description: 'Setiap temuan keterlambatan pelaporan/monitoring dihitung 5%.',
    scoringType: 'PENALTY_PERCENT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'efisiensi-pelaporan-monitoring-kurs',
    name: 'Efisiensi Pelaporan & Monitoring Kurs',
    description: 'Setiap temuan keterlambatan pelaporan/monitoring kurs dihitung 5%.',
    scoringType: 'PENALTY_PERCENT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'kesesuaian-pengarsipan-berkas',
    name: 'Kesesuaian Pengarsipan Berkas',
    description: '2 poin minus setiap berkas yang tidak diarsipkan sesuai ketentuan.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'kehadiran-kedisiplinan',
    name: 'Kehadiran & Kedisiplinan',
    description:
      'Keterlambatan & ketidakhadiran. Diambil otomatis dari modul absensi — tidak diisi manual.',
    scoringType: 'PENALTY_POINT',
    unit: 'DAY',
    defaultInputSource: 'SYSTEM',
    defaultRequiresApproval: false,
    systemSourceKey: 'ATTENDANCE_LATE',
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

export async function seedKpi(prisma: PrismaClient): Promise<void> {
  console.log('  🗑️ Membersihkan data KPI lama...')
  // Entri ikut terhapus lewat cascade RoleKpi → KpiEntry.
  await prisma.roleKpi.deleteMany()
  await prisma.kpiDefinition.deleteMany()

  for (const def of KPI_DEFINITIONS) {
    await prisma.kpiDefinition.upsert({
      where: { code: def.code },
      update: {
        name: def.name,
        objective: def.objective ?? null,
        description: def.description,
        scoringType: def.scoringType,
        unit: def.unit,
        direction: def.direction ?? 'HIGHER_BETTER',
        defaultInputSource: def.defaultInputSource,
        defaultRequiresApproval: def.defaultRequiresApproval,
        defaultRequiresEvidence: def.defaultRequiresEvidence ?? false,
        systemSourceKey: def.systemSourceKey ?? null,
        isActive: true,
      },
      create: {
        code: def.code,
        name: def.name,
        objective: def.objective ?? null,
        description: def.description,
        scoringType: def.scoringType,
        unit: def.unit,
        direction: def.direction ?? 'HIGHER_BETTER',
        defaultInputSource: def.defaultInputSource,
        defaultRequiresApproval: def.defaultRequiresApproval,
        defaultRequiresEvidence: def.defaultRequiresEvidence ?? false,
        systemSourceKey: def.systemSourceKey ?? null,
      },
    })
  }

  console.log(`  ✓ ${KPI_DEFINITIONS.length} definisi KPI di-seed`)
}
