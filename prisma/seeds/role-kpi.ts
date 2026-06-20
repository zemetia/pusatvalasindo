import type { PrismaClient } from '../../src/generated/prisma/client'

const ROLE_MAP: Record<string, string> = {
  'SALES/MARKETING': 'Sales & Compliance',
  'SALES/MARKETING(nadine dan vinny)': 'Sales & Compliance',
  'Teller Luar': 'Teller Luar',
  'Teller Dalam': 'Teller Dalam',
  'Kurir': 'Kurir',
  'TEAM LEADER MARKETING': 'Kepala Marketing',
  'Team leader pvi': 'Kepala Cabang',
  'Team leader PKD': 'Kepala Cabang'
}

const KPI_MAP: Record<string, string> = {
  'Jumlah Omzet': 'Jumlah Omzet',
  'Jumlah omzet team': 'Jumlah Omzet',
  'Tingkat Kesesuaian SOP': 'Kesesuaian SOP',
  'Tingkat complain tracking': 'Complain Nasabah',
  'COMPLAIN NASABAH': 'Complain Nasabah',
  'Laporan & Hasil Rekonsiliasi Tepat Waktu': 'Laporan & Rekonsiliasi Tepat Waktu',
  'Laporan Compliance Tepat Waktu(ltktltkm': 'Laporan Compliance Tepat Waktu',
  'Tingkat kepuasan nasabah': 'Kepuasan Nasabah',
  'Tingkat Kepuasan Pelanggan': 'Kepuasan Nasabah',
  'Tingkat Ketelitian Perhitungan': 'Ketelitian Perhitungan',
  'Tingkat Kebersihan': 'Kebersihan & Kerapihan Booth',
  'Closing Tepat Waktu': 'Closing Tepat Waktu',
  'Tingkat Kesesuaian Jumlah Kas': 'Kesesuaian Jumlah Kas',
  'Tingkat Ketepatan Waktu &Jumlah  Pengiriman': 'Ketepatan Waktu & Jumlah Pengiriman',
  'Laporan serah terima barang dikirimkan tepat waktu': 'Laporan Serah Terima Barang Tepat Waktu',
  'Net Profit Margin': 'Net Profit Margin',
  'Tingkat Ketersediaan Stok Mata Uang': 'Ketersediaan Stok Mata Uang',
  'kurs updating': 'Update Kurs',
  'TEAM MANAGEMENT': 'Team Management',
  'KEPATUHAN REGULASI SOP (pengawasan operasional': 'Kepatuhan Regulasi SOP',
  'RESIKO LIKUIDITAS': 'Resiko Likuiditas',
  'Tingkat Resiko Likuiditas': 'Resiko Likuiditas',
  'EFISIENSI PELAPORAN dan monitoring KURS': 'Efisiensi Pelaporan & Monitoring Kurs',
  'EFISIENSI PELAPORAN dan monitoring': 'Efisiensi Pelaporan & Monitoring',
}

const MAPPINGS = [
  { sheet: "pusat valas indo ", role: "SALES/MARKETING", kpi: "Jumlah Omzet", weight: 0.3 },
  { sheet: "pusat valas indo ", role: "SALES/MARKETING", kpi: "Tingkat complain tracking", weight: 0.15 },
  { sheet: "pusat valas indo ", role: "SALES/MARKETING", kpi: "Tingkat Kesesuaian SOP", weight: 0.2 },
  { sheet: "pusat valas indo ", role: "SALES/MARKETING", kpi: "Laporan & Hasil Rekonsiliasi Tepat Waktu", weight: 0.15 },
  { sheet: "pusat valas indo ", role: "SALES/MARKETING", kpi: "Laporan Compliance Tepat Waktu(ltktltkm", weight: 0.1 },
  { sheet: "pusat valas indo ", role: "SALES/MARKETING", kpi: "Tingkat kepuasan nasabah", weight: 0.1 },
  { sheet: "pusat valas indo ", role: "Teller Luar", kpi: "Jumlah Omzet", weight: 0.35 },
  { sheet: "pusat valas indo ", role: "Teller Luar", kpi: "Tingkat Ketelitian Perhitungan", weight: 0.1 },
  { sheet: "pusat valas indo ", role: "Teller Luar", kpi: "Tingkat Kesesuaian SOP", weight: 0.15 },
  { sheet: "pusat valas indo ", role: "Teller Luar", kpi: "Tingkat Kepuasan Pelanggan", weight: 0.3 },
  { sheet: "pusat valas indo ", role: "Teller Luar", kpi: "Tingkat Kebersihan", weight: 0.1 },
  { sheet: "pusat valas indo ", role: "Teller Dalam", kpi: "Closing Tepat Waktu", weight: 0.45 },
  { sheet: "pusat valas indo ", role: "Teller Dalam", kpi: "Tingkat Kesesuaian SOP", weight: 0.2 },
  { sheet: "pusat valas indo ", role: "Teller Dalam", kpi: "Tingkat Kesesuaian Jumlah Kas", weight: 0.35 },
  { sheet: "pusat valas indo ", role: "Kurir", kpi: "Tingkat Ketepatan Waktu &Jumlah  Pengiriman", weight: 0.7 },
  { sheet: "pusat valas indo ", role: "Kurir", kpi: "Laporan serah terima barang dikirimkan tepat waktu", weight: 0.2 },
  { sheet: "pusat valas indo ", role: "Kurir", kpi: "Tingkat Kesesuaian SOP", weight: 0.1 },
  { sheet: "pusat valas indo ", role: "TEAM LEADER MARKETING", kpi: "Net Profit Margin", weight: 0.4 },
  { sheet: "pusat valas indo ", role: "TEAM LEADER MARKETING", kpi: "Tingkat Ketersediaan Stok Mata Uang", weight: 0.2 },
  { sheet: "pusat valas indo ", role: "TEAM LEADER MARKETING", kpi: "COMPLAIN NASABAH", weight: 0.15 },
  { sheet: "pusat valas indo ", role: "TEAM LEADER MARKETING", kpi: "kurs updating", weight: 0.1 },
  { sheet: "pusat valas indo ", role: "TEAM LEADER MARKETING", kpi: "TEAM MANAGEMENT", weight: 0.1 },
  { sheet: "pusat valas indo ", role: "Team leader pvi", kpi: "Jumlah omzet team", weight: 0.4 },
  { sheet: "pusat valas indo ", role: "Team leader pvi", kpi: "KEPATUHAN REGULASI SOP (pengawasan operasional", weight: 0.25 },
  { sheet: "pusat valas indo ", role: "Team leader pvi", kpi: "RESIKO LIKUIDITAS", weight: 0.2 },
  { sheet: "pusat valas indo ", role: "Team leader pvi", kpi: "EFISIENSI PELAPORAN dan monitoring KURS", weight: 0.15 },
  { sheet: "pusat valas indo ", role: "Team leader pvi", kpi: "TEAM MANAGEMENT", weight: 0.1 },
  { sheet: "PUSAT TUKAR UANG", role: "Teller Luar", kpi: "Jumlah Omzet", weight: 0.35 },
  { sheet: "PUSAT TUKAR UANG", role: "Teller Luar", kpi: "Tingkat Ketelitian Perhitungan", weight: 0.1 },
  { sheet: "PUSAT TUKAR UANG", role: "Teller Luar", kpi: "Tingkat Kesesuaian SOP", weight: 0.15 },
  { sheet: "PUSAT TUKAR UANG", role: "Teller Luar", kpi: "Tingkat Kepuasan Pelanggan", weight: 0.3 },
  { sheet: "PUSAT TUKAR UANG", role: "Teller Luar", kpi: "Tingkat Kebersihan", weight: 0.1 },
  { sheet: "PUSAT TUKAR UANG", role: "Teller Dalam", kpi: "Closing Tepat Waktu", weight: 0.45 },
  { sheet: "PUSAT TUKAR UANG", role: "Teller Dalam", kpi: "Tingkat Kesesuaian SOP", weight: 0.2 },
  { sheet: "PUSAT TUKAR UANG", role: "Teller Dalam", kpi: "Tingkat Kesesuaian Jumlah Kas", weight: 0.35 },
  { sheet: "PUSAT TUKAR UANG", role: "Kurir", kpi: "Tingkat Ketepatan Waktu &Jumlah  Pengiriman", weight: 0.7 },
  { sheet: "PUSAT TUKAR UANG", role: "Kurir", kpi: "Laporan serah terima barang dikirimkan tepat waktu", weight: 0.2 },
  { sheet: "PUSAT TUKAR UANG", role: "Kurir", kpi: "Tingkat Kesesuaian SOP", weight: 0.1 },
  { sheet: "PUSAT TUKAR UANG", role: "TEAM LEADER MARKETING", kpi: "Net Profit Margin", weight: 0.4 },
  { sheet: "PUSAT TUKAR UANG", role: "TEAM LEADER MARKETING", kpi: "Tingkat Ketersediaan Stok Mata Uang", weight: 0.25 },
  { sheet: "PUSAT TUKAR UANG", role: "Team leader pvi", kpi: "Jumlah omzet team", weight: 0.4 },
  { sheet: "PUSAT TUKAR UANG", role: "Team leader pvi", kpi: "KEPATUHAN REGULASI SOP (pengawasan operasional", weight: 0.25 },
  { sheet: "PUSAT TUKAR UANG", role: "Team leader pvi", kpi: "COMPLAIN NASABAH", weight: 0.2 },
  { sheet: "PUSAT TUKAR UANG", role: "Team leader pvi", kpi: "EFISIENSI PELAPORAN dan monitoring", weight: 0.15 },
  { sheet: "PUSAT TUKAR UANG", role: "Team leader pvi", kpi: "TEAM MANAGEMENT", weight: 0.1 },
  { sheet: "PUSAT KIRIM DUIT ", role: "SALES/MARKETING(nadine dan vinny)", kpi: "Jumlah Omzet", weight: 0.3 },
  { sheet: "PUSAT KIRIM DUIT ", role: "SALES/MARKETING(nadine dan vinny)", kpi: "Tingkat complain tracking", weight: 0.15 },
  { sheet: "PUSAT KIRIM DUIT ", role: "SALES/MARKETING(nadine dan vinny)", kpi: "Tingkat Kesesuaian SOP", weight: 0.2 },
  { sheet: "PUSAT KIRIM DUIT ", role: "SALES/MARKETING(nadine dan vinny)", kpi: "Laporan & Hasil Rekonsiliasi Tepat Waktu", weight: 0.15 },
  { sheet: "PUSAT KIRIM DUIT ", role: "SALES/MARKETING(nadine dan vinny)", kpi: "Laporan Compliance Tepat Waktu(ltktltkm", weight: 0.1 },
  { sheet: "PUSAT KIRIM DUIT ", role: "SALES/MARKETING(nadine dan vinny)", kpi: "Tingkat kepuasan nasabah", weight: 0.1 },
  { sheet: "PUSAT KIRIM DUIT ", role: "Team leader PKD", kpi: "Jumlah omzet team", weight: 0.4 },
  { sheet: "PUSAT KIRIM DUIT ", role: "Team leader PKD", kpi: "KEPATUHAN REGULASI SOP (pengawasan operasional", weight: 0.25 },
  { sheet: "PUSAT KIRIM DUIT ", role: "Team leader PKD", kpi: "COMPLAIN NASABAH", weight: 0.2 },
  { sheet: "PUSAT KIRIM DUIT ", role: "Team leader PKD", kpi: "EFISIENSI PELAPORAN dan monitoring", weight: 0.15 }
]

const SHEET_TO_COMPANY: Record<string, string> = {
  "pusat valas indo ": "PVI",
  "PUSAT TUKAR UANG": "PTU",
  "PUSAT KIRIM DUIT ": "PKD"
}

export async function seedRoleKpis(
  prisma: PrismaClient,
  companyIds: Record<string, string>
) {
  console.log('🌱 Seeding Role-KPI mappings from Excel translation...')

  // Get all custom roles and KPI definitions to map them
  const roles = await prisma.custom_role.findMany()
  const kpiDefs = await prisma.kpiDefinition.findMany()

  const roleLookup = new Map<string, string>() // `${companyId}_${roleName}` -> roleId
  roles.forEach(r => {
    roleLookup.set(`${r.companyId}_${r.name}`, r.id)
  })

  const kpiLookup = new Map<string, string>() // kpiName -> kpiId
  kpiDefs.forEach(k => {
    kpiLookup.set(k.name, k.id)
  })

  let count = 0
  for (const m of MAPPINGS) {
    const companyCode = SHEET_TO_COMPANY[m.sheet]
    const companyId = companyIds[companyCode]
    const targetRoleName = ROLE_MAP[m.role]
    const targetKpiName = KPI_MAP[m.kpi]

    const roleId = roleLookup.get(`${companyId}_${targetRoleName}`)
    const kpiId = kpiLookup.get(targetKpiName)

    if (roleId && kpiId) {
      await prisma.roleKpi.upsert({
        where: {
          companyId_customRoleId_kpiId: {
            companyId: companyId,
            customRoleId: roleId,
            kpiId: kpiId
          }
        },
        update: {
          weight: m.weight,
          maxScore: m.weight
        },
        create: {
          companyId: companyId,
          customRoleId: roleId,
          kpiId: kpiId,
          weight: m.weight,
          maxScore: m.weight
        }
      })
      count++
    }
  }

  console.log(`  ✓ ${count} Role-KPI mappings seeded`)
}
