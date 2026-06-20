# KPI System Plan — Pusat Valas Indo Group

Dokumen ini mencakup rancangan lengkap modul KPI untuk 3 PT:
- **PVI** — Pusat Valas Indo
- **PTU** — Pusat Tukar Uang
- **PKD** — Pusat Kirim Duit

---

## 1. Konsep Dasar

Setiap karyawan memiliki **template KPI** berdasarkan PT + jabatan (role) mereka.
Template terdiri dari beberapa **Key Result (KR)**, masing-masing punya bobot (weight).

### Formula Inti

```
% Ach per KR  = Actual / Target
% Score per KR = % Ach × Weight
Total KPI Score = Σ(% Score semua KR)
```

Total KPI Score kemudian dicocokkan ke **Bonus Matrix** untuk menentukan bonus / penalti.

---

## 2. Tipe KR

Semua KR masuk ke salah satu dari 3 tipe berikut:

### Tipe A — OMZET
Input: nominal Rp per minggu (4 minggu).
```
Actual = W1 + W2 + W3 + W4
% Ach  = Actual / Target_Rp
```

### Tipe B — DEDUCTION
Input: jumlah kejadian pelanggaran per minggu (W1–W4).
Ada dua varian:

**Fixed base (100 poin):**
```
Total_violations = W1 + W2 + W3 + W4
Actual = 100 - (Total_violations × penalty_per_unit)
% Ach  = Actual / 100
```

**Dynamic base (Closing Tepat Waktu):**
```
Base   = 4 × hari_kerja_bulan_ini
Actual = Base - (hari_terlambat × 4)
% Ach  = Actual / Base
```
Terlambat = melewati jam 06:00 (batas 1 jam setelah jam 05:00).
Dynamic base digunakan **hanya** untuk KR Closing Tepat Waktu (Teller Dalam).

### Tipe C — COUNT
Input: jumlah aktivitas per minggu (W1–W4).
```
Actual = W1 + W2 + W3 + W4
% Ach  = Actual / Target_count
```

---

## 3. KR Catalog per PT × Role

### Bobot (Weight) per KR wajib total = 1.00

---

### PVI — Sales/Marketing

| # | Key Result | Tipe | Target | Penalty | Weight |
|---|-----------|------|--------|---------|--------|
| 1 | Jumlah Omzet | OMZET | Rp 700.000.000 | — | 0.30 |
| 2 | Complain Tracking | DEDUCTION | 100 | -3/komplain | 0.15 |
| 3 | Kesesuaian SOP | DEDUCTION | 100 | -2/kesalahan | 0.20 |
| 4 | Laporan & Rekonsiliasi Tepat Waktu | DEDUCTION | 100 | -2/hari lewat 17:30 | 0.15 |
| 5 | Laporan Compliance Tepat Waktu | DEDUCTION | 100 | -4/kesalahan | 0.10 |
| 6 | Kepuasan Nasabah (survey) | COUNT | 100 survey | — | 0.10 |
| | | | | **Total** | **1.00** |

---

### PVI — Teller Luar

| # | Key Result | Tipe | Target | Penalty | Weight |
|---|-----------|------|--------|---------|--------|
| 1 | Jumlah Omzet | OMZET | Rp 10.000.000.000 | — | 0.35 |
| 2 | Ketelitian Perhitungan | DEDUCTION | 100 | -3/kesalahan | 0.10 |
| 3 | Kesesuaian SOP | DEDUCTION | 100 | -3/kesalahan | 0.15 |
| 4 | Kepuasan Pelanggan (Google Review) | COUNT | 50 poin (2/review) | — | 0.30 |
| 5 | Kebersihan | DEDUCTION | 100 | -5/tempat kotor | 0.10 |
| | | | | **Total** | **1.00** |

---

### PVI — Teller Dalam

| # | Key Result | Tipe | Target | Penalty | Weight |
|---|-----------|------|--------|---------|--------|
| 1 | Closing Tepat Waktu | DEDUCTION | 4 × hari kerja (dynamic) | -4/hari terlambat | 0.45 |
| 2 | Kesesuaian SOP | DEDUCTION | 100 | -2/kesalahan | 0.20 |
| 3 | Kesesuaian Jumlah Kas | DEDUCTION | 100 | -4/hari selisih >100rb | 0.35 |
| | | | | **Total** | **1.00** |

---

### PVI — Kurir

| # | Key Result | Tipe | Target | Penalty | Weight |
|---|-----------|------|--------|---------|--------|
| 1 | Ketepatan Waktu & Jumlah Pengiriman | COUNT | 900 paket | — | 0.70 |
| 2 | Laporan Serah Terima Tepat Waktu | DEDUCTION | 100 | -4/kesalahan | 0.20 |
| 3 | Kesesuaian SOP | DEDUCTION | 100 | -4/kesalahan | 0.10 |
| | | | | **Total** | **1.00** |

---

### PVI — Team Leader Marketing

| # | Key Result | Tipe | Target | Penalty | Weight |
|---|-----------|------|--------|---------|--------|
| 1 | Net Profit Margin | OMZET | Rp 700.000.000 | — | 0.40 |
| 2 | Ketersediaan Stok Mata Uang | DEDUCTION | 100 | -5/kejadian stok kosong | 0.20 |
| 3 | Complain Nasabah | DEDUCTION | 100 | -5/komplain | 0.15 |
| 4 | Kurs Updating | DEDUCTION | 100 | -5/kali telat update | 0.10 |
| 5 | Team Management (Briefing) | COUNT | 10 briefing | — | 0.10 |
| | | | | **Subtotal** | **0.95** |

> Catatan: total bobot di file asli = 0.95, bukan 1.00. Perlu konfirmasi ke client apakah ada KR yang hilang atau ada yang perlu di-adjust.

---

### PVI — Team Leader PVI (Kepala Cabang)

| # | Key Result | Tipe | Target | Penalty | Weight |
|---|-----------|------|--------|---------|--------|
| 1 | Jumlah Omzet Team | OMZET | Rp 700.000.000.000 | — | 0.40 |
| 2 | Kepatuhan Regulasi SOP | DEDUCTION | 100 | -5/temuan | 0.25 |
| 3 | Resiko Likuiditas | DEDUCTION | 100 | -5/temuan | 0.20 |
| 4 | Efisiensi Pelaporan & Monitoring Kurs | DEDUCTION | 100 | -5/temuan | 0.15 |
| 5 | Team Management (Briefing) | COUNT | 10 briefing | — | 0.10 |
| | | | | **Subtotal** | **1.10** |

> Catatan: total bobot di file asli = 1.10, melebihi 1.00. Perlu konfirmasi ke client.

---

### PTU — Teller Luar
Sama dengan PVI Teller Luar, **kecuali** target omzet berbeda.

| # | Key Result | Tipe | Target | Penalty | Weight |
|---|-----------|------|--------|---------|--------|
| 1 | Jumlah Omzet | OMZET | Rp 85.000.000.000 | — | 0.35 |
| 2 | Ketelitian Perhitungan | DEDUCTION | 100 | -3/kesalahan | 0.10 |
| 3 | Kesesuaian SOP | DEDUCTION | 100 | -3/kesalahan | 0.15 |
| 4 | Kepuasan Pelanggan (Google Review) | COUNT | 50 poin (2/review) | — | 0.30 |
| 5 | Kebersihan | DEDUCTION | 100 | -5/tempat kotor | 0.10 |
| | | | | **Total** | **1.00** |

---

### PTU — Teller Dalam
Sama persis dengan PVI Teller Dalam.

| # | Key Result | Tipe | Target | Penalty | Weight |
|---|-----------|------|--------|---------|--------|
| 1 | Closing Tepat Waktu | DEDUCTION | 4 × hari kerja (dynamic) | -4/hari terlambat | 0.45 |
| 2 | Kesesuaian SOP | DEDUCTION | 100 | -2/kesalahan | 0.20 |
| 3 | Kesesuaian Jumlah Kas | DEDUCTION | 100 | -4/hari selisih >100rb | 0.35 |
| | | | | **Total** | **1.00** |

---

### PTU — Kurir
Sama persis dengan PVI Kurir.

| # | Key Result | Tipe | Target | Penalty | Weight |
|---|-----------|------|--------|---------|--------|
| 1 | Ketepatan Waktu & Jumlah Pengiriman | COUNT | 900 paket | — | 0.70 |
| 2 | Laporan Serah Terima Tepat Waktu | DEDUCTION | 100 | -4/kesalahan | 0.20 |
| 3 | Kesesuaian SOP | DEDUCTION | 100 | -4/kesalahan | 0.10 |
| | | | | **Total** | **1.00** |

---

### PTU — Team Leader Marketing

| # | Key Result | Tipe | Target | Penalty | Weight |
|---|-----------|------|--------|---------|--------|
| 1 | Net Profit Margin | OMZET | Rp 1.000.000.000 | — | 0.40 |
| 2 | Ketersediaan Stok Mata Uang | DEDUCTION | 100 | -5/kejadian | 0.25 |
| 3 | Score OKR Tim Kurir | DEDUCTION | 100 | -5/temuan | 0.20 |
| 4 | Resiko Likuiditas | DEDUCTION | 100 | -5/temuan | 0.15 |
| | | | | **Total** | **1.00** |

> Catatan: target Net Profit Margin PTU TL Marketing tidak ada di file asli, diisi placeholder. Perlu konfirmasi.

---

### PTU — Team Leader PTU (Kepala Cabang)

| # | Key Result | Tipe | Target | Penalty | Weight |
|---|-----------|------|--------|---------|--------|
| 1 | Jumlah Omzet Team | OMZET | Rp 85.000.000.000 | — | 0.40 |
| 2 | Kepatuhan Regulasi SOP | DEDUCTION | 100 | -5/temuan | 0.25 |
| 3 | Complain Nasabah | DEDUCTION | 100 | -5/temuan | 0.20 |
| 4 | Efisiensi Pelaporan & Monitoring | DEDUCTION | 100 | -5/temuan | 0.15 |
| 5 | Team Management (Briefing) | COUNT | 10 briefing | — | 0.10 |
| | | | | **Subtotal** | **1.10** |

> Catatan: sama seperti PVI, total bobot 1.10. Perlu konfirmasi ke client.

---

### PKD — Sales/Marketing

| # | Key Result | Tipe | Target | Penalty | Weight |
|---|-----------|------|--------|---------|--------|
| 1 | Jumlah Omzet | OMZET | Rp 85.000.000.000 | — | 0.30 |
| 2 | Complain Tracking | DEDUCTION | 100 | -3/komplain | 0.15 |
| 3 | Kesesuaian SOP | DEDUCTION | 100 | -2/kesalahan | 0.20 |
| 4 | Laporan & Rekonsiliasi Tepat Waktu | DEDUCTION | 100 | -2/hari lewat 17:30 | 0.15 |
| 5 | Laporan Compliance Tepat Waktu | DEDUCTION | 100 | -4/kesalahan | 0.10 |
| 6 | Kepuasan Nasabah (survey) | COUNT | 100 survey | — | 0.10 |
| | | | | **Total** | **1.00** |

---

### PKD — Team Leader PKD

| # | Key Result | Tipe | Target | Penalty | Weight |
|---|-----------|------|--------|---------|--------|
| 1 | Jumlah Omzet Team | OMZET | Rp 85.000.000.000 | — | 0.40 |
| 2 | Kepatuhan Regulasi SOP | DEDUCTION | 100 | -5/temuan | 0.25 |
| 3 | Complain Nasabah | DEDUCTION | 100 | -5/temuan | 0.20 |
| 4 | Efisiensi Pelaporan & Monitoring | DEDUCTION | 100 | -5/temuan | 0.15 |
| | | | | **Total** | **1.00** |

---

## 4. Bonus Matrix

### PVI

| Role | Score Range | Hasil |
|------|------------|-------|
| Sales/Marketing | 80%–100% | Rp 250.000 |
| | 70%–79% | Safe zone |
| | 10%–69% | Wajib masuk Sabtu |
| | Top #1 (bonus tambahan) | Rp 500.000 |
| Teller Luar | 80%–100% | Rp 250.000 |
| | 60%–79% | Safe zone |
| | 10%–59% | Wajib Sabtu + potong Rp 150.000 |
| | Terbaik (bonus tambahan) | Rp 500.000 |
| Teller Dalam | 80%–100% | Rp 500.000 |
| | 60%–79% | Safe zone |
| | 10%–59% | Wajib Sabtu + potong Rp 300.000 |
| Kurir | 80%–100% | Rp 250.000 |
| | 60%–79% | Safe zone |
| | 10%–59% | Wajib masuk Sabtu |
| | Top #1 (bonus tambahan) | Rp 500.000 |
| Team Leader Marketing | 80%–99% | Rp 500.000 |
| | 60%–79% | Safe zone |
| | 10%–59% | Potong Rp 200.000 |
| Kepala Cabang (TL PVI) | >120% | Rp 1.500.000 |
| | 100%–120% | Rp 1.000.000 |
| | 80%–99% | Rp 500.000 |
| | 60%–79% | Safe zone |
| | 10%–59% | Potong Rp 300.000 |

---

### PTU

| Role | Score Range | Hasil |
|------|------------|-------|
| Teller Luar | 80%–100% | Rp 250.000 |
| | 60%–79% | Safe zone |
| | 10%–59% | Wajib Sabtu + potong Rp 150.000 |
| | Terbaik | Rp 500.000 |
| Teller Dalam | 80%–100% | Rp 250.000 |
| | 60%–79% | Safe zone |
| | 10%–59% | Wajib Sabtu + potong Rp 300.000 |
| Kepala Cabang (TL PTU) | >120% | Rp 1.500.000 |
| | 101%–120% | Rp 1.000.000 |
| | 80%–100% | Rp 500.000 |
| | 60%–79% | Safe zone |
| | 10%–59% | Potong Rp 300.000 |

> Catatan: PTU tidak memiliki bonus matrix untuk Kurir. Perlu konfirmasi.

---

### PKD

| Role | Score Range | Hasil |
|------|------------|-------|
| Sales/Marketing | 80%–100% | Rp 250.000 |
| | 70%–79% | Safe zone |
| | 10%–69% | Wajib masuk Sabtu |
| | Top #1 | Rp 500.000 |
| Kepala Cabang (TL PKD) | >120% | Rp 1.500.000 |
| | 100%–120% | Rp 1.000.000 |
| | 80%–99% | Rp 500.000 |
| | 70%–79% | Safe zone |
| | 10%–69% | Potong Rp 500.000 |

---

## 5. Database Schema (Prisma)

```prisma
// ─── Enums ───────────────────────────────────────────────────

enum PT {
  PVI
  PTU
  PKD
}

enum KpiRole {
  SALES
  TELLER_LUAR
  TELLER_DALAM
  KURIR
  TL_MARKETING
  TL_CABANG
}

enum KrType {
  OMZET       // sum weekly Rp vs target Rp
  DEDUCTION   // 100 (or dynamic) - violations × penalty
  COUNT       // sum weekly count vs target count
}

enum BonusResultType {
  BONUS_CASH
  SAFE_ZONE
  PENALTY_SATURDAY
  PENALTY_DEDUCTION
  TOP_PERFORMER
}

// ─── KPI Template ────────────────────────────────────────────

model KpiTemplate {
  id        String    @id @default(cuid())
  pt        PT
  role      KpiRole
  items     KpiItem[]
  entries   KpiEntry[]

  @@unique([pt, role])
}

model KpiItem {
  id              String      @id @default(cuid())
  templateId      String
  template        KpiTemplate @relation(fields: [templateId], references: [id])

  name            String
  krType          KrType
  weight          Float       // 0.0 – 1.0, semua item dalam template harus total = 1.0

  // Untuk OMZET dan COUNT:
  target          Float?      // Rp amount (OMZET) atau unit count (COUNT)

  // Untuk DEDUCTION:
  basePoints      Int?        // default 100; null = dynamic (4 × hari kerja)
  penaltyPerUnit  Float?      // poin dikurangi per pelanggaran
  isDynamic       Boolean     @default(false) // true = Closing Tepat Waktu

  // Untuk COUNT dengan poin (Google Review):
  pointsPerUnit   Float?      // poin per aktivitas (misal 2/review)

  weeklyData      KpiWeeklyData[]

  @@index([templateId])
}

// ─── KPI Entry (per karyawan per bulan) ──────────────────────

model KpiEntry {
  id            String      @id @default(cuid())
  employeeId    String
  employee      User        @relation(fields: [employeeId], references: [id])
  templateId    String
  template      KpiTemplate @relation(fields: [templateId], references: [id])

  month         Int         // 1–12
  year          Int
  workingDays   Int         // hari kerja bulan tersebut (untuk dynamic base)

  // Hasil kalkulasi (di-compute saat save atau on-demand)
  totalScore    Float?      // 0.0 – 1.0+
  bonusAmount   Int?        // Rp, negatif jika potongan
  bonusResult   BonusResultType?
  isTopPerformer Boolean    @default(false)

  weeklyData    KpiWeeklyData[]

  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@unique([employeeId, templateId, month, year])
  @@index([employeeId])
  @@index([templateId])
}

// ─── Input Data (per KR item per minggu) ─────────────────────

model KpiWeeklyData {
  id        String    @id @default(cuid())
  entryId   String
  entry     KpiEntry  @relation(fields: [entryId], references: [id], onDelete: Cascade)
  itemId    String
  item      KpiItem   @relation(fields: [itemId], references: [id])

  week      Int       // 1, 2, 3, 4
  value     Float     // nominal Rp (OMZET) / jumlah pelanggaran (DEDUCTION) / jumlah aktivitas (COUNT)

  @@unique([entryId, itemId, week])
  @@index([entryId])
}

// ─── Bonus Matrix ─────────────────────────────────────────────

model BonusMatrix {
  id    String      @id @default(cuid())
  pt    PT
  role  KpiRole
  tiers BonusTier[]

  @@unique([pt, role])
}

model BonusTier {
  id            String          @id @default(cuid())
  matrixId      String
  matrix        BonusMatrix     @relation(fields: [matrixId], references: [id])

  minPct        Float           // batas bawah (inclusive), misal 0.80
  maxPct        Float           // batas atas (inclusive), misal 1.00; 999 = tak terbatas
  resultType    BonusResultType
  amount        Int?            // Rp (positif = bonus, negatif = potongan); null untuk safe zone / sabtu
  isTopPerformer Boolean        @default(false) // tier khusus bonus #1 terbaik

  @@index([matrixId])
}
```

---

## 6. Kalkulasi (Logika Server)

```typescript
// Hitung % Ach per KR Item
function calcPctAch(item: KpiItem, weeklyValues: number[], workingDays: number): number {
  const total = weeklyValues.reduce((a, b) => a + b, 0);

  if (item.krType === 'OMZET' || item.krType === 'COUNT') {
    return total / (item.target ?? 1);
  }

  if (item.krType === 'DEDUCTION') {
    const base = item.isDynamic ? 4 * workingDays : (item.basePoints ?? 100);
    const actual = base - total * (item.penaltyPerUnit ?? 0);
    return Math.max(0, actual) / base;
  }

  return 0;
}

// Hitung Total KPI Score
function calcTotalScore(items: KpiItem[], allWeeklyData: Map<string, number[]>, workingDays: number): number {
  return items.reduce((sum, item) => {
    const values = allWeeklyData.get(item.id) ?? [0, 0, 0, 0];
    const pctAch = calcPctAch(item, values, workingDays);
    return sum + pctAch * item.weight;
  }, 0);
}

// Tentukan bonus dari matrix
function resolveBonusTier(tiers: BonusTier[], totalScore: number): BonusTier | null {
  return tiers.find(t => totalScore >= t.minPct && totalScore <= t.maxPct) ?? null;
}
```

---

## 7. UI Flow

### Input KPI Bulanan (per karyawan)
1. Pilih karyawan → sistem auto-load template berdasarkan PT + role
2. Form tampil semua KR dengan kolom Week 1–4
3. Setiap KR punya label tipe dan keterangan penalti
4. Submit → sistem kalkulasi otomatis → tampilkan hasil (score, bonus/penalti)

### Dashboard KPI
- Tabel semua karyawan per bulan: nama, role, total score, bonus/penalti
- Filter per PT, per bulan/tahun
- Highlight merah jika kena penalti, hijau jika bonus

### Manajemen Template
- Admin bisa edit target per KR (tanpa mengubah formula)
- Riwayat perubahan target tersimpan (untuk audit)

---

## 8. Item yang Masih Perlu Dikonfirmasi ke Client

| # | Item | Keterangan |
|---|------|-----------|
| 1 | Bobot TL Marketing PVI total 0.95 | Ada KR yang hilang? |
| 2 | Bobot TL PVI & TL PTU total 1.10 | Ada KR yang dobel bobotnya? |
| 3 | Target Net Profit Margin PTU TL Marketing | Tidak ada di file asli |
| 4 | Bonus matrix PTU Kurir | Tidak ada di file asli |
| 5 | Target omzet PTU (Rp 85 miliar per orang) | Apakah target per teller atau per cabang? |
| 6 | "Top #1" bonus — siapa yang menentukan? | Manual oleh HR, atau otomatis dari ranking? |
| 7 | Apakah Teller PTU & PVI Teller Dalam identik? | Sejauh ini diasumsikan sama |
