# Spesifikasi Rule Engine Slip Gaji

Dokumen ini adalah acuan tunggal untuk menulis, memvalidasi, dan menjelaskan
rule perhitungan slip gaji. Baca seluruhnya sebelum membuat atau mengubah rule.

---

## 0. Peran kamu

Kamu bertugas untuk salah satu dari tiga hal:

1. **Menulis rule baru** dari deskripsi kebijakan HR dalam bahasa manusia
2. **Memvalidasi rule** yang sudah ada terhadap aturan di dokumen ini
3. **Menjelaskan hasil perhitungan** ke karyawan atau HR berdasarkan record yang tersimpan

Batas kewenangan yang tidak boleh dilanggar:

- Kamu **tidak menghitung uang**. Perhitungan dilakukan oleh engine. Kamu hanya
  menyusun konfigurasi rule, atau membacakan hasil yang sudah dihitung engine.
- Kamu **tidak menebak nama tabel atau kolom**. Kalau tidak tahu, tanya.
- Query yang kamu tulis **hanya boleh membaca**. `SELECT` saja — lihat bagian 4.

---

## 1. Alur eksekusi

```
Sumber data (presensi, KPI, dst.) — sistem perusahaan
        ↓
File rule .json di repo  →  divalidasi saat dimuat
        ↓
[1x per bulan] Engine jalan: setiap rule yang menyasar karyawan itu dievaluasi
        ↓
Semua hasil + alasannya disimpan sebagai entri slip (PayrollSlipEntry)
        ↓
Slip difinalkan → dibayar → run ditandai PAID
```

### Rule hidup di database, dengan tiga penjaga

> **Revisi.** Versi pertama dokumen ini menyimpan rule sebagai file `.json` di
> `config/payroll-rules/`, supaya perubahan kebijakan gaji melewati review kode.
> Itu ditinggalkan: HR harus bisa mengganti nominal bonus tanpa menunggu
> developer dan deploy, dan jejak yang benar-benar dibutuhkan saat gaji
> disengketakan bukan riwayat git melainkan `inputs` di `PayrollSlipEntry` —
> yang memang sudah tersimpan.
>
> **Revisi kedua.** Berkas `.json` itu sudah dihapus seluruhnya. Isi awal
> database sekarang berupa modul TypeScript di `prisma/seeds/payroll-rules/`
> (`umum.ts`, `pvi.ts`, `ptu.ts`, `pkd.ts`, `top-performer.ts`, dengan bahan
> bersama di `kpi-source.ts`), ditulis ke database oleh
> `payroll-rules.seeder.ts`. Bentuk rule pada dokumen ini tetap berlaku —
> yang berubah hanya bahasanya, dari JSON menjadi objek TypeScript bertipe,
> sehingga salah ketik nama field ketahuan saat kompilasi. Padanan namanya:
> `id` → `ruleKey`, `berlaku_dari` → `effectiveFrom`,
> `tier_field` → `tierField`, `per_unit` → `perUnit`, `unit_field` →
> `unitField`, `konstanta` → `constants`, `guard` → `guards`, `default` →
> `defaults`, `for` → `targets`, `except` → `excepts`, `catatan` → `note`.

Rule disimpan di tabel `PayrollRule` + `PayrollRuleTier`
(`prisma/schema/payroll-rule.prisma`). Yang menggantikan jaminan git:

- **Append-only.** Menyimpan perubahan membuat VERSI BARU dan menutup masa
  berlaku versi lama. Tidak ada `UPDATE`, tidak ada `DELETE`. Slip yang sudah
  dibayar merujuk `ruleKey@version` dan tetap bisa menjelaskan angkanya.
  `changeNote` menggantikan pesan commit.
- **Tanda tangan.** Setiap baris membawa HMAC-SHA256 atas seluruh isinya —
  termasuk tier. Baris yang disunting langsung lewat klien SQL gagal verifikasi
  dan **ditolak engine**, lalu muncul sebagai error di halaman Rule. Yang
  dilindungi integritas, bukan kerahasiaan: isi rule memang ditampilkan.
- **Izin terpisah.** `payroll.rules` membuka tier, nominal, sasaran, dan masa
  berlaku. Query SQL butuh capability tersendiri, `payroll.rules.sql` —
  SQL menentukan APA yang diukur, tier menentukan BERAPA harganya, dan keduanya
  butuh keahlian berbeda. Pemanggil tanpa capability itu tidak bisa mengubah
  SQL sama sekali; nilai lama dipertahankan paksa di service, bukan sekadar
  disembunyikan di UI.

Validasi (bagian 8) tetap dijalankan **setiap kali rule dimuat**, bukan hanya
saat disimpan. Baris bisa berubah lewat jalur yang tidak diduga; yang menentukan
uang keluar atau tidak harus diperiksa di titik ia dipakai.

### Soal periode yang sudah dibayar

Slip yang sudah dibayar tetap tersimpan lengkap dengan `inputs` — nilai-nilai
yang dipakai engine saat itu. Kalau ada sengketa, payroll **boleh** di-generate
ulang; hasilnya menjadi run baru, run lama tidak ditimpa.

Yang harus dipahami saat menjelaskan ke karyawan: **hasil generate ulang bisa
berbeda dari yang dibayar**, karena data sumbernya mungkin sudah dikoreksi
sejak itu (presensi diperbaiki HR, skor KPI direvisi). Itu bukan kesalahan
engine. Karena `inputs` ikut tersimpan di run lama, selisihnya bisa ditunjukkan
angka per angka — bukan diperdebatkan.

---

## 2. Skema rule

```json
{
  "id": "bonus_kehadiran",
  "versi": 3,
  "berlaku_dari": "2026-01-01",
  "berlaku_sampai": null,
  "mode": "agregat",

  "query": {
    "sql": "SELECT ... WHERE \"userId\" = :employee_id AND \"date\" BETWEEN :periode_awal AND :periode_akhir",
    "expect": "one_row"
  },

  "guard": [
    { "if": "hari_tercatat == 0", "aksi": "skip", "flag": "data_kosong" }
  ],

  "tier_field": "hari_hadir",
  "tiers": [
    { "min": 23,            "nominal":  10000, "label": "Bonus kehadiran di atas standar" },
    { "min": 19, "max": 22, "nominal":      0, "label": "Kehadiran standar" },
    { "max": 18,            "nominal": -10000, "label": "Potongan kehadiran di bawah standar" }
  ],
  "default": { "nominal": 0, "flag": "butuh_review" },

  "for":    [{ "company": ["PT-A"], "branch": "*", "roles": ["staff", "supervisor"] }],
  "except": [{ "roles": ["direksi"] }]
}
```

### Penjelasan field

| Field | Wajib | Keterangan |
|---|---|---|
| `id` | ya | Identitas rule. Stabil sepanjang umur rule; tidak berubah saat versi naik. |
| `versi` | ya | Naik setiap kali isi rule berubah. Ikut tersimpan di entri hasil. |
| `berlaku_dari` | ya | Tanggal mulai berlaku. Engine memilih versi yang berlaku pada periode yang dihitung. |
| `berlaku_sampai` | tidak | `null` berarti masih berlaku. |
| `mode` | ya | `agregat` atau `per_baris`. Lihat bagian 3. |
| `query` | ya | Pengambilan data. Hanya `SELECT`. Lihat bagian 4. |
| `konstanta` | tidak | Angka bernama yang dipakai formula. Lihat bagian 5. |
| `guard` | tidak | Kondisi bebas yang dinilai sebelum tier. Bisa membatalkan rule (`skip`) atau langsung menetapkan nominal (`terapkan`). |
| `tier_field` | ya | Nama kolom hasil query yang dipakai untuk mencocokkan tier. |
| `tiers` | ya | Rentang nilai → nominal atau formula. Wajib eksklusif dan menyeluruh. |
| `default` | ya | Dipakai kalau tidak ada tier yang cocok. Wajib ada. |
| `for` | ya | Sasaran rule. Lihat bagian 6. |
| `except` | tidak | Pengecualian. Selalu menang atas `for`. |

### Rule tidak punya tipe — arah uang milik kondisi

Sebuah rule bukan "rule bonus" atau "rule denda". Yang menentukan menambah atau
mengurangi gaji adalah **tanda nominal pada tier/guard yang cocok**: positif
menambah, negatif mengurangi. Contoh di atas menunjukkannya dalam satu rule —
tier `>= 23` membonus Rp 10.000, tier `<= 18` memotong Rp 10.000.

Ini berlaku untuk ketiga cara menghitung: `nominal`, `per_unit`, dan `formula`
yang menghasilkan angka negatif sama-sama mengurangi.

Sebelumnya arah ditentukan kolom `tipe` di tingkat rule, dan akibatnya setiap
jabatan butuh **sepasang** rule — `bonus_kpi_pvi_teller_dalam` dan
`denda_kpi_pvi_teller_dalam` — yang menyalin SQL, guard, dan sasaran yang sama
persis. Dua tempat yang harus diubah bersamaan setiap satu band bergeser, tanpa
apa pun yang menjamin keduanya tetap sinkron. Sheet manajemen sendiri menulisnya
sebagai satu tabel; sekarang rule-nya mengikuti.

Pos di slip diturunkan dari tanda tiap entri: entri bernilai positif masuk pos
penambahan, negatif masuk pos pengurangan.

---

## 3. Mode

### `mode: "agregat"`

Query mengembalikan **satu baris**. Nilai `tier_field` dicocokkan sekali,
menghasilkan satu entri hasil.

Untuk aturan berbasis total sebulan: total kehadiran, skor KPI, peringkat
karyawan, total hari alpha.

### `mode: "per_baris"`

Query mengembalikan **banyak baris** (biasanya satu baris per hari atau per
kejadian). Setiap baris dievaluasi terhadap tier, hasilnya dijumlahkan menjadi
satu entri, dengan rincian per baris ikut tersimpan di `breakdown`.

Untuk aturan berbasis kejadian: denda keterlambatan berjenjang.

Pada mode ini tier boleh memakai `per_unit` alih-alih `nominal`:

```json
"tiers": [
  { "min": 1, "max": 3, "per_unit": -1000, "unit_field": "menit_telat",
    "label": "Denda keterlambatan (pelanggaran ke-1 s/d ke-3)" },
  { "min": 4,           "per_unit": -2000, "unit_field": "menit_telat",
    "label": "Denda keterlambatan (pelanggaran ke-4 dan seterusnya)" }
]
```

Hasil per baris = `per_unit × nilai(unit_field)`.

Di contoh ini `tier_field` adalah nomor urut pelanggaran dalam periode, dan
`unit_field` adalah menit keterlambatan pada kejadian itu.

`default` pada mode ini berlaku **per baris** — baris yang tidak cocok tier mana
pun memakai `default`, bukan seluruh entri dibatalkan.

---

## 4. Aturan penulisan query

### Hanya baca, dan hanya dari view `hv_*`

Query rule adalah alat **pengumpul informasi**, bukan alat mengubah data.

Penegak sesungguhnya adalah **database**, bukan validator: query dijalankan
lewat koneksi `DATABASE_VIEW_ONLY_URL` (user `oc_pvi_reader`) yang hanya punya
`SELECT` atas view `hv_*` — lihat `sql/openclaw_setup.sql`. Rule paling jahat
sekalipun tidak bisa menulis apa pun dan tidak bisa menyentuh data auth. Engine
**tidak** jatuh balik ke koneksi aplikasi kalau env itu kosong: fallback diam-
diam justru menghapus batas yang dijaga di sini.

Validasi tetap ada supaya kesalahan ketahuan saat rule DISIMPAN — dengan pesan
yang menyebut nama tabelnya — bukan berupa error izin database saat payroll
sedang berjalan:

- Statement wajib dimulai dengan `SELECT` (atau `WITH ... SELECT`).
- Setiap sumber baris setelah `FROM`/`JOIN` wajib berawalan `hv_` (nama CTE
  dikecualikan, karena ia hasil SELECT yang isinya ikut diperiksa).
- Dilarang memuat `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`,
  `CREATE`, `GRANT`, `COPY`, atau `;` di tengah statement (satu statement saja).

### Wajib

**Selalu batasi periode.** Tanpa filter periode, agregat akan menjumlahkan
seluruh riwayat karyawan sejak dia masuk kerja. Ini gagal tanpa error — angkanya
sekadar salah, dan makin salah tiap bulan.

```sql
WHERE "userId" = :employee_id
  AND "date" BETWEEN :periode_awal AND :periode_akhir
```

**Selalu pakai named parameter**, jangan `?` posisional. Parameter yang tersedia:

| Parameter | Isi |
|---|---|
| `:employee_id` | id karyawan yang sedang dihitung |
| `:periode_awal` | tanggal awal periode (inklusif) |
| `:periode_akhir` | tanggal akhir periode (inklusif) |
| `:periode_bulan` | bulan periode sebagai angka 1–12 |
| `:periode_tahun` | tahun periode sebagai angka |
| `:company_id` | PT karyawan tersebut |
| `:branch_id` | cabang karyawan tersebut |
| `:custom_role_id` | jabatan karyawan tersebut |

Tiga parameter terakhir ada supaya rule bisa membandingkan karyawan dengan
rekan sejawatnya — misalnya menentukan peringkat KPI dalam satu jabatan di satu
PT (lihat Lampiran C).

**Selalu eksplisitkan status mana yang dihitung.** Jangan menyandarkan makna pada
isi kolom mentah:

```sql
SUM(CASE WHEN status IN ('PRESENT','WFH','LEAVE') THEN 1 ELSE 0 END) AS hari_hadir
```

**Selalu kembalikan penanda ada-tidaknya data**, terpisah dari nilainya:

```sql
COUNT(*) AS hari_tercatat
```

**Query mode agregat wajib mengembalikan tepat satu baris**, termasuk saat tidak
ada data sama sekali. Agregat tanpa `GROUP BY` sudah memenuhi ini. Kalau
query-mu memakai `GROUP BY`, bungkus supaya baris kosong tetap menghasilkan satu
baris — kalau tidak, `guard` tidak punya apa pun untuk dievaluasi.

### Cuti sah dan kehadiran

Cuti tahunan adalah hak karyawan. Rule yang membuat karyawan kehilangan bonus
karena memakai cuti resminya bermasalah secara kewajaran maupun kepatuhan.

Default: **cuti sah dihitung sebagai hadir**. Kalau HR memutuskan sebaliknya,
itu keputusan sadar yang harus tertulis di kebijakan, bukan efek samping dari
cara query ditulis.

### NULL bukan nol

`SUM` atas nol baris mengembalikan `NULL`, bukan `0`. Menambalnya dengan
`COALESCE(...,0)` justru berbahaya: karyawan yang baru masuk tanggal 25 akan
terbaca kehadiran 0 dan kena potongan penuh.

Aturannya: pakai `COALESCE` supaya perbandingan tidak error, **tapi** pasang
`guard` untuk membedakan "tidak ada data" dari "benar-benar nol".

```json
"guard": [
  { "if": "hari_tercatat == 0", "aksi": "skip", "flag": "data_kosong" },
  { "if": "karyawan.tgl_masuk > periode.awal", "aksi": "skip", "flag": "karyawan_baru" }
]
```

`aksi: "skip"` berarti rule tidak menghasilkan nominal, tapi **tetap tercatat**
sebagai entri berstatus `SKIPPED` beserta flag-nya, dan karyawan masuk antrian
review manusia. Slip harus bisa menjelaskan kenapa sebuah rule tidak jalan, bukan
diam saja. **Kalau engine tidak yakin, engine tidak boleh memotong uang.**

### `aksi: "terapkan"` — kondisi yang langsung menetapkan nominal

Guard tidak hanya bisa membatalkan. `aksi: "terapkan"` memakai `nominal` atau
`formula` guard itu sendiri, lalu **berhenti** — tier tidak dicocokkan sama
sekali. Tandanya menentukan arah, persis seperti tier.

```json
"guard": [
  {
    "if": "berkontrak == 0 and skor_persen >= 86",
    "aksi": "terapkan",
    "nominal": 0,
    "label": "Skor mencukupi, tapi bonus belum bisa dibayar — belum berkontrak",
    "flag": "belum_berkontrak"
  }
]
```

Ini ada karena tier hanya bisa mencocokkan **rentang pada satu kolom**
(`tier_field`). Syarat yang menyangkut kolom lain — atau menggabungkan beberapa
kolom sekaligus, seperti contoh di atas — tidak bisa dinyatakan sebagai tier
tanpa memelintir query supaya semuanya muat di satu angka.

#### Menggabungkan kondisi: `and` dan `or`

Ditulis sebagai kata, bukan `&&`/`||`. `and` mengikat lebih erat daripada `or`,
sama seperti SQL, jadi `a == 1 and b == 2 or c == 3` dibaca
`(a == 1 and b == 2) or c == 3`. Pakai kurung kalau maksudnya lain.

Keduanya **tidak hubung-singkat** — kedua sisi selalu dievaluasi. Itu disengaja:
`berkontrak == 0 or skor == 0` dengan hubung-singkat akan menjawab "benar"
walaupun `skor` tidak ada nilainya, sehingga rule membayar berdasarkan data yang
separuhnya hilang. Lebih baik rule berhenti dan minta diperiksa.

> **Rule lama.** Sebelum kedua operator ini ada, kondisi majemuk ditulis dengan
> memanfaatkan perbandingan yang mengembalikan `1`/`0`: `(A) * (B) == 1` sebagai
> AND dan `(A) + (B) >= 1` sebagai OR. Bentuk itu **tetap sah** dan rule yang
> sudah tersimpan tidak perlu diubah. Tapi jangan menulis yang baru dengan cara
> itu: `(A) + (B) == 1` beda satu karakter dari OR, artinya XOR, lolos validasi,
> dan salahnya baru kelihatan di slip seseorang.

Perhatikan kenapa contoh itu memakai `terapkan` bernominal 0, bukan `skip`.
Rule yang sama juga memuat tier potongan untuk skor rendah; kalau syarat kontrak
membatalkan seluruh rule, karyawan yang belum berkontrak ikut lolos dari
potongan — padahal potongan berlaku bagi siapa pun. Kondisi itu karena itu
dibatasi pada band yang berbonus saja.

Aturan bentuknya:

- `nominal` **atau** `formula`, tepat satu. Mengisi keduanya adalah error.
- `label` wajib — ia yang tampil di slip sebagai alasan.
- `flag` tetap wajib, dan tetap dibawa meski entrinya `APPLIED`: `terapkan`
  sering dipakai untuk keadaan yang justru ingin dilihat HR.
- `mandatory_saturday` / `warning_letter` boleh menyertainya, sama seperti tier.

Guard **hanya berlaku di `mode: "agregat"`**. Engine tidak menilainya di
`per_baris`, jadi validator menolak rule `per_baris` yang memasang guard —
membiarkannya lolos berarti syarat yang ditulis HR tidak pernah berjalan, tanpa
error dan tanpa jejak di mana pun.

---

## 5. Nominal, per_unit, dan formula

Setiap tier menentukan hasilnya lewat **salah satu** dari tiga cara. Mengisi
lebih dari satu adalah error validasi.

| Cara | Dipakai untuk | Berlaku di mode |
|---|---|---|
| `nominal` | angka tetap | keduanya |
| `per_unit` + `unit_field` | angka per satuan pada baris itu | `per_baris` |
| `formula` | angka yang dihitung dari nilai lain | keduanya |

### `formula`

Untuk hal yang nilainya bergantung pada angka lain — uang makan yang mengikuti
jumlah hari masuk, potongan proporsional, bonus berbasis persentase gaji pokok.

```json
{
  "id": "uang_makan_prorata",
  "mode": "agregat",
  "konstanta": { "hari_kerja_standar": 24 },
  "tier_field": "hari_hadir",
  "tiers": [
    {
      "min": 0,
      "formula": "(karyawan.uang_makan / hari_kerja_standar) * hari_hadir",
      "label": "Uang makan sesuai hari masuk"
    }
  ],
  "default": { "nominal": 0, "flag": "butuh_review" }
}
```

Kalau uang makan bulanan 600.000 dengan standar 24 hari kerja dan karyawan masuk
10 hari, entri hasilnya 250.000 — dan `inputs` menyimpan `hari_hadir: 10`,
`karyawan.uang_makan: 600000`, `hari_kerja_standar: 24`, sehingga slip bisa
menunjukkan asal angkanya.

### Yang boleh dipakai di dalam formula

**Operator:** `+` `-` `*` `/` `%` dan tanda kurung. Tidak ada operator lain.

Perbandingan (`==`, `>`, …) dan `and`/`or` **dilarang di dalam formula** — itu
milik `guard`. Formula menghasilkan rupiah; kalau ia boleh menghasilkan
benar/salah, nominal `1` dan `0` akan tercampur dengan Rp 1 dan Rp 0.

**Fungsi:** `min(a, b)`, `max(a, b)`, `round(x)`, `floor(x)`, `ceil(x)`,
`abs(x)`. Tidak ada fungsi lain.

**Nilai yang bisa dirujuk:**

| Sumber | Contoh | Keterangan |
|---|---|---|
| kolom hasil query | `hari_hadir` | untuk `per_baris`, kolom baris yang sedang dievaluasi |
| `konstanta.*` | `hari_kerja_standar` | boleh ditulis tanpa awalan `konstanta.` |
| `karyawan.*` | `karyawan.gaji_pokok` | lihat daftar di bawah |
| `periode.*` | `periode.jumlah_hari` | `awal`, `akhir`, `jumlah_hari` |

Field `karyawan.*` yang tersedia: `gaji_pokok`, `uang_makan`, `uang_transport`,
`tunjangan_jabatan`, `bpjs_kesehatan`, `tgl_masuk`. Semuanya nilai bulanan tetap
yang tersimpan di data karyawan.

**Yang dilarang:** pemanggilan fungsi di luar daftar, akses properti berantai,
string, dan segala bentuk ekspresi yang butuh dieksekusi sebagai kode. Formula
diurai menjadi pohon ekspresi dan dievaluasi oleh engine — **bukan** diserahkan
ke `eval` atau sejenisnya.

### Pembulatan

Hasil formula dibulatkan ke rupiah terdekat (0,5 dibulatkan ke atas). Kalau
kebijakan menghendaki pembulatan lain, tulis eksplisit di formula dengan
`floor`/`ceil` — jangan mengandalkan perilaku default.

### Nilai kosong di dalam formula

Kalau ada rujukan yang bernilai `NULL` (misalnya karyawan belum diisi
`uang_makan`), engine **tidak** menganggapnya nol. Rule di-`skip` dengan flag
`nilai_tidak_lengkap` dan masuk antrian review. Alasannya sama seperti aturan
NULL di bagian 4: menebak nol menghasilkan potongan yang tidak pernah diniatkan
siapa pun.

---

## 6. Targeting: `for` dan `except`

### Semantik

```
match = any(for) AND NOT any(except)
```

- `for` adalah **array grup**. Antar grup bersifat **OR**.
- Di dalam satu grup, semua field bersifat **AND**.
- `"*"` berarti cocok dengan apa saja.
- `except` **selalu menang** atas `for`, tanpa memandang urutan.

### Contoh

Role A di PT-A saja. Role A di PT-B tidak kena:

```json
"for": [{ "company": ["PT-A"], "branch": "*", "roles": ["A"] }]
```

Kombinasi berbeda per perusahaan — pakai dua grup:

```json
"for": [
  { "company": ["PT-A"], "branch": "*", "roles": ["A"] },
  { "company": ["PT-B"], "branch": "*", "roles": ["B"] }
]
```

Semua branch kecuali satu — baru pakai `except` kalau enumerasinya panjang:

```json
"for":    [{ "company": ["PT-A"], "branch": "*", "roles": ["A"] }],
"except": [{ "branch": ["A"] }]
```

Kalau branch-nya sedikit, **lebih baik dienumerasi** di `for` daripada memakai
`except`. Lebih mudah dibaca dan lebih sulit salah.

### Kalau beberapa rule menyasar karyawan yang sama

Tidak ada yang saling meniadakan. **Semua rule yang cocok dijalankan**, dan
masing-masing menghasilkan entri sendiri di slip. Karyawan bisa saja pada bulan
yang sama mendapat bonus kehadiran, kena denda keterlambatan, dan mendapat bonus
peringkat KPI — tiga entri, tiga alasan, semua tampil.

Tidak ada mekanisme pemenang, tidak ada skor spesifisitas, tidak ada prioritas.
Kalau dua rule ternyata menghitung hal yang sama dua kali, itu masalah
kebijakan yang harus diselesaikan dengan menghapus salah satu rule — bukan
diselesaikan diam-diam oleh engine.

Karena itu urutan rule di dalam folder tidak memengaruhi hasil. Untuk keterbacaan
slip, entri diurutkan saat ditampilkan: penambahan dulu, lalu pengurangan.

---

## 7. Urutan evaluasi

Untuk setiap karyawan, untuk setiap rule yang berlaku pada periode tersebut:

1. **Targeting** — `any(for) AND NOT any(except)`. Tidak cocok → rule dilewati
   tanpa entri.
2. **Query** — jalankan dengan parameter periode yang sedang dihitung.
3. **Guard** — kalau ada yang kena, catat entri `SKIPPED` beserta flag. Berhenti.
4. **Tier** — cocokkan `tier_field` ke rentang tier.
5. **Hitung** — `nominal`, `per_unit × unit_field`, atau evaluasi `formula`.
6. **Default** — kalau tidak ada tier yang cocok, pakai `default`.
7. **Simpan** — tulis entri hasil beserta seluruh input yang dipakai.

### Bentuk entri hasil

```json
{
  "periode": "2026-08",
  "employee_id": "E-104",
  "rule_id": "bonus_kehadiran",
  "rule_versi": 3,
  "status": "APPLIED",
  "tier_terpilih": "min:23",
  "label": "Bonus kehadiran di atas standar",
  "inputs": { "hari_hadir": 24, "hari_tercatat": 24 },
  "nominal": 10000,
  "flag": null
}
```

`label` inilah yang tampil sebagai alasan di slip gaji. Karena itu label ditulis
di dalam tier, bukan di tempat lain — supaya angka dan alasannya tidak pernah
berbeda.

`inputs` wajib berisi semua nilai yang dipakai untuk sampai ke nominal —
termasuk konstanta dan field `karyawan.*` yang dirujuk formula. Ini yang membuat
slip bisa menjelaskan dirinya sendiri bertahun-tahun kemudian, dan yang membuat
generate ulang bisa dibandingkan dengan yang sudah dibayar.

Untuk `mode: "per_baris"`, entri juga menyimpan `breakdown`: satu baris rincian
per kejadian, lengkap dengan tier dan nominalnya masing-masing.

---

## 8. Validasi wajib saat file rule dimuat

Semua pemeriksaan ini harus gagal **sebelum** payroll jalan, bukan saat jalan:

**Struktur**

- [ ] `mode` harus `agregat` atau `per_baris`.
- [ ] Setiap tier punya `label` yang tidak kosong.
- [ ] Setiap tier mengisi tepat satu dari `nominal`, `per_unit`, atau `formula`.
- [ ] `per_unit` wajib disertai `unit_field`, dan hanya boleh di `mode: per_baris`.
- [ ] `default` wajib ada.
- [ ] Tidak ada dua versi rule dengan `berlaku_dari`/`berlaku_sampai` yang beririsan.
- [ ] Tidak ada dua file dengan `id` + `versi` yang sama.

**Tier**

- [ ] Tier tidak boleh tumpang tindih. `>= 22` dan `== 22` di rule yang sama
      adalah error — kondisi kedua tidak akan pernah tercapai.
- [ ] Tier tidak boleh berlubang. Rentang seperti `>= 22`, `== 22`, `<= 18`
      meninggalkan 19–21 tanpa penanganan.

**Query**

- [ ] Statement dimulai dengan `SELECT` atau `WITH`, dan hanya satu statement.
- [ ] Tidak memuat kata kunci yang mengubah data.
- [ ] Wajib memuat filter periode — minimal satu dari `:periode_awal`,
      `:periode_akhir`, atau pasangan `:periode_bulan` + `:periode_tahun`.
- [ ] Dilarang memakai parameter posisional `?`.
- [ ] Semua named parameter harus ada di daftar yang diizinkan.
- [ ] `tier_field` dan `unit_field` harus ada di kolom hasil query.

**Formula**

- [ ] Formula bisa diurai menjadi pohon ekspresi yang valid.
- [ ] Hanya memakai operator dan fungsi yang diizinkan.
- [ ] Semua nama yang dirujuk ada — sebagai kolom hasil query, `konstanta`,
      `karyawan.*`, atau `periode.*`.
- [ ] Tidak ada pembagian dengan konstanta bernilai nol.

---

## 9. Kesalahan yang paling sering terjadi

**Query tanpa filter periode.** Akibatnya semua karyawan tampak melewati ambang
batas mulai bulan kedua dan seterusnya. Tidak ada error, hanya angka yang salah.

**Tier tumpang tindih.** Kondisi belakangan menjadi mati. Biasanya muncul saat
orang menulis `>=` padahal maksudnya `>`.

**Lubang di antara tier.** Nilai di celah jatuh ke perilaku tak terdefinisi.

**NULL dianggap nol.** Karyawan baru atau data yang belum sinkron kena potongan
penuh padahal tidak melakukan pelanggaran apa pun.

**Cuti sah mengurangi kehadiran.** Karyawan dihukum karena memakai haknya.

**Label ditulis terpisah dari nominal.** Cepat atau lambat slip menampilkan
alasan yang tidak cocok dengan angkanya.

**Dua rule menghitung hal yang sama.** Karena semua rule yang cocok dijalankan,
duplikasi berarti karyawan kena dua kali. Engine tidak akan menyelamatkanmu di
sini — periksa saat menulis rule baru apakah sudah ada rule lain yang menyentuh
angka yang sama.

**Formula memakai angka ajaib.** `(karyawan.uang_makan / 24) * hari_hadir` akan
membingungkan orang setahun lagi. Taruh 24 di `konstanta` dengan nama yang
menjelaskan dirinya.

---

## 10. Yang harus ditanyakan, jangan ditebak

Kalau informasi berikut tidak tersedia, **tanya**, jangan diisi asumsi:

- Nama tabel dan kolom yang sebenarnya
- Nilai apa saja yang mungkin ada di kolom status presensi
- Batas periode: mengikuti bulan kalender atau periode gaji tersendiri
- Kapan penghitung pelanggaran di-reset
- Ada toleransi menit sebelum dihitung terlambat atau tidak
- Apakah cuti sah dihitung hadir
- Angka pembagi pada formula prorata (hari kerja standar per bulan — tetap 24,
  atau mengikuti jumlah hari kerja bulan berjalan)
- Daftar `company`, `branch`, dan `roles` yang valid

Menebak salah satu dari ini menghasilkan rule yang jalan tanpa error tapi
menghitung gaji orang dengan keliru. Itu kegagalan yang jauh lebih mahal
daripada bertanya.

---

## Lampiran: contoh lengkap

Nama tabel dan kolom di bawah mengikuti schema Prisma yang berlaku
(`Attendance`, `KpiMonthlyResult`, `user`). Perhatikan kutip ganda pada
identifier camelCase — PostgreSQL membutuhkannya.

### A. Bonus kehadiran bulanan (mode agregat, nominal tetap)

```json
{
  "id": "bonus_kehadiran",
  "versi": 3,
  "berlaku_dari": "2026-01-01",
  "mode": "agregat",
  "query": {
    "sql": "SELECT COALESCE(SUM(CASE WHEN status IN ('PRESENT','LATE','WFH','LEAVE') THEN 1 ELSE 0 END), 0) AS hari_hadir, COUNT(*) AS hari_tercatat FROM \"Attendance\" WHERE \"userId\" = :employee_id AND \"date\" BETWEEN :periode_awal AND :periode_akhir",
    "expect": "one_row"
  },
  "guard": [
    { "if": "hari_tercatat == 0", "aksi": "skip", "flag": "data_kosong" }
  ],
  "tier_field": "hari_hadir",
  "tiers": [
    { "min": 23,            "nominal":  10000, "label": "Bonus kehadiran di atas standar" },
    { "min": 19, "max": 22, "nominal":      0, "label": "Kehadiran standar" },
    { "max": 18,            "nominal": -10000, "label": "Potongan kehadiran di bawah standar" }
  ],
  "default": { "nominal": 0, "flag": "butuh_review" },
  "for":    [{ "company": ["PT-A"], "branch": "*", "roles": ["staff", "supervisor"] }],
  "except": [{ "roles": ["direksi"] }]
}
```

### B. Denda keterlambatan berjenjang (mode per_baris, per_unit)

Kebijakan: pelanggaran ke-1 sampai ke-3 dikenakan 1.000 per menit, pelanggaran
ke-4 dan seterusnya dikenakan 2.000 per menit.

```json
{
  "id": "denda_keterlambatan",
  "versi": 2,
  "berlaku_dari": "2026-01-01",
  "mode": "per_baris",
  "query": {
    "sql": "SELECT \"date\", menit_telat, ROW_NUMBER() OVER (ORDER BY \"date\") AS urutan_pelanggaran FROM ( ... ) t WHERE ... ORDER BY \"date\"",
    "expect": "many_rows"
  },
  "tier_field": "urutan_pelanggaran",
  "tiers": [
    { "min": 1, "max": 3, "per_unit": -1000, "unit_field": "menit_telat",
      "label": "Denda keterlambatan (pelanggaran ke-1 s/d ke-3)" },
    { "min": 4,           "per_unit": -2000, "unit_field": "menit_telat",
      "label": "Denda keterlambatan (pelanggaran ke-4 dan seterusnya)" }
  ],
  "default": { "nominal": 0, "flag": "butuh_review" },
  "for": [{ "company": "*", "branch": "*", "roles": "*" }]
}
```

Catatan: `menit_telat` **belum ada** sebagai kolom di tabel `Attendance` —
keterlambatan harus diturunkan dari `checkIn` terhadap jadwal masuk. Sumber
jadwal masuk dan toleransi menit perlu ditetapkan sebelum rule ini bisa ditulis
utuh.

### C. Bonus peringkat KPI (mode agregat, peringkat antar karyawan)

Menggantikan `PayrollIncentiveOutcome.TOP_PERFORMER`. Perbandingan antar
karyawan dilakukan di dalam query, bukan oleh engine.

```json
{
  "id": "bonus_peringkat_kpi",
  "versi": 1,
  "berlaku_dari": "2026-01-01",
  "mode": "agregat",
  "query": {
    "sql": "WITH peringkat AS (SELECT r.\"employeeId\", RANK() OVER (ORDER BY r.\"totalScore\" DESC) AS posisi, COUNT(*) OVER () AS jumlah_peserta FROM \"KpiMonthlyResult\" r JOIN \"user\" u ON u.id = r.\"employeeId\" WHERE r.\"month\" = :periode_bulan AND r.\"year\" = :periode_tahun AND u.\"customRoleId\" = :custom_role_id AND u.\"isActive\" = true) SELECT COALESCE(MAX(posisi), 0) AS posisi, COALESCE(MAX(jumlah_peserta), 0) AS jumlah_peserta FROM peringkat WHERE \"employeeId\" = :employee_id",
    "expect": "one_row"
  },
  "guard": [
    { "if": "jumlah_peserta < 3", "aksi": "skip", "flag": "peserta_terlalu_sedikit" },
    { "if": "posisi == 0", "aksi": "skip", "flag": "data_kpi_kosong" }
  ],
  "tier_field": "posisi",
  "tiers": [
    { "min": 1, "max": 1, "nominal": 500000, "label": "Peringkat KPI terbaik di jabatan ini" },
    { "min": 2, "max": 3, "nominal": 250000, "label": "Peringkat KPI 2–3 di jabatan ini" },
    { "min": 4,           "nominal": 0,      "label": "Belum masuk peringkat berbonus" }
  ],
  "default": { "nominal": 0, "flag": "butuh_review" },
  "for": [{ "company": "*", "branch": "*", "roles": "*" }]
}
```

Guard `jumlah_peserta < 3` ada supaya jabatan yang hanya diisi satu orang tidak
otomatis menjadi "peringkat 1".

### D. Uang makan prorata (mode agregat, formula)

```json
{
  "id": "uang_makan_prorata",
  "versi": 1,
  "berlaku_dari": "2026-01-01",
  "mode": "agregat",
  "konstanta": { "hari_kerja_standar": 24 },
  "query": {
    "sql": "SELECT COALESCE(SUM(CASE WHEN status IN ('PRESENT','LATE','WFH') THEN 1 ELSE 0 END), 0) AS hari_hadir, COUNT(*) AS hari_tercatat FROM \"Attendance\" WHERE \"userId\" = :employee_id AND \"date\" BETWEEN :periode_awal AND :periode_akhir",
    "expect": "one_row"
  },
  "guard": [
    { "if": "hari_tercatat == 0", "aksi": "skip", "flag": "data_kosong" }
  ],
  "tier_field": "hari_hadir",
  "tiers": [
    { "min": 0,
      "formula": "min(hari_hadir, hari_kerja_standar) * (karyawan.uang_makan / hari_kerja_standar)",
      "label": "Uang makan sesuai hari masuk" }
  ],
  "default": { "nominal": 0, "flag": "butuh_review" },
  "for": [{ "company": "*", "branch": "*", "roles": "*" }]
}
```

`min(...)` di formula menahan hasil kalau karyawan masuk lebih dari 24 hari —
kalau kebijakannya justru memberi kelebihan, hapus `min` dan tulis alasannya di
`label`. Cuti (`LEAVE`) sengaja tidak dihitung di sini karena uang makan adalah
pengganti biaya harian, bukan hak yang berjalan saat tidak masuk. Kalau HR
memutuskan lain, ubah daftar status di query.

---

*Rule tinggal di tabel `PayrollRule` + `PayrollRuleTier`; isi awalnya di-seed
dari `prisma/seeds/payroll-rules/`. Contoh JSON di dokumen ini adalah bentuk
konseptual — padanan nama fieldnya di TypeScript ada di bagian 1. Nama tabel,
nama kolom, dan nilai status sudah disesuaikan dengan schema yang berlaku —
periksa ulang kalau schema berubah.*
