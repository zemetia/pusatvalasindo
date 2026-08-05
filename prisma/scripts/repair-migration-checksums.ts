// Selaraskan kembali checksum migrasi yang disunting setelah terlanjur jalan.
//
// Prisma menyimpan sha256 isi tiap `migration.sql` di `_prisma_migrations`.
// Menyunting migrasi yang sudah applied membuat checksum tidak cocok, dan
// `prisma migrate dev` menolak jalan sampai databasenya di-reset.
//
// Riwayat migrasi sengaja dirapikan (DDL matriks insentif lama dibuang dari
// migrasi 20260728020000, 20260804000000, dan 20260805020000). Suntingan itu
// TIDAK mengubah bentuk akhir schema — tabel yang dihapus memang dibuat lalu
// dihancurkan lagi di rentetan migrasi yang sama — jadi database yang sudah
// applied tetap benar apa adanya. Yang perlu diperbaiki hanya catatan
// checksum-nya, bukan datanya.
//
// Script ini HANYA memperbarui checksum untuk migrasi yang sudah tercatat
// applied. Ia tidak pernah menjalankan SQL apa pun dari file migrasi, tidak
// menyisipkan baris baru, dan tidak menyentuh migrasi yang belum jalan —
// migrasi baru tetap harus lewat `prisma migrate deploy`.
//
// Jalankan sekali per database yang sudah ada, SEBELUM `prisma migrate deploy`:
//   npx tsx prisma/scripts/repair-migration-checksums.ts
//
// Untuk database baru (belum pernah dimigrasi) script ini tidak diperlukan.
import { config } from 'dotenv'
config({ path: '.env.local' })
config()

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations')

function checksumOf(dir: string): string {
  // Persis cara Prisma menghitungnya: sha256 atas byte mentah file, hex.
  const sql = readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'))
  return createHash('sha256').update(sql).digest('hex')
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  try {
    const exists = await pool.query<{ ok: boolean }>(
      `SELECT to_regclass('_prisma_migrations') IS NOT NULL AS ok`
    )
    if (!exists.rows[0]?.ok) {
      console.log('Tabel _prisma_migrations belum ada — database ini belum pernah dimigrasi, tidak ada yang perlu diperbaiki.')
      return
    }

    const dirs = readdirSync(MIGRATIONS_DIR).filter((d) =>
      statSync(join(MIGRATIONS_DIR, d)).isDirectory()
    )

    let fixed = 0
    for (const dir of dirs) {
      const expected = checksumOf(dir)
      // finished_at IS NOT NULL = migrasi benar-benar selesai jalan. Migrasi
      // yang gagal di tengah jangan disentuh: checksum-nya bukan masalahnya.
      const res = await pool.query(
        `UPDATE "_prisma_migrations"
            SET checksum = $2
          WHERE migration_name = $1
            AND finished_at IS NOT NULL
            AND checksum <> $2`,
        [dir, expected]
      )
      if (res.rowCount) {
        console.log(`  diperbarui  ${dir}`)
        fixed += res.rowCount
      }
    }

    console.log(
      fixed === 0
        ? 'Semua checksum sudah cocok — tidak ada yang diubah.'
        : `${fixed} checksum diselaraskan. Lanjutkan dengan: npx prisma migrate deploy`
    )
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
