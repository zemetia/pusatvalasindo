import { Prisma, type PrismaClient } from '../../src/generated/prisma/client'

/**
 * Penerapan KPI ke tiap jabatan per PT, lengkap dengan bobot dan parameter
 * penilaiannya. Semua angka di bawah berasal dari sheet KPI perusahaan
 * (docs/PVI Data/PUSAT KPI SEMUA_.xlsx & PERHITUNGAN KOMISI KPI_.xlsx).
 *
 * Catatan yang perlu diketahui saat membaca angka ini:
 *  - `pointPerUnit` untuk KPI PENALTY_POINT adalah poin yang hilang per kejadian;
 *    untuk PENALTY_PERCENT adalah persen yang hilang per kejadian.
 *  - KPI yang sama bisa punya beban berbeda antar jabatan — mis. komplain
 *    nasabah 3 poin untuk Marketing tapi 5 poin (setara −5%) untuk Kepala
 *    Marketing, persis seperti di sheet aslinya.
 *  - Beberapa jabatan di sheet punya total bobot ≠ 1 (mis. Kepala Cabang PVI
 *    berjumlah 1,1). Angkanya dibiarkan apa adanya; engine menormalkan dengan
 *    total bobot dan UI menampilkan peringatan agar bisa dirapikan HR.
 */

type RoleKpiSeed = {
  kpi: string // KpiDefinition.code
  weight: number
  targetValue?: number
  basePoint?: number
  pointPerUnit?: number
  toleranceLimit?: number
  toleranceScope?: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  /** Override kebijakan pengisian khusus jabatan ini (null = ikut definisi). */
  inputSource?: 'SELF' | 'SUPERVISOR' | 'SYSTEM'
  /** Parameter kolektor otomatis; lihat src/lib/kpi-collectors.ts. */
  systemConfig?: Prisma.InputJsonObject
}

/**
 * Closing tepat waktu ditarik dari jam absen pulang. Batas jamnya berbeda antar
 * PT — sheet KPI menulis 05.15 untuk PVI dan 05.00 untuk PTU — dengan toleransi
 * 1 jam ("BATAS MAKSIMAL 1 JAM SETELAH ...").
 */
const CLOSING = (weight: number, deadline: string): RoleKpiSeed => ({
  kpi: 'closing-tepat-waktu',
  weight,
  basePoint: 100,
  pointPerUnit: 4,
  systemConfig: { deadline, graceMinutes: 60 },
})

type RoleBlock = {
  company: 'PVI' | 'PTU' | 'PKD'
  role: string // custom_role.name
  kpis: RoleKpiSeed[]
}

// Parameter yang dipakai berulang, supaya perubahan aturan cukup di satu tempat.
const SOP_PENALTY = (weight: number, point: number): RoleKpiSeed => ({
  kpi: 'kesesuaian-sop',
  weight,
  basePoint: 100,
  pointPerUnit: point,
})

const TEAM_MANAGEMENT: RoleKpiSeed = {
  kpi: 'team-management',
  weight: 0.1,
  targetValue: 10, // 10 briefing per bulan
}

/**
 * Catatan bobot Kepala Cabang (PVI & PTU).
 *
 * Di sheet, empat KPI intinya berjumlah tepat 1,0 (0,4 + 0,25 + 0,2 + 0,15) dan
 * baris subtotalnya memang berbunyi 1,0 — tapi baris TEAM MANAGEMENT (0,1)
 * ditulis DI BAWAH rentang rumus subtotal itu, sehingga totalnya jadi 110%
 * tanpa disadari. Kepala Cabang PKD punya empat KPI inti yang sama tanpa Team
 * Management dan berjumlah pas 100%, jadi Team Management memang tambahan yang
 * lupa diimbangi.
 *
 * Di sini 10% itu diambil dari `jumlah-omzet` (0,4 → 0,3) karena hanya bobot
 * itu yang cukup besar untuk menampungnya tanpa menghapus KPI lain. Ini satu-
 * satunya angka yang bukan salinan langsung dari sheet — kalau manajemen ingin
 * 10% itu diambil dari KPI lain, cukup ubah dua baris `jumlah-omzet` di blok
 * Kepala Cabang PVI dan PTU.
 */

const ROLE_BLOCKS: RoleBlock[] = [
  // ── PUSAT VALAS INDO ─────────────────────────────────────────────────────
  {
    company: 'PVI',
    role: 'Marketing',
    kpis: [
      { kpi: 'jumlah-omzet', weight: 0.3, targetValue: 700_000_000 },
      { kpi: 'complain-nasabah', weight: 0.15, basePoint: 100, pointPerUnit: 3 },
      SOP_PENALTY(0.2, 2),
      { kpi: 'laporan-rekonsiliasi-tepat-waktu', weight: 0.15, basePoint: 100, pointPerUnit: 2 },
      { kpi: 'laporan-compliance-tepat-waktu', weight: 0.1, basePoint: 100, pointPerUnit: 4 },
      { kpi: 'kepuasan-nasabah', weight: 0.1, targetValue: 100, pointPerUnit: 1 },
    ],
  },
  {
    company: 'PVI',
    role: 'Teller Luar',
    kpis: [
      { kpi: 'jumlah-omzet', weight: 0.35, targetValue: 10_000_000_000 },
      { kpi: 'ketelitian-perhitungan', weight: 0.1, basePoint: 100, pointPerUnit: 3 },
      SOP_PENALTY(0.15, 3),
      { kpi: 'kepuasan-pelanggan-review', weight: 0.3, targetValue: 50, pointPerUnit: 2 },
      { kpi: 'kebersihan-booth', weight: 0.1, basePoint: 100, pointPerUnit: 5 },
    ],
  },
  {
    company: 'PVI',
    role: 'Teller Dalam',
    kpis: [
      CLOSING(0.45, '05:15'),
      { kpi: 'checklist-in-out', weight: 0.2 },
      {
        kpi: 'kesesuaian-jumlah-kas',
        weight: 0.35,
        basePoint: 100,
        pointPerUnit: 4,
        toleranceLimit: 100_000,
        toleranceScope: 'DAILY',
      },
    ],
  },
  {
    company: 'PVI',
    role: 'Kurir',
    kpis: [
      { kpi: 'ketepatan-pengiriman', weight: 0.7, targetValue: 900 },
      { kpi: 'serah-terima-barang-tepat-waktu', weight: 0.2, basePoint: 100, pointPerUnit: 4 },
      SOP_PENALTY(0.1, 4),
    ],
  },
  {
    company: 'PVI',
    role: 'Kepala Marketing',
    kpis: [
      { kpi: 'net-profit-margin', weight: 0.4, targetValue: 700_000_000 },
      // Sheet PVI menulis 0,2 sehingga totalnya cuma 95%, padahal baris subtotal
      // di sheet yang sama berbunyi 1,0. Disamakan dengan PTU (0,25) agar genap.
      { kpi: 'ketersediaan-stok-mata-uang', weight: 0.25, pointPerUnit: 5 },
      { kpi: 'complain-nasabah', weight: 0.15, basePoint: 100, pointPerUnit: 5 },
      { kpi: 'update-kurs', weight: 0.1, pointPerUnit: 5 },
      TEAM_MANAGEMENT,
    ],
  },
  {
    company: 'PVI',
    role: 'Kepala Cabang',
    kpis: [
      // Bobot omzet diturunkan dari 0,4 ke 0,3 untuk memberi ruang Team
      // Management — lihat catatan KEPALA_CABANG di bawah blok ini.
      { kpi: 'jumlah-omzet', weight: 0.3, targetValue: 700_000_000_000 },
      { kpi: 'kepatuhan-regulasi-sop', weight: 0.25, pointPerUnit: 5 },
      { kpi: 'resiko-likuiditas', weight: 0.2, pointPerUnit: 5 },
      { kpi: 'efisiensi-pelaporan-monitoring-kurs', weight: 0.15, pointPerUnit: 5 },
      TEAM_MANAGEMENT,
    ],
  },

  // ── PUSAT TUKAR UANG ─────────────────────────────────────────────────────
  {
    company: 'PTU',
    role: 'Teller Luar',
    kpis: [
      { kpi: 'jumlah-omzet', weight: 0.35, targetValue: 85_000_000_000 },
      { kpi: 'ketelitian-perhitungan', weight: 0.1, basePoint: 100, pointPerUnit: 3 },
      SOP_PENALTY(0.15, 3),
      { kpi: 'kepuasan-pelanggan-review', weight: 0.3, targetValue: 50, pointPerUnit: 2 },
      { kpi: 'kebersihan-booth', weight: 0.1, basePoint: 100, pointPerUnit: 5 },
    ],
  },
  {
    company: 'PTU',
    role: 'Teller Dalam',
    kpis: [
      CLOSING(0.45, '05:00'),
      { kpi: 'checklist-in-out', weight: 0.2 },
      {
        kpi: 'kesesuaian-jumlah-kas',
        weight: 0.35,
        basePoint: 100,
        pointPerUnit: 4,
        toleranceLimit: 100_000,
        toleranceScope: 'DAILY',
      },
    ],
  },
  {
    company: 'PTU',
    role: 'Kurir',
    kpis: [
      { kpi: 'ketepatan-pengiriman', weight: 0.7, targetValue: 900 },
      { kpi: 'serah-terima-barang-tepat-waktu', weight: 0.2, basePoint: 100, pointPerUnit: 4 },
      SOP_PENALTY(0.1, 4),
    ],
  },
  {
    company: 'PTU',
    role: 'Kepala Marketing',
    kpis: [
      { kpi: 'net-profit-margin', weight: 0.4, targetValue: 85_000_000_000 },
      { kpi: 'ketersediaan-stok-mata-uang', weight: 0.25, pointPerUnit: 5 },
      // Dua KPI ini ada di sheet PTU tapi belum pernah ikut ter-seed, itulah
      // sebabnya jabatan ini sempat cuma berbobot 65%.
      { kpi: 'score-okr-tim-kurir', weight: 0.2, targetValue: 100 },
      { kpi: 'resiko-likuiditas', weight: 0.15, pointPerUnit: 5 },
    ],
  },
  {
    company: 'PTU',
    role: 'Kepala Cabang',
    kpis: [
      // Sama seperti Kepala Cabang PVI: omzet memberi ruang 10% untuk Team Management.
      { kpi: 'jumlah-omzet', weight: 0.3, targetValue: 85_000_000_000 },
      { kpi: 'kepatuhan-regulasi-sop', weight: 0.25, pointPerUnit: 5 },
      { kpi: 'complain-nasabah', weight: 0.2, basePoint: 100, pointPerUnit: 5 },
      { kpi: 'efisiensi-pelaporan-monitoring', weight: 0.15, pointPerUnit: 5 },
      TEAM_MANAGEMENT,
    ],
  },

  // ── PUSAT KIRIM DUIT ─────────────────────────────────────────────────────
  {
    company: 'PKD',
    role: 'Marketing',
    kpis: [
      { kpi: 'jumlah-omzet', weight: 0.3, targetValue: 85_000_000_000 },
      { kpi: 'complain-nasabah', weight: 0.15, basePoint: 100, pointPerUnit: 3 },
      SOP_PENALTY(0.2, 2),
      { kpi: 'laporan-rekonsiliasi-tepat-waktu', weight: 0.15, basePoint: 100, pointPerUnit: 2 },
      { kpi: 'laporan-compliance-tepat-waktu', weight: 0.1, basePoint: 100, pointPerUnit: 4 },
      { kpi: 'kepuasan-nasabah', weight: 0.1, targetValue: 100, pointPerUnit: 1 },
    ],
  },
  {
    company: 'PKD',
    role: 'Kepala Cabang',
    kpis: [
      { kpi: 'jumlah-omzet', weight: 0.4, targetValue: 85_000_000_000 },
      { kpi: 'kepatuhan-regulasi-sop', weight: 0.25, pointPerUnit: 5 },
      { kpi: 'complain-nasabah', weight: 0.2, basePoint: 100, pointPerUnit: 5 },
      { kpi: 'efisiensi-pelaporan-monitoring', weight: 0.15, pointPerUnit: 5 },
    ],
  },
]

/**
 * Total bobot tiap jabatan harus 100%.
 *
 * Engine memang menormalkan dengan total bobot supaya karyawan tidak dirugikan
 * konfigurasi yang belum rapi, tapi justru itu yang membuat bobot meleset bisa
 * lolos tanpa disadari — persis yang terjadi pada sheet aslinya. Pemeriksaan ini
 * membuatnya terlihat setiap kali seed dijalankan.
 */
function auditWeights(): string[] {
  const problems: string[] = []
  for (const block of ROLE_BLOCKS) {
    const total = Math.round(block.kpis.reduce((sum, k) => sum + k.weight, 0) * 100)
    if (total !== 100) {
      problems.push(`${block.company} / ${block.role}: total bobot ${total}% (seharusnya 100%)`)
    }
  }
  return problems
}

export async function seedRoleKpis(
  prisma: PrismaClient,
  companyIds: Record<string, string>
) {
  console.log('🌱 Seeding penerapan KPI per jabatan...')

  const weightProblems = auditWeights()
  if (weightProblems.length > 0) {
    console.warn(`  ⚠ ${weightProblems.length} jabatan bobotnya tidak 100%:`)
    weightProblems.forEach((p) => console.warn(`    - ${p}`))
  }

  const roles = await prisma.custom_role.findMany({ select: { id: true, name: true, companyId: true } })
  const kpiDefs = await prisma.kpiDefinition.findMany({ select: { id: true, code: true } })

  const roleLookup = new Map(roles.map((r) => [`${r.companyId}_${r.name}`, r.id]))
  const kpiLookup = new Map(kpiDefs.map((k) => [k.code, k.id]))

  let count = 0
  const skipped: string[] = []

  for (const block of ROLE_BLOCKS) {
    const companyId = companyIds[block.company]
    const roleId = roleLookup.get(`${companyId}_${block.role}`)

    if (!companyId || !roleId) {
      skipped.push(`${block.company} / ${block.role} (jabatan tidak ditemukan)`)
      continue
    }

    for (const item of block.kpis) {
      const kpiId = kpiLookup.get(item.kpi)
      if (!kpiId) {
        skipped.push(`${block.company} / ${block.role} / ${item.kpi} (definisi tidak ditemukan)`)
        continue
      }

      const data = {
        weight: item.weight,
        targetValue: item.targetValue ?? null,
        basePoint: item.basePoint ?? null,
        pointPerUnit: item.pointPerUnit ?? null,
        toleranceLimit: item.toleranceLimit ?? null,
        toleranceScope: item.toleranceScope ?? null,
        inputSource: item.inputSource ?? null,
        // Prisma menuntut sentinel DbNull untuk mengosongkan kolom Json,
        // bukan null biasa.
        systemConfig: item.systemConfig ?? Prisma.DbNull,
        maxAchievement: 1.2,
        minAchievement: 0,
        isActive: true,
      }

      await prisma.roleKpi.upsert({
        where: {
          companyId_customRoleId_kpiId: { companyId, customRoleId: roleId, kpiId },
        },
        update: data,
        create: { companyId, customRoleId: roleId, kpiId, ...data },
      })
      count++
    }
  }

  console.log(
    `  ✓ ${count} penerapan KPI per jabatan di-seed` +
      (weightProblems.length === 0 ? ' · seluruh bobot jabatan genap 100%' : '')
  )
  if (skipped.length > 0) {
    console.warn(`  ! ${skipped.length} dilewati:`)
    skipped.forEach((s) => console.warn(`    - ${s}`))
  }
}
