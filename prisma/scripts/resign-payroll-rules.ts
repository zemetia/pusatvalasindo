// Menandatangani ULANG seluruh PayrollRule dengan PAYROLL_RULE_SIGNING_KEY
// yang sedang aktif.
//
// KAPAN INI DIPAKAI — hanya satu keadaan: kunci penandatangan hilang atau
// diganti, sehingga SELURUH rule serentak gagal verifikasi dan payroll berjalan
// tanpa satu pun bonus/denda. Gejalanya khas: semua rule bermasalah sekaligus,
// bukan satu-dua.
//
// KAPAN JANGAN DIPAKAI: kalau hanya SEBAGIAN rule yang gagal verifikasi. Itu
// bukan masalah kunci — itu tanda baris rule benar-benar disunting di luar
// aplikasi, dan justru itulah yang ingin ditangkap tanda tangan. Menjalankan
// script ini akan MERESTUI suntingan tersebut tanpa ada yang memeriksanya.
//
// Script ini tidak mengubah isi rule sama sekali; ia hanya menghitung ulang
// kolom `signature` dari isi yang sudah ada.
//
// Jalankan: npx tsx prisma/scripts/resign-payroll-rules.ts --yes
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

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL belum diset — isi .env atau .env.local dulu.')
  }
  if (!process.env.PAYROLL_RULE_SIGNING_KEY) {
    throw new Error(
      'PAYROLL_RULE_SIGNING_KEY belum diset. Set kunci itu DULU (dan simpan di ' +
        '.env), baru jalankan script ini — kalau tidak, rule akan ditandatangani ' +
        'ulang dengan kunci yang besok hilang lagi.'
    )
  }

  const { host } = new URL(process.env.DATABASE_URL)
  console.log(`Target database: ${host}\n`)

  const rows = await prisma.payrollRule.findMany({
    orderBy: [{ ruleKey: 'asc' }, { version: 'asc' }],
    include: { tiers: { orderBy: { sortOrder: 'asc' } } },
  })

  if (rows.length === 0) {
    console.log('Tidak ada rule sama sekali. Mungkin yang dibutuhkan justru seed-payroll-rules.ts.')
    return
  }

  const signablePart = (row: (typeof rows)[number]) => ({
    ruleKey: row.ruleKey,
    version: row.version,
    effectiveFrom: row.effectiveFrom,
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

  const rusak = rows.filter((r) => !verifyRuleSignature(signablePart(r), r.signature))

  console.log(`Total rule    : ${rows.length}`)
  console.log(`Gagal verifikasi: ${rusak.length}`)
  for (const r of rusak) console.log(`  • ${r.ruleKey}@v${r.version}`)
  console.log()

  if (rusak.length === 0) {
    console.log('Semua tanda tangan sudah cocok dengan kunci saat ini — tidak ada yang perlu diubah.')
    return
  }

  // Peringatan ini bukan basa-basi. Kalau hanya sebagian yang gagal, sebabnya
  // hampir pasti suntingan langsung ke database, bukan kunci yang hilang.
  if (rusak.length < rows.length) {
    console.log(
      'PERHATIAN: hanya SEBAGIAN rule yang gagal verifikasi. Pola ini TIDAK cocok\n' +
        'dengan kunci yang hilang — lebih mungkin baris rule di atas disunting di luar\n' +
        'aplikasi. Periksa isinya lebih dulu; menandatangani ulang akan merestuinya.\n'
    )
  }

  if (!process.argv.includes('--yes')) {
    console.log(
      'Dry-run. Tidak ada yang diubah.\n' +
        'Jalankan ulang dengan --yes kalau isi rule di atas memang sudah benar.'
    )
    return
  }

  for (const r of rusak) {
    await prisma.payrollRule.update({
      where: { id: r.id },
      data: { signature: signRule(signablePart(r)) },
    })
    console.log(`  ✓ ditandatangani ulang: ${r.ruleKey}@v${r.version}`)
  }

  console.log(`\nSelesai. ${rusak.length} rule ditandatangani ulang.`)
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
