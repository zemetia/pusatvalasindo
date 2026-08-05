// ═══════════════════════════════════════════════════════════════════════════
// Membuat / menyegarkan user read-only `oc_pvi_reader` — pemilik koneksi
// DATABASE_VIEW_ONLY_URL yang dipakai engine rule slip gaji.
//
// Bedanya dengan sql/apply_openclaw.ts: skrip itu ikut membuat ulang seluruh
// view hv_* dan mengarang password acak yang harus disalin manual. Yang ini
// hanya mengurus user + grant, dan memakai password dari DATABASE_VIEW_ONLY_URL
// di .env — jadi .env dan database tidak bisa berbeda.
//
// Jalankan: npx tsx --env-file=.env sql/create-reader.ts
// Aman diulang.
// ═══════════════════════════════════════════════════════════════════════════
import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL belum diset di .env");

const VIEW_ONLY_URL = process.env.DATABASE_VIEW_ONLY_URL;
if (!VIEW_ONLY_URL) throw new Error("DATABASE_VIEW_ONLY_URL belum diset di .env");

const viewOnly = new URL(VIEW_ONLY_URL);
const USER = decodeURIComponent(viewOnly.username);
const PASSWORD = decodeURIComponent(viewOnly.password);
if (!USER || !PASSWORD) {
  throw new Error("DATABASE_VIEW_ONLY_URL harus memuat user dan password");
}

// Nama user dipakai sebagai identifier SQL, password sebagai literal. Keduanya
// dikutip manual karena CREATE/ALTER USER tidak menerima parameter bind.
const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`;
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [USER]);
  if (exists.rowCount) {
    await client.query(`ALTER USER ${q(USER)} WITH PASSWORD ${lit(PASSWORD)}`);
    console.log(`✓ ${USER} sudah ada — password disamakan dengan .env`);
  } else {
    await client.query(`CREATE USER ${q(USER)} WITH PASSWORD ${lit(PASSWORD)}`);
    console.log(`✓ ${USER} dibuat`);
  }

  const dbName = new URL(DATABASE_URL!).pathname.replace("/", "");
  await client.query(`GRANT CONNECT ON DATABASE ${q(dbName)} TO ${q(USER)}`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${q(USER)}`);

  // Daftar view diambil dari database, bukan dari daftar hardcoded — supaya
  // view hv_* yang lahir dari migrasi baru tidak perlu didaftarkan dua kali.
  const views = await client.query<{ viewname: string }>(
    `SELECT viewname FROM pg_views
      WHERE schemaname = 'public' AND viewname LIKE 'hv\\_%'
      ORDER BY viewname`
  );
  for (const { viewname } of views.rows) {
    await client.query(`GRANT SELECT ON ${q(viewname)} TO ${q(USER)}`);
  }
  console.log(`✓ GRANT SELECT pada ${views.rowCount} view hv_*`);

  // Sabuk pengaman: rule tidak boleh bisa membaca data auth walau ada grant
  // warisan dari PUBLIC.
  for (const t of ["user", "account", "session", "verification"]) {
    await client.query(`REVOKE ALL ON ${q(t)} FROM ${q(USER)}`);
  }
  console.log("✓ akses tabel auth dicabut");

  await client.end();
  console.log("\nSelesai. DATABASE_VIEW_ONLY_URL di .env siap dipakai.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
