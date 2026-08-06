# Authorization — izin per-resource & per-PT

Sistem izin punya **dua sumbu** yang harus selalu dipisah:

1. **Resource** — halaman apa, beserta service/API di baliknya
2. **Scope PT** — PT mana yang berlaku, **terpisah untuk baca dan tulis**

Inilah yang membuat aturan seperti ini bisa dinyatakan:

> Jabatan "Kepala Marketing" di **PT A** boleh **melihat** Saldo Bank Harian milik **PT A dan PT B**,
> tapi hanya boleh **menginput** untuk **PT A**.
> Jabatan bernama sama di **PT B** tidak melihat halaman itu sama sekali.

Baris terakhir jatuh keluar dari model tanpa kolom tambahan: `custom_role` sudah
`@@unique([name, companyId])`, jadi "Role A di PT A" dan "Role A di PT B" adalah
**dua baris jabatan berbeda** dengan matriks izinnya masing-masing.

---

## Berkas kunci

| Berkas | Peran |
|---|---|
| [`src/lib/authz/resources.ts`](../../src/lib/authz/resources.ts) | **Registry resource** — sumber kebenaran tunggal. Tambah halaman = tambah satu entri. |
| [`src/lib/authz/resolve.ts`](../../src/lib/authz/resolve.ts) | Logika resolusi murni (tanpa I/O). Dipakai server *dan* client. |
| [`src/backend/helpers/authz.ts`](../../src/backend/helpers/authz.ts) | Guard: `requireResource` (page), `authorize` (API). |
| [`prisma/schema/authz.prisma`](../../prisma/schema/authz.prisma) | Model `RoleResourcePermission` + enum `ScopeMode`. |
| [`src/components/admin/role-permission-matrix.tsx`](../../src/components/admin/role-permission-matrix.tsx) | UI matriks di halaman Jabatan. |

## Dimensi scope (`scoping` di registry)

Tidak semua resource punya dimensi PT. Setiap entri registry memilih satu:

| `scoping` | Arti | Pilihan di UI |
|---|---|---|
| `"company"` (default) | Datanya milik satu PT | Tidak ada · PT sendiri · PT tertentu · Semua PT |
| `"self"` | Data milik sendiri | Tidak ada · Diizinkan |
| `"global"` | Berlaku lintas seluruh PT; memecahnya per PT menghasilkan konfigurasi yang saling bertentangan | Tidak ada · Global (semua PT) |

`"global"` dipakai oleh:

- **Konfigurasi KPI** dan **Definisi KPI** — bobot dan definisi KPI dipakai
  bersama seluruh PT, jadi memecahnya per PT menghasilkan konfigurasi yang
  saling bertentangan. **Penilaian & Persetujuan KPI tidak termasuk** — lihat
  catatan di bawah;
- seluruh section **Laporan** (Analisis Kinerja, Laporan Finance, Watcher
  Valas) — isinya memang laporan lintas PT: peringkat karyawan antar cabang,
  posisi keuangan konsolidasi, dan kurs pasar yang tidak dimiliki PT mana pun.
  Ketiganya baca saja, tanpa sumbu tulis. Filter `?pt=` di Laporan Finance cuma
  cara membaca laporan yang sama, bukan batas wewenang;
- **Mata Uang & Kurs** (`currency`) dan **Harga Valas** (`currency.price`) —
  tabel `Currency` dan `CurrencyPrice` tidak punya kolom `companyId`: daftar mata
  uang dan harga beli/jual adalah satu himpunan untuk seluruh PT. Keduanya
  sempat company-scoped, dan akibatnya matriks menawarkan "PT sendiri / PT
  tertentu" yang tidak berpengaruh apa pun — hak tulis "untuk PT A saja" tetap
  mengubah harga yang dipakai PT B dan C. Stok valas per cabang **tidak** ikut:
  ia dipecah ke resource tersendiri (`currency.stock`, per PT), karena
  `CurrencyStock` melekat pada cabang dan endpoint-nya memang menyaring per PT.

**Penilaian & Persetujuan KPI** (`kpi.review`) justru `"company"`, berbeda dari
dua resource KPI di atas: yang dibagi seluruh PT adalah *definisi* dan *bobot*
KPI, sedangkan yang dinilai di halaman itu adalah **entri milik karyawan**, dan
karyawan dimiliki satu PT lewat cabangnya. Menjadikannya global berarti setiap
pemegang izin menilai ikut menilai karyawan PT lain — lebih luas daripada
perilaku sebelumnya, yang mengunci peninjau ke PT-nya sendiri.

Hanya role global yang boleh mendelegasikannya — kalau tidak, admin satu PT bisa
memberi dirinya sendiri kendali atas konfigurasi seluruh PT.

**Hitung Gaji** justru `"company"`: gaji dimiliki satu PT, jadi sebuah jabatan
bisa diberi wewenang atas PT tertentu saja. Halamannya menyediakan filter PT
sebelum karyawannya dipilih.

Baik resource `"global"` maupun `payroll.manage` sengaja **tanpa peta `legacy`**.
Konsekuensinya: sebelum dimigrasi pun, hanya role global yang bisa membukanya.
Ini memang perubahan perilaku — lihat catatan rollout di bawah.

## Capability — izin yang bukan halaman

Sebagian izin bukan "boleh membuka halaman X" melainkan **kemampuan tambahan**.
Entri registry-nya diberi `capability: true`, dan matriks menampilkannya sebagai
**satu baris scope** (tanpa sumbu Lihat/Ubah, karena tidak bermakna di sini).

Contoh: `daily.backdate` — boleh mengubah angka input harian untuk tanggal yang
sudah lewat (stock, kas, bank, cross-check). Tetap di-scope per PT, jadi bisa
dibuat "boleh membetulkan tanggal lampau di PT A saja". Sebelumnya kemampuan ini
terkunci ke `isGlobalRole` dan mustahil didelegasikan.

Contoh kedua: `correction.direct` — koreksi angka harian (stock, kas, bank) yang
diajukan pemegang izin ini **langsung berlaku**, tanpa mampir ke antrean
Persetujuan Koreksi. Juga per PT, jadi bisa diberikan ke Kepala Cabang PT
tertentu saja. Jejaknya tidak hilang: pengajuan `CorrectionRequest` tetap dibuat
lalu seketika ditandai `APPROVED` atas nama si pengubah (`correctionService
.applyDirect`), sehingga angka lama, angka baru, alasan, dan pelakunya tercatat
persis seperti koreksi yang di-ACC manual. Owner & Super Admin mendapatkannya
otomatis lewat jalur role global.

Contoh ketiga: `finance.receivable.settle` — boleh **menyatakan dana tertahan
lunas** (dan membatalkannya). Sengaja dipisah dari hak tulis
`finance.receivable`, yang hanya mencakup menambah pihak baru serta mengubah nama
& jumlahnya: kalau keduanya satu sakelar, orang yang mencatat piutang bisa
menghapus piutangnya sendiri dari laporan. Juga per PT.

Perhatikan satu perbedaan penting dari dua capability di atas: pelunasan
**tidak** digerbangi `daily.backdate`. Menandai lunas hutang bertanggal lampau
adalah alur normal modul ini — uangnya memang baru masuk hari ini — bukan
pembetulan angka yang sudah lewat. Yang tetap butuh `daily.backdate` hanyalah
mengubah *isi* baris bertanggal lampau (lihat
[`held-fund-guard.ts`](../../src/backend/helpers/held-fund-guard.ts)).

## Mode scope

| Mode | Arti |
|---|---|
| `NONE` | Tidak ada akses. Menu disembunyikan, API 403. Sama dengan "tidak ada baris". |
| `OWN` | Hanya PT jabatan itu sendiri. |
| `SELECTED` | Daftar PT eksplisit di `viewCompanyIds` / `writeCompanyIds`. |
| `ALL` | Semua PT. Hanya Super Admin/Owner yang boleh memberikannya. |

---

## Cara memakai

### Halaman (server component)

```ts
const authz = await requireResource("bank.daily", "view", locale);

// Scope ikut masuk ke query — bukan sekadar gerbang boolean di depan.
const rows = await prisma.dailyBankEntry.findMany({
  where: { ...authz.where(), date },
});
```

### API route

```ts
const authz = await authorize("bank.daily", "write", { companyId: body.companyId });
if (authz instanceof NextResponse) return authz;
```

Selalu kirim `companyId` saat aksinya menyentuh data satu PT. Tanpa itu, yang
diperiksa hanya "punya akses resource ini", bukan "berhak atas PT ini".

### Aturan yang gampang terlewat

- **Scope harus masuk ke `where`.** `companyFilter` menghasilkan `{ in: [] }`
  saat ditolak — nol baris, gagal ke arah aman.
- **`companyIds === null` berarti semua PT**, bukan "tidak ada". Jangan
  disamakan dengan array kosong.
- **Hak tulis diperiksa per PT, per mutasi** — bukan sekali di awal request.
- Halaman yang bisa berpindah PT harus mengirim **daftar PT yang boleh ditulis**
  ke klien, bukan satu boolean. Lihat `writableCompanyIds` di
  [`bank-page-client.tsx`](../../src/components/admin/stockist/bank-page-client.tsx).

---

## Rollout bertahap (dual-read)

Kolom lama `custom_role.permissions` masih ada dan masih dibaca. Yang menentukan
sistem mana yang berlaku adalah `custom_role.usesResourcePerms`:

- `false` → pakai `permissions[]` lama, lewat peta `legacy` di registry.
  Scope-nya `OWN`, persis seperti perilaku sebelum sistem ini ada.
- `true` → pakai matriks. Resource yang tidak ada di matriks **ditolak**, tidak
  jatuh balik ke izin lama — supaya pencabutan akses benar-benar berlaku.

Penanda ini **wajib eksplisit**. Menyimpulkannya dari "punya baris atau tidak"
akan menghidupkan kembali izin lama begitu seluruh izin sebuah jabatan dicabut.

Role global (Super Admin, Owner) selalu `ALL` lewat `isGlobalRole`, terlepas dari
matriks. Ini jaring pengaman yang disengaja: salah konfigurasi tidak boleh
mengunci semua orang keluar.

### Langkah migrasi

```bash
npx prisma migrate deploy
```

```bash
npx tsx prisma/scripts/backfill-resource-permissions.ts
```

```bash
npx tsx prisma/scripts/backfill-resource-permissions.ts --apply
```

Tanpa `--apply` script hanya menampilkan rencana. Aman diulang.

### Memigrasi satu halaman

1. Pastikan resource-nya ada di registry, dengan peta `legacy` yang **persis**
   sama dengan gerbang yang berlaku sekarang — jangan diperlebar.
2. Ganti `requirePageCaller(PERMISSIONS.X)` → `requireResource("key", "view")`.
3. Ganti `getScopedCompanies(caller)` → `getScopedCompaniesFor(authz)`.
4. Ganti `requirePermission(PERMISSIONS.X)` di API → `authorize("key", action, { companyId })`.
5. Masukkan `authz.where()` ke setiap query, dan `authz.canWrite(companyId)` ke setiap mutasi.

### Status migrasi

| Modul | Resource | Scope |
|---|---|---|
| Saldo Bank Harian | `bank.daily` | per PT, view/edit terpisah |
| Dana Tertahan (Hutang) | `finance.receivable` + capability `finance.receivable.settle` | per PT, view/edit terpisah; hak "lunas" izin tersendiri |
| Transaksi Valas (Jual & Beli) | `valas.transaction` + capability `valas.transaction.void` | per PT, view/edit terpisah; hak "batalkan" izin tersendiri |
| Stock & Kas Harian | `stockist.daily` | per PT, view/edit terpisah |
| Cross-Check Stock | `stockist.verify` | per PT |
| Rekening Bank | `bank.accounts` | per PT |
| Stock Management (PT) | `stock.pt` | per PT |
| Hitung Gaji | `payroll.manage` | per PT |
| Patokan Harga | `price.benchmark` | global |
| Persetujuan Koreksi | `correction` | global |
| Konfigurasi KPI | `kpi.config` | global |
| Definisi KPI | `kpi.definitions` | global |
| Penilaian & Persetujuan KPI | `kpi.review` | per PT, view/edit terpisah |
| Input KPI Saya | `kpi.self` | milik sendiri |
| Analisis Kinerja | `kpi.analytics` | global |
| Laporan Finance | `finance.report` | global |
| Watcher Valas | `watcher.valas` | global |
| Presensi (sendiri & semua) | `attendance.self`, `attendance.all` | milik sendiri · per PT |
| Pengguna & Detail Karyawan | `users`, `users.detail` | per PT |
| Cabang | `branches` | per PT |
| PT & Jabatan | `companies`, `roles` | global |
| Mata Uang & Harga Valas | `currency`, `currency.price` | global |
| Stok Valas per Cabang | `currency.stock` | per PT |
| Komponen Gaji | `payroll.components` | per PT |

Seluruh halaman dashboard kini dijaga `requireResource` — `requirePageCaller`
sudah tidak dipakai satu pun halaman. `/api/stock-items` &
`/api/stock-mutations` yang dulu tercatat di sini sudah tidak ada.

Sisa jalur lama yang masih hidup: bagian **absensi & KPI di Detail Karyawan**
masih membaca `authz.subject.legacyPermissions` untuk memutuskan apa yang
ditampilkan (lihat komentar di halamannya).

Catatan yang masih terbuka: matriks izin belum menampilkan baris **Ubah** untuk
resource `scoping: "global"`, jadi hak tulis pada resource global belum bisa
didelegasikan lewat UI. Tidak menghambat section Laporan yang seluruhnya baca
saja, dan tidak lagi menghambat KPI sejak `kpi.review` menjadi per-PT — tapi
masih perlu dibereskan untuk `currency`/`currency.price`, yang hak tulisnya
sekarang hanya bisa diberikan oleh Super Admin/Owner.

Halaman **Saldo Bank Harian** sudah dimigrasi penuh — pakai sebagai contoh:
[page](<../../src/app/[locale]/(dashboard)/dashboard/stockist/bank/page.tsx>) ·
[API](../../src/app/api/bank-harian/route.ts) ·
[service](../../src/backend/services/bank-harian.service.ts)
