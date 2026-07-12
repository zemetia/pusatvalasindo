# Task: Stockist, Tunai (Kas) & Bank Harian — Modul Keuangan Cabang

- **Date**: 2026-07-08
- **Status**: 📝 Planning
- **Source**: User request — modul keuangan baru "Stockist" terpisah dari Bank, berbasis konsep pocket ala Ko Hoker. Dikerjakan sekaligus dengan modul Tunai (Kas) dan input saldo bank harian (role Marketing) karena saling berhubungan.

Dokumen ini punya **3 bagian** yang dikerjakan dalam 1 task karena saling terkait, tapi tetap konsep terpisah secara data:
- **Bagian 1 — Stockist (Mata Uang)**: stock mata uang asing per **pocket** (multi-currency × multi-pocket), dengan review harian klik status.
- **Bagian 2 — Bank Harian**: input saldo rekening bank per hari oleh role **Sales & Compliance** ("marketing"), tanpa pocket, tanpa debit/kredit — cuma "berapa saldonya hari ini", dan perubahan (naik/turun) dihitung otomatis oleh kode.
- **Bagian 3 — Tunai (Kas)**: uang tunai IDR per **pocket kas** (pocket-nya sendiri, beda dari pocket Stockist) — bentuk datanya kaya Stockist (punya pocket), tapi cara isinya kaya Bank Harian (ketik saldo hari ini, tanpa klik Benar/Beda). Satu section UI yang sama dengan Stockist (tab kedua), diisi oleh **Teller Dalam** juga.

---

## 🖱️ Prinsip UX (berlaku ke Bagian 1, 2, dan 3)

User awam yang biasa pakai Excel adalah target utama — semua form input harian di 3 bagian ini harus terasa seperti spreadsheet, bukan seperti "form modal berlapis":

- **Autosave saat keluar dari sel (on blur), bukan tombol "Simpan" per baris.** Feedback cukup ikon kecil (✓ tersimpan / spinner), bukan toast/dialog tiap ketikan.
- **Navigasi Tab/Enter antar sel**, kaya di Excel — hindari klik mouse berulang buat pindah baris.
- **Tabel polos yang gede & jelas** (angka rata kanan, font monospace, kontras tinggi) — bukan kartu-kartu kecil yang butuh scroll banyak.
- **Minim modal.** Popover "Tandai Beda" di Stockist juga dibuat inline (expand di baris yang sama), bukan dialog terpisah yang mindahin fokus.
- **Nilai lama selalu kelihatan di sebelah nilai baru** (kolom "kemarin" di samping kolom "hari ini") supaya orang gak perlu buka tab lain buat bandingin.

Prinsip ini dipakai sebagai acuan desain komponen di ketiga bagian, bukan checklist teknis tersendiri.

---

## 🎯 Goal — Bagian 1: Stockist

Bikin section baru **"Stockist"** di bagian Keuangan: modul stock **mata uang & kas tunai** per **pocket** (dompet/laci internal cabang), terpisah total dari modul Bank (rekening PT). Modul ini **berdiri sendiri** — halaman lama (`stock-management`, `stock-mata-uang`) tetap jalan seperti sekarang, tidak diubah/dimigrasikan di task ini.

### Konsep inti (hasil klarifikasi dengan user)

1. **Matrix Pocket × Mata Uang** — persis kaya Excel: **baris = mata uang** (USD, AUD, ... semua currency aktif), **kolom = pocket**. Tiap cabang punya pocket sendiri-sendiri (Kas Kecil, Finance Blue, Finance Orange, Kurir A, Kurir B, dst). Nambah pocket baru = nambah kolom baru, otomatis punya semua baris mata uang (default 0 kalau belum diisi).
2. **Reconciliation pagi hari itu simpel: 1 klik status**, bukan hitung ulang expected-vs-actual otomatis. Tiap pagi, tiap sel (pocket × currency) mulai dengan status **"Belum Review"**. Teller Dalam klik salah satu: **"Benar"** (cocok, tidak ada perubahan) atau **"Beda"** (ada selisih → wajib isi catatan singkat, dan boleh sekalian koreksi angkanya).
3. **Kepala Cabang: view-only + alert** — bisa lihat dashboard read-only untuk cabangnya sendiri (semua pocket, saldo tiap mata uang, status review hari ini), dengan alert kalau ada sel yang "Beda" atau masih "Belum Review" mendekati akhir hari. Tidak bisa mengedit apa pun.
4. **Terpisah dari Bank** — mata uang = mata uang, rekening bank = rekening bank. Stockist tidak menyentuh `BankAccount`/`BankMutation` sama sekali.
5. **Web harus tetap kenceng** — desain query & UI dibuat agar aksi harian (klik status) itu ringan (1 request kecil), bukan re-render grid gede tiap klik.

### Non-Goals (task ini tidak melakukan)

- Tidak mengubah/menghapus `stock-management`, `stock-mata-uang`, `CurrencyStock`, `StockItem`, `DailyStockEntry` yang sudah ada.
- Tidak membuat perhitungan rate beli/jual atau P&L dari pocket (itu ranah modul Finance Flow yang belum dikerjakan).
- Tidak membuat approval workflow berjenjang (Kepala Cabang hanya view, bukan approver) — sesuai jawaban user.
- Tidak transfer otomatis lintas pocket berdasarkan transaksi kasir (integrasi ke alur transaksi jual/beli valas nanti, bukan sekarang).

---

## 🗄️ Data Model — Bagian 1: Stockist

File baru: `prisma/schema/stockist.prisma` (mengikuti pola modular schema yang sudah ada).

```prisma
model StockistPocket {
  id        String   @id @default(cuid())
  branchId  String
  name      String                // "Kas Kecil", "Finance Blue", "Kurir A", dst
  code      String?
  isDefault Boolean  @default(false) // pocket bawaan yang ikut ke-seed tiap cabang baru
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  branch    Branch                @relation(fields: [branchId], references: [id])
  balances  StockistBalance[]
  mutations StockistMutation[]
  checks    StockistDailyCheck[]

  @@unique([branchId, name])
  @@index([branchId])
}

model StockistBalance {
  id         String   @id @default(cuid())
  pocketId   String
  currencyId String
  quantity   Decimal  @default(0)   // saldo berjalan (running balance) — 1 sel di matrix
  updatedAt  DateTime @updatedAt

  pocket     StockistPocket @relation(fields: [pocketId], references: [id])
  currency   Currency       @relation(fields: [currencyId], references: [id])

  @@unique([pocketId, currencyId])
  @@index([pocketId])
}

model StockistMutation {
  id           String               @id @default(cuid())
  pocketId     String
  currencyId   String
  type         StockistMutationType
  quantity     Decimal              // + atau - tergantung type
  balanceAfter Decimal
  note         String?
  createdAt    DateTime             @default(now())
  createdBy    String?

  pocket       StockistPocket @relation(fields: [pocketId], references: [id])
  currency     Currency       @relation(fields: [currencyId], references: [id])

  @@index([pocketId, currencyId, createdAt])
}

model StockistDailyCheck {
  id               String              @id @default(cuid())
  pocketId         String
  currencyId       String
  date             DateTime            @db.Date
  status           StockistCheckStatus @default(BELUM_REVIEW)
  quantitySnapshot Decimal             @default(0)  // saldo saat sel ini dibuat pagi itu (referensi "kemarin")
  note             String?
  reviewedBy       String?
  reviewedAt       DateTime?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  pocket           StockistPocket @relation(fields: [pocketId], references: [id])
  currency         Currency       @relation(fields: [currencyId], references: [id])

  @@unique([pocketId, currencyId, date])
  @@index([pocketId, date])
  @@index([date, status])
}

enum StockistMutationType {
  OPENING
  TOP_UP
  WITHDRAWAL
  TRANSFER_IN
  TRANSFER_OUT
  ADJUSTMENT
}

enum StockistCheckStatus {
  BELUM_REVIEW
  BEDA
  BENAR
}
```

Tambahan relasi di file yang sudah ada:
- `prisma/schema/business.prisma` → `Branch.stockistPockets StockistPocket[]`; `Currency.stockistBalances`, `stockistMutations`, `stockistDailyChecks` (relasi balik untuk 3 model di atas).

**Kenapa desain begini:**
- `StockistBalance` = 1 baris per sel matrix (pocket × currency), jadi grid tinggal `SELECT` semua balance milik pocket-pocket 1 cabang, di-pivot di UI. `@@unique([pocketId, currencyId])` menjaga 1 sel = 1 angka.
- `StockistMutation` = ledger audit (siapa ubah apa, kapan, kenapa) — dibutuhkan supaya "Beda" yang dikoreksi punya jejak, dan supaya nanti gampang diperluas (top-up, withdrawal, transfer antar pocket/kurir) tanpa redesain.
- `StockistDailyCheck` = representasi tombol klik pagi. 1 baris per (pocket, currency, date). Dibuat (upsert) lazy saat grid pertama kali dibuka hari itu, bukan lewat cron — lebih simpel & tahan downtime.

---

## 🔁 Alur Bisnis

### 1. Setup pocket (Admin / Kepala Cabang dengan `stockist.manage`)
- Tiap cabang mulai dengan pocket default (mis. "Kas Kecil") — bisa di-seed manual per cabang, tidak perlu daftar default yang di-hardcode karena tiap cabang beda.
- Tambah pocket baru = form simpel (nama, kode opsional). Begitu dibuat, otomatis tersedia untuk semua currency aktif (baris balance dibuat on-demand dengan qty 0 saat pertama disentuh, tidak perlu insert semua currency di muka).

### 2. Mutasi saldo (top-up, withdrawal, transfer, adjustment)
- Setiap perubahan saldo pocket (dari mana pun) **wajib** lewat 1 fungsi service `applyStockistMutation()` yang: insert `StockistMutation`, update `StockistBalance.quantity` dalam 1 Prisma transaction. Tidak ada tempat lain yang boleh update `StockistBalance` langsung.
- Transfer antar pocket = 2 mutasi (`TRANSFER_OUT` di pocket asal, `TRANSFER_IN` di pocket tujuan) dalam 1 transaction.

### 3. Reconciliation pagi hari (Teller Dalam dengan `stockist.manage`)
- Buka `/dashboard/stockist`, pilih cabang (kalau user scoped ke 1 cabang, auto-select) dan tanggal (default hari ini).
- Grid pocket × currency ditampilkan. Untuk tanggal hari ini, tiap sel yang belum punya `StockistDailyCheck` di-upsert otomatis dengan `status=BELUM_REVIEW`, `quantitySnapshot = balance saat ini`.
- Teller klik sel → popover kecil dengan 2 tombol:
  - **"Tandai Benar"** → `PATCH` status jadi `BENAR`, `reviewedBy`/`reviewedAt` diisi. Selesai, tidak ada perubahan saldo.
  - **"Tandai Beda"** → wajib isi catatan singkat (mis. "kurang 50rb, kemungkinan salah hitung kemarin"); opsional isi angka koreksi. Kalau ada angka koreksi → jalan `applyStockistMutation(ADJUSTMENT)` sebelum set status `BEDA`.
- Tidak ada perhitungan "expected balance" otomatis dari mutasi — sesuai keputusan user, cukup klik.

### 4. Dashboard Kepala Cabang (`stockist.view`, tanpa `stockist.manage`)
- Halaman sama (`/dashboard/stockist`), tapi read-only: tombol klik status disembunyikan/disabled, hanya baca.
- Alert di atas grid: hitung jumlah sel `BEDA` dan `BELUM_REVIEW` untuk tanggal hari ini di cabangnya → tampilkan badge merah/kuning.
- Riwayat: bisa ganti tanggal untuk lihat histori (read-only juga).

---

## 🔐 Permissions

Tambah 2 permission baru di `src/lib/permissions.ts` (pola sudah ada, tinggal ikuti):

```ts
STOCKIST_VIEW: "stockist.view",
STOCKIST_MANAGE: "stockist.manage",
```

Pemetaan role (lihat `ROLE_PERMISSION_MAP` di [permissions.ts](src/lib/permissions.ts)):

| Role | View | Manage |
|---|---|---|
| SUPER_ADMIN / OWNER / Admin | ✅ | ✅ |
| Kepala Cabang / Kepala & Kasir / Kepala Marketing | ✅ | ❌ |
| Akuntan | ✅ | ❌ |
| **Teller Dalam** | ✅ | ✅ |
| **Teller Luar** | ✅ | ❌ |
| Kasir / Sales & Compliance | ✅ | ❌ |
| Kurir | ❌ | ❌ |

⚠️ **Perlu perhatian saat implementasi**: saat ini `"Teller Dalam"` dan `"Teller Luar"` sama-sama menunjuk ke konstanta `KASIR_PERMISSIONS` yang sama persis. Karena task ini butuh Teller Dalam bisa manage tapi Teller Luar tidak, harus dipisah jadi 2 konstanta (`TELLER_DALAM_PERMISSIONS`, `TELLER_LUAR_PERMISSIONS`) sebelum menambahkan `STOCKIST_MANAGE` hanya ke salah satunya. Ini perubahan kecil tapi harus dilakukan hati-hati (jangan sampai permission lain milik Teller Luar ikut berubah).

Scoping data: ikuti pola `user.branchId` yang sudah dipakai modul lain (attendance/KPI) — user dengan `branchId` terisi hanya lihat/kelola pocket cabangnya sendiri; Admin/Owner/Akuntan (branchId null / lintas cabang) bisa pilih cabang mana saja.

---

## 🌐 API Surface

Ikuti pola `src/backend/{repositories,services}` + route handler tipis di `src/app/api/`.

- `GET /api/stockist/pockets?branchId=` — list pocket + saldo per currency (untuk grid)
- `POST /api/stockist/pockets` — buat pocket baru (`stockist.manage`)
- `PATCH /api/stockist/pockets/[id]` — rename/reorder/nonaktifkan pocket
- `GET /api/stockist/grid?branchId=&date=` — grid lengkap: pockets × currencies × balance × status check hari itu (auto-upsert check rows kalau belum ada)
- `PATCH /api/stockist/daily-check` — body `{ pocketId, currencyId, date, status, note?, correctedQuantity? }` — aksi klik "Benar"/"Beda"
- `POST /api/stockist/mutations` — top-up / withdrawal / transfer manual (`stockist.manage`)
- `GET /api/stockist/history?branchId=&pocketId?=&from=&to=` — riwayat mutasi + check, paginated

Layer backend baru:
- `src/backend/repositories/stockist-pocket.repository.ts`
- `src/backend/repositories/stockist-balance.repository.ts`
- `src/backend/repositories/stockist-mutation.repository.ts`
- `src/backend/repositories/stockist-daily-check.repository.ts`
- `src/backend/services/stockist.service.ts` — isi: `applyStockistMutation()`, `getOrCreateGridForDate()`, `markDailyCheck()`, `getBranchAlerts()`

---

## 🖥️ UI / Pages

Halaman `/dashboard/stockist` punya **2 tab**: "Mata Uang" (Bagian 1, dijelaskan di sini) dan "Tunai (Kas)" (Bagian 3, lihat section-nya sendiri di bawah) — 1 sidebar entry, 1 page, dipisah tab karena user eksplisit minta sectionnya nyatu tapi datanya beda.

- Sidebar: entri baru "Stockist" di bagian Keuangan (`app-sidebar.tsx`), gated by `STOCKIST_VIEW`.
- `src/app/[locale]/(dashboard)/dashboard/stockist/page.tsx` — server component: fetch branch list (scoped by role) + currencies aktif + kas pockets, render client tabs.
- `src/components/admin/stockist/stockist-tabs.tsx` — wrapper `Tabs` (shadcn), tab "Mata Uang" → `StockistGridClient`, tab "Tunai (Kas)" → `KasGridClient` (lihat Bagian 3).
- `src/components/admin/stockist/stockist-grid-client.tsx` — grid utama (pocket = kolom, currency = baris), pilihan cabang + tanggal, badge status per sel, aksi "Benar/Beda" inline (bukan popover terpisah, sesuai prinsip UX di atas).
- `src/components/admin/stockist/stockist-pocket-sheet.tsx` — form tambah/edit pocket mata uang (manage only).
- `src/app/[locale]/(dashboard)/dashboard/stockist/history/page.tsx` — riwayat mutasi & check mata uang, tabel + filter tanggal/pocket.

---

## ⚡ Performance Notes

- Klik status "Benar"/"Beda" harus jadi **1 PATCH kecil** yang cuma update 1 baris `StockistDailyCheck` (+ optionally 1 mutation insert) — jangan refetch seluruh grid, cukup update state lokal sel itu (optimistic update, rollback kalau API gagal).
- Index yang sudah didesain (`@@unique([pocketId, currencyId])`, `@@index([pocketId, date])`, `@@index([date, status])`) cukup untuk query grid harian dan alert count tanpa full scan.
- Grid fetch (`GET /api/stockist/grid`) pakai `Promise.all` untuk pockets+balances+checks dalam 1 branch, bukan N+1 per pocket.
- History page wajib pagination (`take`/`cursor`), jangan load semua mutasi sekaligus.
- Halaman utama tetap server component untuk initial data (SSR), hanya interaksi klik yang client-side — konsisten dengan pola `daily-stock-form.tsx` yang sudah ada tapi dibuat lebih ringan (tanpa recompute total tiap keystroke berat).

---

## 🎯 Goal — Bagian 2: Bank Harian

Halaman baru khusus **input saldo rekening bank per hari**, dipakai role **Sales & Compliance** ("marketing"). Beda total dari Stockist:

- **Tidak ada pocket** — langsung per `BankAccount` (rekening PT yang sudah ada).
- **Tidak ada konsep debit/kredit/mutasi** — user cuma isi 1 angka: *"berapa saldo rekening ini hari ini"*. Kenaikan/penurunan dari hari sebelumnya **dihitung otomatis oleh kode** (delta = saldo hari ini − saldo entry terakhir), bukan dikategorikan manual oleh user.
- **Bukan modul baru secara data** — `BankAccount`, `BankMutation`, dan `DailyBankEntry` di `prisma/schema/bank.prisma` **sudah ada dan sudah pas** untuk kebutuhan ini. Konfirmasi dari baca kode: `src/app/api/stok-harian/route.ts` (dipakai `daily-stock-form.tsx`) sudah melakukan persis ini untuk bank — `dailyBankEntryRepository.upsertMany()` menyimpan `{ bankAccountId, date, balance, tarikCek, note }` per hari, **tanpa** menyentuh `BankMutation` (CREDIT/DEBIT) sama sekali. Yang belum ada: (a) halaman input **khusus bank saja** (saat ini bank nyampur jadi satu form sama currency stock di `daily-stock-form.tsx`), dan (b) tampilan **delta otomatis** vs hari sebelumnya.
- **Tidak reuse `BankMutation`** — model itu tetap ada di schema untuk kebutuhan lain (kalau ada), tapi flow marketing ini tidak menciptakan baris `BankMutation` sama sekali.

### Data Model — Bagian 2

**Tidak ada migrasi Prisma baru.** Reuse penuh:
- `BankAccount` (rekening PT, saldo referensi terakhir)
- `DailyBankEntry` (`bankAccountId`, `date`, `balance`, `tarikCek`, `note`, `createdBy`) — 1 baris = 1 rekening × 1 hari

Satu-satunya tambahan (opsional, di level repository, bukan schema): fungsi untuk ambil entry **sebelumnya** (tanggal terakhir < tanggal yang dipilih) per `bankAccountId`, dipakai buat hitung delta. Tidak perlu kolom baru — delta dihitung on-the-fly setiap kali data diambil.

### Alur Bisnis — Bagian 2

1. Sales & Compliance buka `/dashboard/bank-harian`, pilih cabang (auto kalau ter-scope 1 cabang) dan tanggal (default hari ini).
2. Halaman list semua `BankAccount` aktif cabang itu. Tiap baris tampil:
   - Nama bank & rekening
   - **Saldo entry terakhir** (referensi, read-only) — dari `DailyBankEntry` tanggal sebelum tanggal yang dipilih, fallback ke `BankAccount.balance` kalau belum pernah ada entry
   - Input **"Saldo Hari Ini"** (angka)
   - **Delta** dihitung live saat mengetik: `saldo hari ini − saldo referensi`, ditampilkan hijau (naik) / merah (turun) / abu (sama)
   - Input `tarikCek` (tetap dipertahankan, field yang sudah ada) dan `note` opsional
3. Simpan → `upsert DailyBankEntry` per rekening (persis fungsi `dailyBankEntryRepository.upsertMany` yang sudah ada, tinggal dipanggil dari route baru khusus bank).
4. Kepala Cabang / Admin / Akuntan (yang sudah punya `bank.view`) bisa lihat histori entry + delta harian ini secara read-only — tidak perlu review klik status seperti Stockist (user konfirmasi ini bukan flow reconciliation fisik, cuma pencatatan angka).

### Permissions — Bagian 2

Tambah 1 permission baru, sengaja **dipisah dari `bank.manage`** supaya Sales & Compliance cuma bisa input saldo harian, bukan ubah master data rekening (nama bank, no. rekening, dsb — itu tetap `bank.manage` khusus Admin/Akuntan):

```ts
BANK_DAILY_INPUT: "bank.daily_input",
```

| Role | bank.view | bank.manage | bank.daily_input |
|---|---|---|---|
| SUPER_ADMIN / OWNER / Admin | ✅ | ✅ | ✅ |
| Akuntan | ✅ | ✅ | ✅ |
| Kepala Cabang / Kepala & Kasir / Kepala Marketing | ✅ | ❌ | ❌ |
| **Sales & Compliance** | ✅ | ❌ | ✅ |
| Kasir / Teller Dalam / Teller Luar | ✅ | ❌ | ❌ |
| Kurir | ❌ | ❌ | ❌ |

⚠️ Sama seperti catatan di Bagian 1: role name `"Sales & Compliance"` saat ini berbagi konstanta `KASIR_PERMISSIONS` bareng Kasir/Teller Dalam/Teller Luar. Karena butuh permission unik (`bank.daily_input`) yang cuma dipunya Sales & Compliance, konstanta ini juga perlu dipecah jadi milik sendiri (`SALES_COMPLIANCE_PERMISSIONS`), terpisah dari `KASIR_PERMISSIONS`/`TELLER_DALAM_PERMISSIONS`/`TELLER_LUAR_PERMISSIONS`.

### API & UI — Bagian 2

- `GET /api/bank-harian?branchId=&date=` — list `BankAccount` aktif + entry hari itu (kalau ada) + entry sebelumnya (buat delta referensi)
- `POST /api/bank-harian` — body `{ branchId, date, entries: [{ bankAccountId, balance, tarikCek?, note? }] }`, upsert `DailyBankEntry` (reuse `dailyBankEntryRepository`)
- `src/app/[locale]/(dashboard)/dashboard/bank-harian/page.tsx` — server component, scoped by branch/role
- `src/components/admin/bank/daily-bank-form.tsx` — client form: input saldo + delta live, terpisah total dari `daily-stock-form.tsx` (tidak import/depend ke currency stock)
- Sidebar: entri baru "Bank Harian" (gated `bank.daily_input` atau `bank.view`), ditempatkan berdampingan dengan "Stockist" tapi **tidak** jadi sub-menu Stockist — biar jelas kelihatan 2 modul terpisah.

---

## 🎯 Goal — Bagian 3: Tunai (Kas)

Tab kedua di halaman Stockist yang sama, khusus **uang tunai IDR**. Posisinya di tengah-tengah antara Bagian 1 dan Bagian 2:

- **Sama seperti Stockist**: punya konsep pocket per cabang, dan pocket-nya **entitas sendiri** — bukan reuse `StockistPocket` (walau namanya bisa mirip, mis. cabang bisa punya "Kas Kecil" versi mata uang DAN "Kas Kecil" versi kas rupiah, dua baris data yang beda).
- **Beda dari Stockist**: cuma 1 mata uang (IDR), jadi **tidak ada dimensi currency** — kubusnya 2 dimensi (pocket × tanggal), bukan 3 dimensi (pocket × currency × tanggal).
- **Sama seperti Bank Harian**: cara isinya cuma ketik saldo hari ini per pocket, delta (naik/turun vs hari sebelumnya) **dihitung otomatis oleh kode**. **Tidak** ada klik status "Belum Review/Beda/Benar" seperti Bagian 1 — itu proses reconciliation yang sengaja hanya berlaku ke Stockist mata uang.
- Diisi oleh **Teller Dalam** (role yang sama dengan Bagian 1), jadi izin akses reuse permission Stockist yang sudah ada — **tidak perlu permission baru**.

### Data Model — Bagian 3

File: tetap di `prisma/schema/stockist.prisma` (satu file dengan Bagian 1, karena domain & UI-nya nyatu), 2 model baru yang polanya niru `BankAccount`/`DailyBankEntry` tapi berdiri sendiri:

```prisma
model KasPocket {
  id        String   @id @default(cuid())
  branchId  String
  name      String                // "Kas Besar", "Kas Operasional", dst — daftar sendiri, beda dari StockistPocket
  code      String?
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  branch       Branch          @relation(fields: [branchId], references: [id])
  dailyEntries KasDailyEntry[]

  @@unique([branchId, name])
  @@index([branchId])
}

model KasDailyEntry {
  id        String   @id @default(cuid())
  kasPocketId String
  date      DateTime @db.Date
  balance   Decimal  @default(0)   // saldo tunai hari itu — user cuma isi ini, tanpa dimensi currency
  note      String?
  createdBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  kasPocket KasPocket @relation(fields: [kasPocketId], references: [id])

  @@unique([kasPocketId, date])
  @@index([kasPocketId, date])
}
```

Tidak perlu model mutasi/ledger terpisah (`KasMutation`) di versi awal — sama seperti Bank Harian, cukup snapshot harian. Kalau nanti butuh audit trail lebih detail, tinggal ditambah belakangan tanpa redesain (pola sama seperti `StockistMutation`).

### Alur Bisnis — Bagian 3

1. Teller Dalam buka tab "Tunai (Kas)" di halaman Stockist, pilih tanggal (default hari ini).
2. List semua `KasPocket` aktif cabang itu, tiap baris: nama pocket, **saldo kemarin** (read-only, dari `KasDailyEntry` tanggal sebelumnya, fallback 0 kalau pocket baru), input **"Saldo Hari Ini"**, dan **delta** dihitung live (sama persis mekanismenya kaya Bank Harian).
3. Simpan → upsert `KasDailyEntry` per pocket untuk tanggal itu. Autosave on-blur per baris (bukan 1 tombol submit besar), sesuai prinsip UX.
4. Kepala Cabang lihat read-only (permission `stockist.view` yang sama), dengan delta history per pocket.

### Permissions & API/UI — Bagian 3

- **Reuse penuh** `stockist.view` / `stockist.manage` — tidak ada permission baru. Teller Dalam (sudah dapat `stockist.manage` dari Bagian 1) otomatis bisa isi Tunai; Kepala Cabang (`stockist.view`) otomatis bisa lihat.
- `GET /api/stockist/kas?branchId=&date=` — list `KasPocket` + entry hari ini + entry sebelumnya (buat delta)
- `POST /api/stockist/kas/pockets` — buat/kelola `KasPocket` baru (manage only)
- `PATCH /api/stockist/kas` — body `{ kasPocketId, date, balance, note? }`, upsert `KasDailyEntry`
- `src/components/admin/stockist/kas-grid-client.tsx` — tab kedua di `stockist-tabs.tsx`, tabel pocket × (kemarin, hari ini, delta), autosave on-blur

---

## 📋 Implementation Checklist

### Phase 1: Schema (Stockist + Tunai/Kas — Bank Harian tidak butuh migrasi)
- [ ] **1.1** Buat `prisma/schema/stockist.prisma` — model Bagian 1 (`StockistPocket`, `StockistBalance`, `StockistMutation`, `StockistDailyCheck`) + model Bagian 3 (`KasPocket`, `KasDailyEntry`)
- [ ] **1.2** Tambah relasi balik di `business.prisma` (`Branch.stockistPockets`, `Branch.kasPockets`, `Currency.stockist*`)
- [ ] **1.3** `npx prisma migrate dev --name add_stockist_and_kas_module`

### Phase 2: Permissions (Stockist + Kas pakai permission yang sama; Bank Harian permission baru)
- [ ] **2.1** Tambah `STOCKIST_VIEW`, `STOCKIST_MANAGE`, `BANK_DAILY_INPUT` di `src/lib/permissions.ts` (Kas tidak butuh permission baru — reuse `STOCKIST_*`)
- [ ] **2.2** Pecah `KASIR_PERMISSIONS` jadi 4 konstanta terpisah: `TELLER_DALAM_PERMISSIONS`, `TELLER_LUAR_PERMISSIONS`, `SALES_COMPLIANCE_PERMISSIONS`, dan biarkan `KASIR_PERMISSIONS` untuk role "Kasir" murni — hati-hati jangan ubah permission lain yang sudah ada di masing-masing
- [ ] **2.3** Update `ROLE_PERMISSION_MAP` sesuai 2 tabel permission di atas (Stockist & Bank Harian)

### Phase 3: Backend — Stockist (Mata Uang)
- [ ] **3.1** Repository: pocket, balance, mutation, daily-check
- [ ] **3.2** Service `stockist.service.ts`: `applyStockistMutation`, `getOrCreateGridForDate`, `markDailyCheck`, `getBranchAlerts`
- [ ] **3.3** API routes Stockist (lihat daftar di atas), pakai `with-auth`/permission check yang konsisten dengan route lain

### Phase 4: Backend — Bank Harian & Tunai (Kas)
- [ ] **4.1** Tambah method di `dailyBankEntryRepository` (atau repo baru) untuk ambil entry sebelumnya per `bankAccountId` (buat hitung delta)
- [ ] **4.2** `GET/POST /api/bank-harian` — reuse `dailyBankEntryRepository.upsertMany`, tanpa sentuh `BankMutation`
- [ ] **4.3** Repository `kas-pocket.repository.ts` + `kas-daily-entry.repository.ts` (pola sama seperti `dailyBankEntryRepository`, termasuk ambil entry sebelumnya buat delta)
- [ ] **4.4** API routes Kas: `GET/PATCH /api/stockist/kas`, `POST /api/stockist/kas/pockets`

### Phase 5: UI
- [ ] **5.1** Sidebar entry "Stockist" (gated `STOCKIST_VIEW`, halaman punya 2 tab) dan "Bank Harian" (gated `BANK_DAILY_INPUT`/`BANK_VIEW`) — 2 entri sidebar terpisah
- [ ] **5.2** `stockist/page.tsx` + `stockist-tabs.tsx` (wrapper 2 tab)
- [ ] **5.3** `stockist-grid-client.tsx` (tab "Mata Uang": grid + aksi Benar/Beda inline)
- [ ] **5.4** `stockist-pocket-sheet.tsx` (CRUD pocket mata uang, manage only)
- [ ] **5.5** `stockist/history/page.tsx` (riwayat mata uang, paginated)
- [ ] **5.6** `kas-grid-client.tsx` (tab "Tunai (Kas)": tabel pocket × kemarin/hari-ini/delta, autosave on-blur)
- [ ] **5.7** `bank-harian/page.tsx` + `daily-bank-form.tsx` (input saldo + delta live)

### Phase 6: Verifikasi
- [ ] **6.1** Seed 2-3 pocket mata uang contoh di 1 cabang test, coba klik Benar/Beda, cek grid & history
- [ ] **6.2** Seed 2-3 pocket kas contoh, isi saldo 2 hari berturut-turut, pastikan delta kehitung benar & tidak nyampur sama pocket mata uang
- [ ] **6.3** Cek Kepala Cabang login → tab Mata Uang & tab Tunai read-only + alert; halaman Bank Harian read-only
- [ ] **6.4** Login sebagai Sales & Compliance → cuma bisa akses Bank Harian (input saldo), tidak bisa akses Stockist manage
- [ ] **6.5** Isi saldo bank 2 hari berturut-turut, pastikan delta hari ke-2 kehitung benar
- [ ] **6.6** `npm run build` clean, `npm run lint` clean

---

## ❓ Open Items (perlu dikonfirmasi sebelum/saat implementasi)

1. Daftar pocket default per cabang belum ada spesifikasi pasti — apakah tiap cabang isi manual sendiri, atau ada 1 template pocket standar (Kas Kecil, Finance Blue, Finance Orange, Kurir A, Kurir B) yang di-seed otomatis ke semua cabang saat migrasi?
2. Apakah Akuntan perlu lihat lintas cabang (semua cabang sekaligus) atau cukup 1 cabang per waktu seperti Kepala Cabang?
3. Ada batas waktu ("cutoff") tertentu di mana sel yang masih "Belum Review" dianggap telat dan perlu alert lebih tegas (mis. jam 10 pagi)? Saat ini alert hanya menghitung status apa adanya tanpa cutoff waktu.
4. **(Bank Harian)** Kalau belum ada `DailyBankEntry` sama sekali untuk rekening tertentu (rekening baru / hari pertama pakai fitur ini), referensi delta fallback ke `BankAccount.balance` — apakah field itu saat ini datanya akurat/terisi untuk semua rekening yang sudah ada, atau perlu isi ulang manual dulu sebelum go-live?
5. **(Bank Harian)** Field `tarikCek` di form lama itu perannya "cek yang masih ditarik/belum cair" dikurangi dari total aset — apakah tetap dipertahankan persis begitu di form baru, atau ada penyesuaian makna?
6. **(Tunai/Kas)** Daftar pocket kas default per cabang belum ada spesifikasi (mis. "Kas Besar", "Kas Operasional") — sama kaya open item #1 buat Stockist, apakah diisi manual per cabang atau ada template standar?
7. **(Tunai/Kas)** Apakah Kas ini juga butuh alert "belum diisi hari ini" di dashboard Kepala Cabang (mirip alert Belum Review di Stockist), atau cukup ditampilkan sebagai data biasa tanpa alert karena tidak ada proses reconciliation di sini?
