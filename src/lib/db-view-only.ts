// ═══════════════════════════════════════════════════════════════════════════
// Koneksi read-only untuk query rule slip gaji.
//
// Rule memuat SQL mentah. Yang membuat itu aman BUKAN validator di aplikasi,
// melainkan koneksi ini: user database `oc_pvi_reader` hanya punya SELECT atas
// view `hv_*` (lihat sql/openclaw_setup.sql). Rule paling jahat sekalipun
// tidak bisa menulis apa pun, dan tidak bisa menyentuh tabel auth.
//
// Karena itu engine TIDAK BOLEH jatuh balik ke koneksi Prisma kalau env ini
// kosong. Fallback diam-diam akan menjalankan SQL rule dengan hak penuh —
// tepat kondisi yang ingin dicegah. Lebih baik rule gagal dengan pesan jelas.
// ═══════════════════════════════════════════════════════════════════════════

import { Pool, types as pgTypes } from "pg";

// ── Tipe kolom yang dikembalikan ke rule ───────────────────────────────────
//
// Default node-postgres tidak cocok untuk query yang ditulis manusia:
//   • DATE  → Date di zona waktu LOKAL proses. Rule membandingkan dan
//     menampilkan tanggal; Date lokal membuat hasilnya bergantung pada TZ
//     server, dan itu persis kelas kesalahan yang tidak menimbulkan error.
//   • int8 (COUNT) dan numeric (SUM) → string, supaya presisi tidak hilang.
//     Untuk rule gaji nilainya selalu jauh di bawah batas presisi `Number`,
//     sementara string membuat `inputs` di slip terbaca aneh ("24" bukan 24).
//
// Parser dipasang PER-POOL, bukan lewat `pgTypes.setTypeParser` global —
// mengubah parser global akan ikut memengaruhi koneksi lain di proses ini.
const OID_INT8 = 20;
const OID_NUMERIC = 1700;
const OID_DATE = 1082;

const viewOnlyTypes = {
  getTypeParser: ((oid: number, format?: unknown) => {
    if (oid === OID_DATE) return (v: string) => v; // 'YYYY-MM-DD' apa adanya
    if (oid === OID_INT8 || oid === OID_NUMERIC) {
      return (v: string) => (v === null ? null : Number(v));
    }
    return (pgTypes.getTypeParser as (o: number, f?: unknown) => unknown)(oid, format);
  }) as unknown as typeof pgTypes.getTypeParser,
};

export class ViewOnlyNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_VIEW_ONLY_URL belum diset. Query rule gaji hanya boleh " +
        "dijalankan lewat koneksi read-only ke view hv_* — engine menolak " +
        "menjalankannya lewat koneksi aplikasi."
    );
  }
}

/**
 * Pool disimpan di global supaya hot-reload dev tidak membuka koneksi baru
 * tiap kali modul dimuat ulang — pola yang sama dengan lib/prisma.ts.
 */
const globalForViewOnly = globalThis as unknown as { viewOnlyPool?: Pool };

export function isViewOnlyConfigured(): boolean {
  return Boolean(process.env.DATABASE_VIEW_ONLY_URL);
}

function getPool(): Pool {
  const url = process.env.DATABASE_VIEW_ONLY_URL;
  if (!url) throw new ViewOnlyNotConfiguredError();

  if (!globalForViewOnly.viewOnlyPool) {
    globalForViewOnly.viewOnlyPool = new Pool({
      connectionString: url,
      // Payroll dijalankan per karyawan, bukan berbondong-bondong — kolam kecil
      // sudah cukup dan menahan satu rule yang lambat agar tidak menghabiskan
      // koneksi database untuk seluruh aplikasi.
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      types: viewOnlyTypes,
      // Rule ditulis manusia. Satu query tanpa batas yang tidak sengaja
      // memindai seluruh riwayat akan menggantung proses payroll; 15 detik
      // jauh di atas kebutuhan wajar query bulanan per karyawan.
      statement_timeout: 15_000,
    });
  }
  return globalForViewOnly.viewOnlyPool;
}

/** Jalankan SELECT lewat koneksi read-only. Baris dikembalikan apa adanya. */
export async function queryViewOnly<T extends Record<string, unknown>>(
  text: string,
  values: unknown[]
): Promise<T[]> {
  const result = await getPool().query(text, values);
  return result.rows as T[];
}
