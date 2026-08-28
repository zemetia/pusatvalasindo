// Uji end-to-end kolektor absensi terhadap database lokal: menyisipkan absensi
// contoh, menarik KPI, menghitung skor, memeriksa idempotensi, lalu
// membersihkan data ujinya kembali.
//
// Jalankan: npx tsx prisma/scripts/verify-kpi-collector.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import {
  collectClosingPunctuality,
  type AttendanceRecord,
} from '../../src/lib/kpi-collectors'
import { scoreKpiItem, computeTotalScore } from '../../src/lib/kpi-scoring'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const MONTH = 7
const YEAR = 2026

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'teller.dalam.cengkareng@pvi.local' },
    select: {
      id: true,
      name: true,
      branchId: true,
      customRoleId: true,
      customRole: { select: { name: true } },
      branch: { select: { companyId: true } },
    },
  })
  if (!user?.customRoleId || !user.branch?.companyId) {
    throw new Error('Teller Dalam Cengkareng tidak ditemukan / belum punya jabatan')
  }
  console.log(`Karyawan : ${user.name} (${user.customRole?.name})`)

  // Tanggal shift disimpan sebagai @db.Date dalam UTC (konvensi proyek).
  const day = (d: number) => new Date(Date.UTC(YEAR, MONTH - 1, d))
  const nextMorning = (d: number, h: number, m: number) => new Date(YEAR, MONTH - 1, d + 1, h, m)

  const rows = [
    { d: 3, checkOut: nextMorning(3, 6, 0), label: 'closing 06.00 — masih dalam toleransi' },
    { d: 4, checkOut: nextMorning(4, 7, 0), label: 'closing 07.00 — lewat 45 menit' },
    { d: 5, checkOut: nextMorning(5, 8, 30), label: 'closing 08.30 — lewat 135 menit' },
    { d: 6, checkOut: null, label: 'lupa absen pulang' },
  ]

  for (const r of rows) {
    await prisma.attendance.upsert({
      where: { userId_date: { userId: user.id, date: day(r.d) } },
      create: {
        userId: user.id,
        branchId: user.branchId,
        date: day(r.d),
        checkIn: new Date(YEAR, MONTH - 1, r.d, 17, 30),
        checkOut: r.checkOut,
        status: 'PRESENT',
      },
      update: { checkOut: r.checkOut, status: 'PRESENT' },
    })
  }
  console.log(`\nAbsensi contoh (${rows.length} hari):`)
  rows.forEach((r) => console.log(`  ${r.d} Jul — ${r.label}`))

  // ── Ambil konfigurasi KPI closing milik jabatan ini ──
  const roleKpi = await prisma.roleKpi.findFirst({
    where: {
      companyId: user.branch.companyId,
      customRoleId: user.customRoleId,
      definition: { systemSourceKey: 'ATTENDANCE_CLOSING' },
    },
    include: { definition: true },
  })
  if (!roleKpi) throw new Error('KPI closing tidak terpasang untuk jabatan ini')

  console.log(
    `\nKonfigurasi : batas ${JSON.stringify(roleKpi.systemConfig)} · ` +
      `${roleKpi.pointPerUnit} poin/pelanggaran dari ${roleKpi.basePoint} · bobot ${Number(roleKpi.weight) * 100}%`
  )

  const attendances = await prisma.attendance.findMany({
    where: {
      userId: user.id,
      date: { gte: new Date(Date.UTC(YEAR, MONTH - 1, 1)), lt: new Date(Date.UTC(YEAR, MONTH, 1)) },
    },
    orderBy: { date: 'asc' },
  })

  const records: AttendanceRecord[] = attendances.map((a) => ({
    date: a.date,
    status: a.status,
    checkIn: a.checkIn,
    checkOut: a.checkOut,
    isWithDoctorNote: a.isWithDoctorNote,
  }))

  const output = collectClosingPunctuality(
    records,
    roleKpi.systemConfig as { deadline: string; graceMinutes: number }
  )

  console.log(`\nHasil kolektor : ${output.entries.length} pelanggaran, ${output.skipped.length} dilewati`)
  output.entries.forEach((e) => console.log(`  + ${e.note}`))
  output.skipped.forEach((s) => console.log(`  ~ ${s.date.toISOString().slice(0, 10)} — ${s.reason}`))

  const score = scoreKpiItem(
    {
      scoringType: roleKpi.definition.scoringType,
      direction: roleKpi.definition.direction,
      weight: Number(roleKpi.weight),
      targetValue: null,
      basePoint: Number(roleKpi.basePoint),
      pointPerUnit: Number(roleKpi.pointPerUnit),
      toleranceLimit: null,
      toleranceScope: null,
      maxAchievement: roleKpi.maxAchievement == null ? null : Number(roleKpi.maxAchievement),
    },
    output.entries.map((e) => ({
      occurredAt: e.occurredAt.toISOString().slice(0, 10),
      weekOfMonth: Math.floor((e.occurredAt.getDate() - 1) / 7) + 1,
      quantity: e.quantity,
    }))
  )

  console.log(`\nPenilaian KPI closing:`)
  console.log(`  ${score.explanation}`)
  console.log(`  pencapaian ${(score.achievement * 100).toFixed(1)}%`)

  const total = computeTotalScore([
    {
      ...score,
      roleKpiId: roleKpi.id,
      kpiId: roleKpi.definition.id,
      kpiCode: roleKpi.definition.code,
      kpiName: roleKpi.definition.name,
      scoringType: roleKpi.definition.scoringType,
      unit: roleKpi.definition.unit,
      weight: Number(roleKpi.weight),
      inputSource: 'SYSTEM',
    },
  ])
  console.log(`  kontribusi ke skor bulanan: ${(total.totalScore * 100).toFixed(1)}%`)

  // ── Bersihkan ──
  await prisma.attendance.deleteMany({
    where: {
      userId: user.id,
      date: { gte: new Date(Date.UTC(YEAR, MONTH - 1, 1)), lt: new Date(Date.UTC(YEAR, MONTH, 1)) },
    },
  })
  console.log('\nData uji dibersihkan.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
