/**
 * E2E test izin — login beneran ke server dev lokal, lalu ketuk setiap halaman
 * dan API, membandingkan hasilnya dengan ekspektasi.
 *
 * Jalankan: npx tsx scratch/authz-e2e.ts <baseUrl> [fase]
 */
import "dotenv/config";

const BASE = process.argv[2] ?? "http://localhost:3000";
const PHASE = process.argv[3] ?? "legacy";
const PASSWORD = "password123";

type Actor = {
  key: string;
  email: string;
  label: string;
  ip: string;
};

const ACTORS: Actor[] = [
  { key: "super", email: "superadmin@system.local", label: "SUPER_ADMIN (global)", ip: "10.9.0.1" },
  { key: "owner", email: "owner@pvi.com", label: "OWNER (global)", ip: "10.9.0.2" },
  { key: "kacab_pvi", email: "kepala.cengkareng@pvi.local", label: "Kepala Cabang · PVI", ip: "10.9.0.3" },
  { key: "kamar_ptu", email: "kepala.pluit@ptu.local", label: "Kepala Marketing · PTU", ip: "10.9.0.4" },
  { key: "teller_pvi", email: "teller.dalam.cengkareng@pvi.local", label: "Teller Dalam · PVI", ip: "10.9.0.5" },
  { key: "kurir_pvi", email: "kurir.cengkareng@pvi.local", label: "Kurir · PVI", ip: "10.9.0.6" },
  { key: "mkt_pvi", email: "sales.tangerang@pvi.local", label: "Marketing · PVI", ip: "10.9.0.7" },
];

// ── Halaman: resource → path ────────────────────────────────────────────────
const PAGES: { resource: string; path: string }[] = [
  { resource: "attendance.self", path: "/dashboard/attendance" },
  { resource: "attendance.all", path: "/dashboard/kpi/presensi" },
  { resource: "kpi.config", path: "/dashboard/kpi" },
  { resource: "kpi.definitions", path: "/dashboard/kpi/definitions" },
  { resource: "kpi.review", path: "/dashboard/kpi/log" },
  { resource: "kpi.analytics", path: "/dashboard/kpi/analisis" },
  { resource: "payroll.manage", path: "/dashboard/payroll" },
  { resource: "payroll.components", path: "/dashboard/payroll/komponen" },
  { resource: "finance.report", path: "/dashboard/laporan-finance" },
  { resource: "watcher.valas", path: "/dashboard/watcher-valas" },
  { resource: "bank.accounts", path: "/dashboard/bank-accounts" },
  { resource: "bank.daily", path: "/dashboard/stockist/bank" },
  { resource: "stockist.daily", path: "/dashboard/stockist" },
  { resource: "stockist.verify", path: "/dashboard/stockist/konfirmasi" },
  { resource: "stock.pt", path: "/dashboard/stock-management-pt" },
  { resource: "currency", path: "/dashboard/mata-uang" },
  { resource: "currency.price", path: "/dashboard/harga-valas" },
  { resource: "price.benchmark", path: "/dashboard/patokan-harga" },
  { resource: "correction", path: "/dashboard/persetujuan-koreksi" },
  { resource: "users", path: "/dashboard/users" },
  { resource: "companies", path: "/dashboard/pt" },
  { resource: "branches", path: "/dashboard/branches" },
  { resource: "roles", path: "/dashboard/roles" },
];

const API_GETS: { label: string; path: string }[] = [
  { label: "GET /api/roles", path: "/api/roles" },
  { label: "GET /api/companies", path: "/api/companies" },
  { label: "GET /api/branches", path: "/api/branches" },
  { label: "GET /api/users", path: "/api/users" },
  { label: "GET /api/salary-components", path: "/api/salary-components" },
  { label: "GET /api/bank-accounts", path: "/api/bank-accounts" },
  { label: "GET /api/currencies", path: "/api/currencies" },
  { label: "GET /api/kpi-definitions", path: "/api/kpi-definitions" },
];

const cookies = new Map<string, string>();

async function login(a: Actor): Promise<boolean> {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": a.ip },
    body: JSON.stringify({ email: a.email, password: PASSWORD }),
    redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const jar = setCookie.map((c) => c.split(";")[0]).join("; ");
  if (!jar || !res.ok) {
    console.error(`  LOGIN GAGAL ${a.email} → ${res.status} ${await res.text()}`);
    return false;
  }
  cookies.set(a.key, jar);
  return true;
}

type PageResult = "OK" | "REDIR" | "LOGIN" | string;

async function getPage(a: Actor, path: string): Promise<PageResult> {
  const res = await fetch(`${BASE}/id${path}`, {
    headers: { cookie: cookies.get(a.key)!, "x-forwarded-for": a.ip },
    redirect: "manual",
  });
  if (res.status === 200) return "OK";
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location") ?? "";
    if (loc.includes("/login")) return "LOGIN";
    if (loc.includes("/dashboard")) return "REDIR";
    return `→${loc}`;
  }
  return `HTTP ${res.status}`;
}

async function apiGet(a: Actor, path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: cookies.get(a.key)!, "x-forwarded-for": a.ip },
    redirect: "manual",
  });
  return String(res.status);
}

async function main() {
  console.log(`\n### FASE: ${PHASE} — base ${BASE}\n`);

  console.log("Login…");
  for (const a of ACTORS) {
    const ok = await login(a);
    console.log(`  ${ok ? "✓" : "✗"} ${a.email}`);
  }
  const live = ACTORS.filter((a) => cookies.has(a.key));

  // ── Halaman ───────────────────────────────────────────────────────────────
  console.log("\n=== HALAMAN (OK = boleh masuk, REDIR = ditolak → /dashboard) ===");
  const header = ["resource".padEnd(20), ...live.map((a) => a.key.padEnd(11))].join("| ");
  console.log(header);
  console.log("-".repeat(header.length));
  const pageMatrix: Record<string, Record<string, string>> = {};
  for (const p of PAGES) {
    const row: string[] = [p.resource.padEnd(20)];
    pageMatrix[p.resource] = {};
    for (const a of live) {
      const r = await getPage(a, p.path);
      pageMatrix[p.resource][a.key] = r;
      row.push(r.padEnd(11));
    }
    console.log(row.join("| "));
  }

  // ── API ───────────────────────────────────────────────────────────────────
  console.log("\n=== API GET (status) ===");
  const h2 = ["endpoint".padEnd(28), ...live.map((a) => a.key.padEnd(11))].join("| ");
  console.log(h2);
  console.log("-".repeat(h2.length));
  for (const e of API_GETS) {
    const row: string[] = [e.label.padEnd(28)];
    for (const a of live) row.push((await apiGet(a, e.path)).padEnd(11));
    console.log(row.join("| "));
  }

  console.log("\nLegenda aktor:");
  for (const a of live) console.log(`  ${a.key.padEnd(11)} = ${a.label}`);

  const fs = await import("node:fs");
  fs.writeFileSync(
    `scratch/authz-result-${PHASE}.json`,
    JSON.stringify(pageMatrix, null, 2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
