// Memundurkan MASA BERLAKU rule ke masa lampau, supaya rule yang sudah ada
// ikut mengenai periode-periode yang sudah lewat.
//
// KENAPA INI ADA. Rule KPI di-seed dengan `effectiveFrom` 2026-08-01, sementara
// data KPI yang lengkap ada di Juli 2026. Engine menyaring rule dengan
// `berlaku_dari <= akhir_periode` (payroll-rules/loader.ts), jadi untuk periode
// Juli seluruh rule itu dibuang SEBELUM sempat dievaluasi — slip keluar tanpa
// bonus maupun potongan, tanpa satu baris pun penjelasan.
//
// YANG DIUBAH HANYA SATU KOLOM: `effectiveFrom`. Tier, SQL, guard, sasaran —
// tidak disentuh. Tanda tangan dihitung ulang karena masa berlaku ikut
// ditandatangani (signature.ts): mengubah tanggal tanpa menandatangani ulang
// akan membuat rule ditolak engine, yang justru memperburuk keadaan.
//
// HANYA VERSI TERTUA tiap ruleKey yang dimundurkan. Kalau sebuah rule punya
// beberapa versi, versi-versi itu membentuk rantai waktu yang tidak boleh
// beririsan — `crossVersionChecks` menandai ERROR pada KEDUA versi yang
// bertabrakan, dan akibatnya rule mati total, bukan cuma di bulan yang
// bermasalah. Memundurkan yang tertua saja memanjangkan rantai itu ke belakang
// tanpa merusak batas antar versi.
//
// Jalankan:
//   npx tsx prisma/scripts/backdate-payroll-rules.ts              # dry-run
//   npx tsx prisma/scripts/backdate-payroll-rules.ts --yes        # terapkan
//   npx tsx prisma/scripts/backdate-payroll-rules.ts --sejak=2026-01-01 --yes
//   npx tsx prisma/scripts/backdate-payroll-rules.ts --key=kpi_pvi_kepala_cabang --yes
import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { signRule, verifyRuleSignature } from '../../src/backend/payroll-rules/signature'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  connectionTimeoutMillis: 10_000,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

/**
 * Default `2020-01-01` — jauh sebelum PT ini punya data payroll apa pun,
 * sehingga praktis berarti "berlaku sejak kapan pun".
 *
 * Bukan tanggal 0 atau tahun 1970: tanggal yang masuk akal dibaca manusia
 * membuat halaman Rule tetap bisa dimengerti HR, sementara tahun 1970 terlihat
 * seperti bug.
 */
const SEJAK_DEFAULT = '2020-01-01'

function argValue(nama: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${nama}=`))
  return p?.split('=')[1]
}

function isoValid(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL belum diset — isi .env atau .env.local dulu.')
  }
  if (!process.env.PAYROLL_RULE_SIGNING_KEY) {
    throw new Error(
      'PAYROLL_RULE_SIGNING_KEY belum diset. Tanpa kunci itu rule tidak bisa ' +
        'ditandatangani ulang, dan rule dengan tanda tangan basi ditolak engine.'
    )
  }

  const sejak = argValue('sejak') ?? SEJAK_DEFAULT
  if (!isoValid(sejak)) {
    throw new Error(`--sejak harus format YYYY-MM-DD, dapat: "${sejak}"`)
  }
  const sejakDate = new Date(`${sejak}T00:00:00Z`)
  const hanyaKey = argValue('key')

  // Tidak semua rule pantas dimundurkan. `bonus_omzet_tim`, misalnya, sengaja
  // dimulai di masa depan — memundurkannya menerbitkan potongan Rp 200.000
  // untuk bulan-bulan yang sudah lewat, yang belum tentu diniatkan siapa pun.
  const kecuali = new Set(
    (argValue('kecuali') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )

  const { host } = new URL(process.env.DATABASE_URL)
  console.log(`Target database : ${host}`)
  console.log(`Mulai berlaku   : ${sejak}`)
  if (hanyaKey) console.log(`Dibatasi ke     : ${hanyaKey}`)
  console.log()

  const rows = await prisma.payrollRule.findMany({
    where: hanyaKey ? { ruleKey: hanyaKey } : undefined,
    orderBy: [{ ruleKey: 'asc' }, { version: 'asc' }],
    include: { tiers: { orderBy: { sortOrder: 'asc' } } },
  })

  if (rows.length === 0) {
    console.log(
      hanyaKey
        ? `Tidak ada rule dengan ruleKey "${hanyaKey}".`
        : 'Tidak ada rule sama sekali. Yang dibutuhkan mungkin justru seed-payroll-rules.ts.'
    )
    return
  }

  const signablePart = (row: (typeof rows)[number], effectiveFrom: Date) => ({
    ruleKey: row.ruleKey,
    version: row.version,
    effectiveFrom,
    effectiveTo: row.effectiveTo,
    mode: row.mode,
    sql: row.sql,
    tierField: row.tierField,
    constants: row.constants,
    guards: row.guards,
    defaults: row.defaults,
    targets: row.targets,
    excepts: row.excepts,
    tiers: row.tiers.map((t) => ({
      sortOrder: t.sortOrder,
      min: t.min,
      max: t.max,
      nominal: t.nominal,
      perUnit: t.perUnit,
      formula: t.formula,
      unitField: t.unitField,
      label: t.label,
      mandatorySaturday: t.mandatorySaturday,
      warningLetter: t.warningLetter,
    })),
  })

  // Tanda tangan diperiksa pada isi APA ADANYA lebih dulu. Rule yang sudah gagal
  // verifikasi sebelum disentuh berarti isinya pernah diubah di luar aplikasi —
  // menandatanganinya ulang di sini akan MERESTUI perubahan itu diam-diam.
  const sudahRusak = rows.filter((r) => !verifyRuleSignature(signablePart(r, r.effectiveFrom), r.signature))

  // Kelompokkan per ruleKey; hanya versi paling awal yang dimundurkan.
  const perKey = new Map<string, typeof rows>()
  for (const r of rows) perKey.set(r.ruleKey, [...(perKey.get(r.ruleKey) ?? []), r])

  const akanDiubah: { row: (typeof rows)[number]; dari: string }[] = []
  const dilewati: string[] = []

  for (const [key, versi] of perKey) {
    if (kecuali.has(key)) {
      dilewati.push(`${key} (dikecualikan lewat --kecuali)`)
      continue
    }

    const tertua = [...versi].sort(
      (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime() || a.version - b.version
    )[0]

    if (tertua.effectiveFrom.getTime() <= sejakDate.getTime()) {
      dilewati.push(`${key}@v${tertua.version} (sudah mulai ${isoDate(tertua.effectiveFrom)})`)
      continue
    }

    // Masa berlaku terbalik tidak akan pernah cocok dengan tanggal mana pun.
    if (tertua.effectiveTo && tertua.effectiveTo.getTime() < sejakDate.getTime()) {
      dilewati.push(
        `${key}@v${tertua.version} (DILEWATI: berlaku sampai ${isoDate(tertua.effectiveTo)}, ` +
          `lebih awal dari ${sejak} — periksa manual)`
      )
      continue
    }

    akanDiubah.push({ row: tertua, dari: isoDate(tertua.effectiveFrom) })
    for (const v of versi) {
      if (v.id !== tertua.id) {
        dilewati.push(`${key}@v${v.version} (versi lanjutan, mulai ${isoDate(v.effectiveFrom)})`)
      }
    }
  }

  console.log(`Total baris rule : ${rows.length}`)
  console.log(`Akan dimundurkan : ${akanDiubah.length}`)
  for (const { row, dari } of akanDiubah) {
    console.log(`  • ${row.ruleKey}@v${row.version}  ${dari} → ${sejak}`)
  }
  if (dilewati.length > 0) {
    console.log(`\nDibiarkan (${dilewati.length}):`)
    for (const d of dilewati) console.log(`  · ${d}`)
  }

  if (sudahRusak.length > 0) {
    console.log(
      `\nPERHATIAN: ${sudahRusak.length} rule SUDAH gagal verifikasi tanda tangan sebelum\n` +
        'script ini menyentuhnya:'
    )
    for (const r of sudahRusak) console.log(`  ! ${r.ruleKey}@v${r.version}`)
    console.log(
      'Itu tanda isinya pernah disunting langsung di database. Script ini akan\n' +
        'menandatangani ulang yang termasuk daftar "akan dimundurkan" di atas —\n' +
        'artinya suntingan tersebut ikut direstui. Periksa isinya dulu kalau ragu.'
    )
  }

  if (akanDiubah.length === 0) {
    console.log('\nTidak ada yang perlu diubah.')
    return
  }

  if (!process.argv.includes('--yes')) {
    console.log('\nDry-run. Tidak ada yang diubah. Jalankan ulang dengan --yes untuk menerapkan.')
    return
  }

  for (const { row, dari } of akanDiubah) {
    await prisma.payrollRule.update({
      where: { id: row.id },
      data: {
        effectiveFrom: sejakDate,
        signature: signRule(signablePart(row, sejakDate)),
        changeNote:
          `Masa berlaku dimundurkan dari ${dari} ke ${sejak} lewat ` +
          'backdate-payroll-rules.ts — isi rule tidak diubah.',
      },
    })
    console.log(`  ✓ ${row.ruleKey}@v${row.version}  ${dari} → ${sejak}`)
  }

  console.log(
    `\nSelesai. ${akanDiubah.length} rule dimundurkan.\n` +
      'Payroll periode lama TIDAK ikut berubah sendiri — jalankan ulang perhitungan\n' +
      'untuk periode yang bersangkutan supaya slipnya memakai rule ini.'
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
