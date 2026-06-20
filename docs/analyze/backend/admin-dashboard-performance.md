# Admin Dashboard Performance Analysis Report

## 1. Q&A — Apakah Vercel Free PostgreSQL Penyebab Lambatnya Dashboard?

**Jawaban: YA, tapi bukan satu-satunya penyebab. Ada 5 masalah berlapis.**

Vercel Postgres (Neon) free tier punya 2 karakteristik yang memperlambat:
1. **Scale-to-zero** — database "tidur" jika tidak aktif, cold start ~500ms–2s saat wake up.
2. **Koneksi terbatas** — free tier hanya 5 koneksi bersamaan; serverless function membuat koneksi baru tiap invocation.

Namun masalah terbesar ada di **kode aplikasi itu sendiri**, bukan hanya database. Bahkan dengan database premium pun, pola yang ada sekarang akan tetap lambat.

---

## 2. Analysis Overview

Analisis mencakup:
- `lib/prisma.ts` — konfigurasi koneksi database
- `app/api/admin/users/route.ts`, `app/api/admin/roles/route.ts` — API routes admin
- `app/[locale]/(dashboard)/layout.tsx` — layout dashboard
- `app/[locale]/(dashboard)/dashboard/users/page.tsx`, `kpi/page.tsx`, `kpi/log/page.tsx` — server pages
- `backend/services/kpi.service.ts` — kalkulasi KPI
- `backend/repositories/user.repository.ts`, `role-kpi.repository.ts` — layer repository
- Semua Prisma schema (`auth.prisma`, `kpi.prisma`, `business.prisma`)

---

## 3. Value - Score

| Metric | Score (1-10) | Notes |
| :--- | :--- | :--- |
| **Performance** | 3/10 | Multiple DB round trips per request, tidak ada caching, koneksi tidak di-pool |
| **Security** | 6/10 | Auth guard ada di semua route, tapi ada duplikasi session lookup yang boros |
| **Maintainability** | 7/10 | Arsitektur repo/service cukup rapi, tapi ada inkonsistensi pola auth |
| **Overall Quality** | **5/10** | **Fondasi baik, tapi layer performa hampir tidak ada** |

---

## 4. Advice & Observations

### Masalah #1 — KRITIS: Tidak Ada Connection Pooler (Penyebab Utama Lambat)

**File:** `lib/prisma.ts`

```ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
```

Di Vercel serverless, setiap function invocation bisa membuat koneksi baru ke PostgreSQL. Neon free tier hanya mengizinkan 5 koneksi simultan. Jika ada 3 tab dibuka bersamaan, koneksi habis dan request antri.

**Yang benar:** Gunakan connection string pooler (`-pooler.` URL dari Neon dashboard), bukan direct connection URL.

---

### Masalah #2 — KRITIS: 2–3 DB Round Trip Hanya untuk Auth di Setiap API Request

**File:** `app/api/admin/roles/route.ts`, `app/api/admin/users/route.ts`

```ts
// Round trip #1: cek session di Better Auth (baca tabel session)
const session = await auth.api.getSession({ headers: await headers() });

// Round trip #2: ambil user + role (query terpisah ke DB!)
const caller = await prisma.user.findUnique({
  where: { id: session.user.id },
  include: { customRole: true },
});
```

Setiap API request admin = minimum **2 DB query** sebelum query utama berjalan. Untuk halaman Users yang memanggil `/api/admin/users` + `/api/admin/roles` bersamaan = **4 DB round trips hanya untuk auth**.

---

### Masalah #3 — TINGGI: Layout Dashboard Selalu Buat Session Request

**File:** `app/[locale]/(dashboard)/layout.tsx`

```ts
const session = await auth.api.getSession({ headers: await headers() });
```

Ini dipanggil di **setiap navigasi halaman dashboard** karena layout adalah Server Component. Tidak ada caching — setiap klik ke menu baru = DB session lookup lagi.

---

### Masalah #4 — TINGGI: KPI Calculate = 5 Sequential DB Queries

**File:** `backend/services/kpi.service.ts`, fungsi `calculateMonthlyResult`

```ts
await prisma.user.findUnique(...)       // Query 1
await prisma.roleKpi.findMany(...)      // Query 2
await prisma.kpiLog.findMany(...)       // Query 3
await prisma.revenue.findMany(...)      // Query 4
await prisma.bonusMatrix.findUnique(...)// Query 5
```

Semua sequential — total waktu = sum semua latency, bukan maximum. Dengan Neon cold start, ini bisa 2–4 detik hanya untuk 1 klik kalkulasi.

---

### Masalah #5 — SEDANG: Server Pages Tidak Pakai Next.js Cache

**File:** `dashboard/kpi/page.tsx`, `dashboard/users/page.tsx`, `dashboard/kpi/log/page.tsx`

Semua page langsung `await prisma.xxx.findMany()` tanpa `unstable_cache` atau `cache()`. Data seperti companies, branches, roles berubah sangat jarang, tapi di-fetch ulang setiap kali halaman dibuka.

---

### Masalah #6 — SEDANG: OrderBy pada Relasi Memicu JOIN Implisit

**File:** `backend/repositories/user.repository.ts`

```ts
orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
```

Prisma menerjemahkan ini menjadi `LEFT JOIN` ke tabel `Branch` hanya untuk keperluan sorting. Untuk tabel user kecil ini masih oke, tapi pola ini tidak scalable.

---

### Masalah #7 — RENDAH: Vercel Free Tier = Neon Scale-to-Zero

Ini murni infrastruktur: jika tidak ada traffic dalam ~5 menit, compute Neon shut down. Request berikutnya kena cold start 1–3 detik. Ini wajar di free tier tapi terasa buruk bagi user.

---

## 5. Recommendations

### Immediate (Fix Sekarang — Dampak Terbesar)

- [ ] **CRITICAL**: Ganti `DATABASE_URL` ke Neon **pooler connection string** (URL dengan `-pooler.` di dalamnya dari Neon dashboard → Connection → Pooled connection). Ini satu perubahan env var yang bisa potong latency 30–60%.

- [ ] **CRITICAL**: Hapus double auth pattern di API routes admin. Simpan `customRoleName` di session Better Auth saat login sehingga tidak perlu query DB untuk cek role. Atau gunakan `withRole` middleware yang sudah ada tapi belum dipakai di admin routes.

- [ ] **HIGH**: Cache data statis dengan `unstable_cache` dari Next.js. Data companies, branches, roles hampir tidak berubah — cache 60 detik sudah cukup:
  ```ts
  import { unstable_cache } from 'next/cache';
  const getCompanies = unstable_cache(() => prisma.company.findMany(...), ['companies'], { revalidate: 60 });
  ```

### Medium Term

- [ ] **HIGH**: Parallelkan query sequential di `calculateMonthlyResult`:
  ```ts
  const [employee, logs, revenues] = await Promise.all([
    prisma.user.findUnique(...),
    prisma.kpiLog.findMany(...),
    prisma.revenue.findMany(...),
  ]);
  ```

- [ ] **MEDIUM**: Tambah `export const revalidate = 30` di halaman-halaman yang datanya semi-statis (KPI config, users list) agar Next.js bisa cache seluruh page output.

- [ ] **MEDIUM**: Tambah index di kolom yang sering difilter tapi belum punya index:
  - `KpiLog.createdAt` (sudah ada composite, cek apakah urutan kolom optimal)
  - `Revenue.date` (sudah ada composite dengan `employeeId`, bagus)
  - `BonusTier.matrixId` — belum ada `@@index`

### Long Term (Jika Traffic Bertambah)

- [ ] **UPGRADE**: Naikkan ke Neon paid tier atau gunakan Supabase paid — hilangkan scale-to-zero, tambah connection limit.
- [ ] **CONSIDER**: Gunakan Vercel Edge Middleware untuk session validation agar tidak hit DB di setiap layout render.

---

## 6. Further Development

- **Optimistic UI**: Untuk operasi CRUD (create user, update KPI), tampilkan data baru di UI secara instant sebelum server confirm — drastis mengurangi perceived latency.
- **SWR/React Query**: Untuk data yang sering dipakai di beberapa tempat (users, roles, branches), gunakan client-side cache via SWR agar tidak re-fetch setiap navigasi.
- **Database Metrics**: Aktifkan Neon query insights untuk melihat query mana yang paling lambat secara empiris.
- **Skeleton Loading**: Tambah skeleton loader yang lebih spesifik per section sehingga halaman terasa responsif meski data belum loaded.
