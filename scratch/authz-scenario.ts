/**
 * Skenario inti dari AUTHORIZATION.md, diuji end-to-end:
 *
 *   Jabatan "Kepala Marketing" di PT PTU boleh MELIHAT Saldo Bank Harian
 *   milik PTU dan PVI, tapi hanya boleh MENGINPUT untuk PTU.
 *   Jabatan bernama sama di PT lain tidak melihat halaman itu sama sekali.
 *
 * Script ini: (1) menyetel matriks izin di DB, (2) menembak API/halaman
 * beneran lewat HTTP, (3) mengembalikan DB ke keadaan semula.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE = process.argv[2] ?? "http://localhost:3001";
const IP = "10.9.1.1";
const EMAIL = "kepala.pluit@ptu.local";
const PASSWORD = "password123";
const PVI = "1";
const PTU = "2";
const PKD = "3";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

let pass = 0;
let fail = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const okay = String(actual) === String(expected);
  if (okay) pass++;
  else fail++;
  console.log(`  ${okay ? "PASS" : "FAIL"}  ${label}  → ${actual} (harap ${expected})`);
}

let cookie = "";
async function login() {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": IP, origin: BASE },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error(`login gagal: ${res.status} ${await res.text()}`);
}

const H = () => ({ cookie, "x-forwarded-for": IP, "content-type": "application/json", origin: BASE });

async function apiGet(path: string) {
  const r = await fetch(`${BASE}${path}`, { headers: H(), redirect: "manual" });
  return r.status;
}
async function apiPost(path: string, body: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: H(),
    body: JSON.stringify(body),
    redirect: "manual",
  });
  return { status: r.status, body: await r.text() };
}
/**
 * `redirect()` dari server component sampai sebagai payload NEXT_REDIRECT di
 * dalam body ber-status 200 (layout sudah mengalir lebih dulu), jadi status HTTP
 * tidak bisa dipakai menilai izin halaman — lihat catatan di verify-changes.ts.
 */
async function page(path: string) {
  const r = await fetch(`${BASE}/id${path}`, { headers: H(), redirect: "manual" });
  if (r.status >= 300 && r.status < 400) {
    const loc = r.headers.get("location") ?? "";
    return loc.includes("/login") ? "LOGIN" : "REDIR";
  }
  const body = await r.text();
  if (body.includes("NEXT_REDIRECT")) return "REDIR";
  return r.status === 200 ? "OK" : `HTTP ${r.status}`;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function setGrants(
  roleId: string,
  grants: {
    resource: string;
    viewScope?: string;
    viewCompanyIds?: string[];
    writeScope?: string;
    writeCompanyIds?: string[];
  }[]
) {
  await prisma.$transaction([
    prisma.roleResourcePermission.deleteMany({ where: { roleId } }),
    prisma.roleResourcePermission.createMany({
      data: grants.map((g) => ({
        roleId,
        resource: g.resource,
        viewScope: (g.viewScope ?? "NONE") as never,
        viewCompanyIds: g.viewCompanyIds ?? [],
        writeScope: (g.writeScope ?? "NONE") as never,
        writeCompanyIds: g.writeCompanyIds ?? [],
      })),
    }),
    prisma.custom_role.update({ where: { id: roleId }, data: { usesResourcePerms: true } }),
  ]);
}

async function main() {
  const roleKM_PTU = await prisma.custom_role.findFirstOrThrow({
    where: { name: "Kepala Marketing", companyId: PTU },
  });
  const before = await prisma.custom_role.findUniqueOrThrow({
    where: { id: roleKM_PTU.id },
    select: { usesResourcePerms: true },
  });
  const beforeGrants = await prisma.roleResourcePermission.findMany({
    where: { roleId: roleKM_PTU.id },
  });

  const akunPTU = await prisma.bankAccount.findFirstOrThrow({ where: { companyId: PTU } });
  const akunPVI = await prisma.bankAccount.findFirstOrThrow({ where: { companyId: PVI } });

  console.log(`Role uji: Kepala Marketing @ PTU (${roleKM_PTU.id})`);
  console.log(`Rekening PTU=${akunPTU.id}  PVI=${akunPVI.id}\n`);

  const today = ymd(new Date());
  const yesterday = ymd(new Date(Date.now() - 86_400_000));

  // ── Skenario 1: lihat PTU+PVI, tulis PTU saja ────────────────────────────
  console.log("── Skenario 1: view [PTU, PVI], write [PTU] ──");
  await setGrants(roleKM_PTU.id, [
    {
      resource: "bank.daily",
      viewScope: "SELECTED",
      viewCompanyIds: [PTU, PVI],
      writeScope: "SELECTED",
      writeCompanyIds: [PTU],
    },
  ]);
  await login();

  check("halaman Saldo Bank Harian", await page("/dashboard/stockist/bank"), "OK");
  check("GET bank-harian PT sendiri (PTU)", await apiGet(`/api/bank-harian?companyId=${PTU}&date=${today}`), 200);
  check("GET bank-harian PT lain yg diizinkan (PVI)", await apiGet(`/api/bank-harian?companyId=${PVI}&date=${today}`), 200);
  check("GET bank-harian PT tak diizinkan (PKD)", await apiGet(`/api/bank-harian?companyId=${PKD}&date=${today}`), 403);

  const w1 = await apiPost("/api/bank-harian", {
    companyId: PTU,
    date: today,
    entries: [{ bankAccountId: akunPTU.id, balance: 12345678 }],
  });
  check("POST input PTU (boleh tulis)", w1.status, 200);

  const w2 = await apiPost("/api/bank-harian", {
    companyId: PVI,
    date: today,
    entries: [{ bankAccountId: akunPVI.id, balance: 999 }],
  });
  check("POST input PVI (hanya boleh lihat)", w2.status, 403);

  // Rekening PT lain diselundupkan lewat companyId yang boleh ditulis
  const w3 = await apiPost("/api/bank-harian", {
    companyId: PTU,
    date: today,
    entries: [{ bankAccountId: akunPVI.id, balance: 999 }],
  });
  check("POST rekening PVI dgn companyId PTU (selundupan)", w3.status, 403);

  // Backdate tanpa kemampuan daily.backdate
  const w4 = await apiPost("/api/bank-harian", {
    companyId: PTU,
    date: yesterday,
    entries: [{ bankAccountId: akunPTU.id, balance: 111 }],
  });
  check("POST tanggal kemarin tanpa daily.backdate", w4.status, 403);

  // Resource yang tidak diberikan sama sekali
  check("halaman Stock & Kas Harian (tidak diberikan)", await page("/dashboard/stockist"), "REDIR");
  check("halaman Pengguna (tidak diberikan)", await page("/dashboard/users"), "REDIR");
  check("halaman Jabatan (global, tidak diberikan)", await page("/dashboard/roles"), "REDIR");
  check("GET /api/users (endpoint lama, role sudah migrasi)", await apiGet("/api/users"), 403);

  // ── Skenario 2: tambah kemampuan daily.backdate untuk PTU ────────────────
  console.log("\n── Skenario 2: + daily.backdate (write OWN) ──");
  await setGrants(roleKM_PTU.id, [
    {
      resource: "bank.daily",
      viewScope: "SELECTED",
      viewCompanyIds: [PTU, PVI],
      writeScope: "SELECTED",
      writeCompanyIds: [PTU],
    },
    { resource: "daily.backdate", viewScope: "OWN", writeScope: "OWN" },
  ]);
  await login();
  const w5 = await apiPost("/api/bank-harian", {
    companyId: PTU,
    date: yesterday,
    entries: [{ bankAccountId: akunPTU.id, balance: 222 }],
  });
  check("POST tanggal kemarin dgn daily.backdate", w5.status, 200);

  // ── Skenario 3: cabut semua izin ─────────────────────────────────────────
  console.log("\n── Skenario 3: semua izin dicabut (0 baris, migrated=true) ──");
  await setGrants(roleKM_PTU.id, []);
  await login();
  check("halaman Saldo Bank Harian setelah dicabut", await page("/dashboard/stockist/bank"), "REDIR");
  check("GET bank-harian setelah dicabut", await apiGet(`/api/bank-harian?companyId=${PTU}&date=${today}`), 403);
  check("halaman Presensi Saya (self) setelah dicabut", await page("/dashboard/attendance"), "REDIR");

  // ── Kembalikan ───────────────────────────────────────────────────────────
  await prisma.$transaction([
    prisma.roleResourcePermission.deleteMany({ where: { roleId: roleKM_PTU.id } }),
    ...(beforeGrants.length
      ? [
          prisma.roleResourcePermission.createMany({
            data: beforeGrants.map(({ id: _id, createdAt: _c, updatedAt: _u, ...g }) => g),
          }),
        ]
      : []),
    prisma.custom_role.update({
      where: { id: roleKM_PTU.id },
      data: { usesResourcePerms: before.usesResourcePerms },
    }),
  ]);
  console.log("\nDB dikembalikan ke keadaan semula.");
  console.log(`\nHASIL: ${pass} pass, ${fail} fail`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
