/**
 * Verifikasi runtime tiga perubahan hari ini, ditembak ke server dev yang jalan.
 *   1. /api/bank-mutations + halaman Mutasi sudah hilang
 *   2. Modul KPI pindah ke matriks izin (jalur legacy KPI_APPROVE tidak berlaku)
 *   3. currency & currency.price global, currency.stock tetap per PT
 *
 * Jalankan: npx tsx scratch/verify-changes.ts http://localhost:3001
 */
import "dotenv/config";

const BASE = process.argv[2] ?? "http://localhost:3001";
const PASSWORD = "password123";
const BANK_PVI = "cms4rb11k009xhwvkywpftpip";

const ACTORS = {
  owner: { email: "owner@pvi.com", ip: "10.20.0.1", label: "OWNER (global)" },
  kacab: {
    email: "kepala.cengkareng@pvi.local",
    ip: "10.20.0.2",
    label: "Kepala Cabang PVI (legacy: kpi.approve + kpi.manage)",
  },
  teller: {
    email: "teller.dalam.cengkareng@pvi.local",
    ip: "10.20.0.3",
    label: "Teller Dalam PVI (legacy: kpi.fill_own)",
  },
} as const;

type ActorKey = keyof typeof ACTORS;

const jar: Record<string, string> = {};
const ids: Record<string, string> = {};

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, actual: unknown, expected: unknown) {
  const okay = String(actual) === String(expected);
  okay ? pass++ : (fail++, failures.push(`${label}: dapat ${actual}, harap ${expected}`));
  console.log(`  ${okay ? "PASS" : "FAIL"}  ${label} → ${actual} (harap ${expected})`);
}

async function login(key: ActorKey) {
  const a = ACTORS[key];
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": a.ip,
      // Better Auth menolak request tanpa Origin (MISSING_OR_NULL_ORIGIN);
      // browser selalu mengirimnya, klien skrip harus menirunya.
      origin: BASE,
    },
    body: JSON.stringify({ email: a.email, password: PASSWORD }),
  });
  const raw = await res.text();
  jar[key] = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const body = (raw ? JSON.parse(raw) : {}) as { user?: { id: string } };
  if (body.user?.id) ids[key] = body.user.id;
  if (!jar[key]) throw new Error(`login ${a.email} gagal: ${res.status} — ${raw.slice(0, 300)}`);
}

const H = (key: ActorKey) => ({
  cookie: jar[key],
  "x-forwarded-for": ACTORS[key].ip,
  "content-type": "application/json",
  origin: BASE,
});

async function api(key: ActorKey, path: string, init?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: H(key), redirect: "manual" });
  return r.status;
}

/**
 * Status HTTP TIDAK bisa dipakai untuk menilai izin halaman di sini: layout
 * sudah mulai mengalir sebelum page-nya dirender, jadi `redirect()` di server
 * component dikirim sebagai payload NEXT_REDIRECT di dalam body ber-status 200,
 * bukan 307. Menyimpulkan "200 = boleh" akan melaporkan setiap penolakan sebagai
 * lolos — persis salah arah untuk uji izin.
 */
async function page(key: ActorKey, path: string) {
  const r = await fetch(`${BASE}/id${path}`, { headers: H(key), redirect: "manual" });
  if (r.status === 404) return "404";
  if (r.status >= 300 && r.status < 400) {
    const loc = r.headers.get("location") ?? "";
    return loc.includes("/login") ? "LOGIN" : "REDIR";
  }
  const body = await r.text();
  if (body.includes("NEXT_REDIRECT")) return "REDIR";
  return r.status === 200 ? "OK" : `HTTP ${r.status}`;
}

const now = new Date();
const MONTH = now.getMonth() + 1;
const YEAR = now.getFullYear();

async function main() {
  console.log(`\n### Verifikasi perubahan — ${BASE}\n`);
  for (const key of Object.keys(ACTORS) as ActorKey[]) {
    await login(key);
    console.log(`  login ✓ ${ACTORS[key].label}`);
  }

  console.log("\n── 1. Mutasi bank sudah dihapus ──");
  // Catatan: setelah route-nya dihapus, path satu segmen `/api/bank-mutations`
  // jatuh ke `/api/[transport]` (endpoint MCP) yang minta Bearer key → 401.
  // Bukan 404, tapi sama-sama berarti tidak ada lagi handler kita di situ.
  check("GET /api/bank-mutations (owner)", await api("owner", `/api/bank-mutations?bankAccountId=${BANK_PVI}`), 401);
  check("GET /api/bank-mutations/[id] (owner)", await api("owner", "/api/bank-mutations/apa-saja"), 404);
  check("POST /api/bank-mutations (owner)", await api("owner", "/api/bank-mutations", {
    method: "POST",
    body: JSON.stringify({ bankAccountId: BANK_PVI, type: "CREDIT", amount: 1 }),
  }), 401);
  check("halaman Mutasi rekening (owner)", await page("owner", `/dashboard/bank-accounts/${BANK_PVI}/mutasi`), "404");
  check("halaman Rekening Bank masih hidup (owner)", await page("owner", "/dashboard/bank-accounts"), "OK");

  console.log("\n── 2. KPI: jalur legacy kpi.approve/kpi.manage tidak berlaku lagi ──");
  check("antrian persetujuan — owner", await api("owner", "/api/kpi-entries/pending"), 200);
  check("antrian persetujuan — kacab (dulu lolos via kpi.approve)", await api("kacab", "/api/kpi-entries/pending"), 403);
  check("antrian persetujuan — teller", await api("teller", "/api/kpi-entries/pending"), 403);

  check(
    "lihat KPI sendiri — teller",
    await api("teller", `/api/kpi-entries?employeeId=${ids.teller}&month=${MONTH}&year=${YEAR}`),
    200
  );
  check(
    "lihat KPI orang lain — kacab (dulu lolos via kpi.view_all)",
    await api("kacab", `/api/kpi-entries?employeeId=${ids.teller}&month=${MONTH}&year=${YEAR}`),
    403
  );
  check(
    "lihat KPI orang lain — owner",
    await api("owner", `/api/kpi-entries?employeeId=${ids.teller}&month=${MONTH}&year=${YEAR}`),
    200
  );
  check(
    "skor bulanan orang lain — kacab",
    await api("kacab", `/api/kpi-monthly-results?employeeId=${ids.teller}&month=${MONTH}&year=${YEAR}`),
    403
  );

  check("kunci periode orang lain — kacab (dulu lolos via kpi.manage)", await api("kacab", "/api/kpi-periods", {
    method: "POST",
    body: JSON.stringify({ employeeId: ids.teller, month: MONTH, year: YEAR, action: "LOCK" }),
  }), 403);
  check("tarik ulang KPI massal — kacab", await api("kacab", "/api/kpi-entries/collect", {
    method: "POST",
    body: JSON.stringify({ month: MONTH, year: YEAR }),
  }), 403);
  check("hitung ulang skor — owner (jalur tulis tidak ikut terblokir)", await api("owner", "/api/kpi-monthly-results", {
    method: "POST",
    body: JSON.stringify({ employeeId: ids.teller, month: MONTH, year: YEAR }),
  }), 201);

  check("halaman Penilaian KPI — owner", await page("owner", "/dashboard/kpi/log"), "OK");
  check("halaman Penilaian KPI — kacab", await page("kacab", "/dashboard/kpi/log"), "REDIR");
  check("halaman Input KPI Saya — teller (kpi.self lewat legacy)", await page("teller", "/dashboard/kpi/self"), "OK");

  console.log("\n── 3. Currency global, stok valas per PT ──");
  check("GET /api/currencies — owner", await api("owner", "/api/currencies"), 200);
  check("GET /api/currencies — kacab (legacy currency.view)", await api("kacab", "/api/currencies"), 200);
  check("GET /api/harga-valas — kacab", await api("kacab", "/api/harga-valas"), 200);
  check("GET /api/currency-stock — kacab (resource baru currency.stock)", await api("kacab", "/api/currency-stock"), 200);
  check("GET /api/currency-stock — teller", await api("teller", "/api/currency-stock"), 200);
  check("halaman Mata Uang — owner", await page("owner", "/dashboard/mata-uang"), "OK");
  check("halaman Harga Valas — owner", await page("owner", "/dashboard/harga-valas"), "OK");
  check("halaman Patokan Harga — kacab (global, tanpa legacy)", await page("kacab", "/dashboard/patokan-harga"), "REDIR");

  // Kontrol: kalau semua halaman terlihat REDIR, detektornya yang salah — bukan izinnya.
  console.log("\n── Kontrol: halaman yang MEMANG boleh dibuka ──");
  check("halaman Stock & Kas Harian — kacab", await page("kacab", "/dashboard/stockist"), "OK");
  check("halaman Presensi Saya — teller", await page("teller", "/dashboard/attendance"), "OK");
  check("halaman Rekening Bank — kacab", await page("kacab", "/dashboard/bank-accounts"), "OK");

  console.log(`\nHASIL: ${pass} pass, ${fail} fail`);
  if (failures.length) {
    console.log("\nYang gagal:");
    for (const f of failures) console.log(`  - ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
