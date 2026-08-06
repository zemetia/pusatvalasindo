// Tanggal merah — hari libur nasional & cuti bersama.
//
// INI BAGIAN DARI PERHITUNGAN UANG, BUKAN HIASAN KALENDER. Alpha diturunkan
// dari ketiadaan baris presensi (lihat src/lib/workday.ts), jadi setiap tanggal
// merah yang TIDAK ada di tabel ini akan dibaca sebagai hari kerja yang dibolos
// dan dipotong 2× upah harian dari gaji orang yang memang sedang libur.
//
// Yang ditulis di sini HANYA hari libur bertanggal tetap, yang tidak bergantung
// pada kalender Hijriah/Imlek/Saka dan karenanya bisa dipastikan tanpa merujuk
// SKB 3 Menteri. Sisanya — Isra Miraj, Imlek, Nyepi, Wafat Isa Almasih, Idul
// Fitri beserta cuti bersamanya, Waisak, Kenaikan Isa Almasih, Idul Adha, Tahun
// Baru Islam, Maulid Nabi — TANGGALNYA BERUBAH TIAP TAHUN dan sengaja tidak
// ditebak di sini; HR yang mengisinya dari SKB 3 Menteri tahun berjalan.
//
// Seeder ini aman dijalankan berulang: baris yang tanggalnya sudah ada tidak
// ditimpa namanya, jadi koreksi manual HR tidak hilang.

import type { PrismaClient } from '../../src/generated/prisma/client'

type HolidaySeed = { date: string; name: string; isJointLeave?: boolean }

/** Hari libur bertanggal tetap, berlaku setiap tahun. */
const TANGGAL_TETAP: { month: number; day: number; name: string }[] = [
  { month: 1, day: 1, name: 'Tahun Baru Masehi' },
  { month: 5, day: 1, name: 'Hari Buruh Internasional' },
  { month: 6, day: 1, name: 'Hari Lahir Pancasila' },
  { month: 8, day: 17, name: 'Hari Kemerdekaan RI' },
  { month: 12, day: 25, name: 'Hari Raya Natal' },
]

/** Tahun yang diisi otomatis oleh seeder. */
const TAHUN = [2026, 2027]

function fixedHolidays(): HolidaySeed[] {
  return TAHUN.flatMap((year) =>
    TANGGAL_TETAP.map((h) => ({
      date: `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
      name: h.name,
    }))
  )
}

export async function seedPublicHolidays(prisma: PrismaClient) {
  const rows = fixedHolidays()
  let dibuat = 0

  for (const h of rows) {
    const date = new Date(`${h.date}T00:00:00Z`)
    const existing = await prisma.publicHoliday.findUnique({ where: { date } })
    if (existing) continue
    await prisma.publicHoliday.create({
      data: { date, name: h.name, isJointLeave: h.isJointLeave ?? false },
    })
    dibuat++
  }

  console.log(
    `   ${dibuat} tanggal merah baru ditambahkan (${rows.length} tanggal tetap diperiksa).\n` +
      '   ⚠  Hari libur yang tanggalnya berpindah tiap tahun (Idul Fitri, Nyepi, Waisak,\n' +
      '      Imlek, Maulid, cuti bersama, dst.) BELUM terisi — tanpa itu, hari libur\n' +
      '      tersebut akan dihitung alpha dan dipotong dari gaji.'
  )
}
