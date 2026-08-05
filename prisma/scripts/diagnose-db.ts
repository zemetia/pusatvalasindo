// Diagnosa keadaan database — HANYA MEMBACA, tidak menulis apa pun.
//
// Dibuat karena `psql` tidak selalu terpasang (di Windows biasanya tidak),
// sementara saat production bermasalah yang dibutuhkan justru jawaban cepat
// atas tiga hal: database ini yang mana, migrasi mana yang sudah/gagal masuk,
// dan apakah kolom yang dibutuhkan auth sudah ada.
//
// Jalankan: npx tsx prisma/scripts/diagnose-db.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import pg from 'pg'

// Kolom yang ditambahkan migrasi 20260805020000. Better Auth membaca session
// lewat Prisma, dan Prisma menyusun SELECT berisi SELURUH kolom skalar model
// `user` — jadi satu saja dari ketiganya hilang, seluruh login mati dengan
// pesan generik "Failed to get session".
const KOLOM_AUTH_BARU = ['employmentStatus', 'contractStartDate', 'contractEndDate']

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL belum diset — isi .env atau .env.local dulu.')

  const { host, pathname } = new URL(url)
  console.log(`Target: ${host}${pathname}\n`)

  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 })
  await client.connect()

  try {
    // ── 1. Kolom yang dibutuhkan auth ────────────────────────────────────────
    const kolom = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'user' AND column_name = ANY($1)`,
      [KOLOM_AUTH_BARU]
    )
    const ada = new Set(kolom.rows.map((r) => r.column_name))
    console.log('── Kolom auth (migrasi 20260805020000) ──')
    for (const k of KOLOM_AUTH_BARU) {
      console.log(`  ${ada.has(k) ? '✓' : '✗ HILANG'}  user.${k}`)
    }
    if (ada.size < KOLOM_AUTH_BARU.length) {
      console.log('  → Inilah yang mematikan login: migrasi belum masuk ke database ini.')
    }

    // ── 2. Isi tabel inti ────────────────────────────────────────────────────
    // Kalau ini nol, database sempat ter-reset dan urusannya bukan lagi
    // migrasi melainkan restore backup.
    const isi = await client.query(
      `SELECT (SELECT count(*) FROM "user")     AS users,
              (SELECT count(*) FROM custom_role) AS roles,
              (SELECT count(*) FROM session)     AS sessions`
    )
    console.log('\n── Isi tabel inti ──')
    console.table(isi.rows[0])

    // ── 3. Riwayat migrasi ───────────────────────────────────────────────────
    const punyaTabel = await client.query<{ ada: boolean }>(
      `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS ada`
    )
    if (!punyaTabel.rows[0].ada) {
      console.log('\n⚠ Tabel _prisma_migrations tidak ada — database ini belum pernah dimigrasi Prisma sama sekali.')
      return
    }

    // `finished_at IS NULL` = migrasi mulai tapi tidak pernah selesai. Inilah
    // yang membuat `migrate deploy` berikutnya menolak jalan.
    const gagal = await client.query<{ migration_name: string; started_at: Date; applied_steps_count: number }>(
      `SELECT migration_name, started_at, applied_steps_count
       FROM _prisma_migrations
       WHERE finished_at IS NULL AND rolled_back_at IS NULL
       ORDER BY started_at`
    )
    console.log('\n── Migrasi yang GAGAL di tengah ──')
    if (gagal.rowCount === 0) console.log('  (tidak ada)')
    else console.table(gagal.rows)

    const terakhir = await client.query(
      `SELECT migration_name, finished_at
       FROM _prisma_migrations
       WHERE finished_at IS NOT NULL
       ORDER BY finished_at DESC LIMIT 10`
    )
    console.log('\n── 10 migrasi terakhir yang berhasil ──')
    console.table(terakhir.rows)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('\n✗', e instanceof Error ? e.message : e)
  process.exitCode = 1
})
