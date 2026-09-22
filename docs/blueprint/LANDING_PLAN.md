# Rancangan Landing Grup Pusat Valas Indo

Status: **rancangan, belum diimplementasi.** Semua isi konten harus lolos [`docs/datas/landing-facts.md`](../datas/landing-facts.md) (tabel fakta). Kalau sebuah fakta berstatus ❌/🚫 di sana, section terkait ditandai **BLOCKED** di bawah dan tidak boleh tayang.

Turunan dari: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [DATA_PRESENTATION.md](./DATA_PRESENTATION.md), [SEO_GEO_LLM.md](./SEO_GEO_LLM.md).

---

## 1. Arah visual

**Satu kalimat:** merah PVI yang percaya diri di atas kanvas putih-hangat, tipografi besar dan editorial, angka kurs sebagai bintang utama. Terasa seperti fintech modern, bukan bank tua dan bukan toko valas pinggir jalan.

| Prinsip | Wujud |
|---|---|
| Tidak kaku | Headline besar berukuran tidak seragam, satu kata di-highlight merah, layout asimetris, ruang putih lega, satu bagian gelap sebagai kontras |
| Profesional | Grid 12 kolom disiplin, hairline rule, tidak ada gradien pelangi, satu warna aksen saja |
| Khas money changer | Papan kurs (rate board) dengan angka tabular, ticker mata uang, kode ISO + bendera, jam buka "Buka/Tutup" yang dihitung |
| Merah dipakai hemat | Merah hanya untuk: aksi utama, satu kata headline, indikator, band CTA/hero. Sisanya netral. (Sejalan dengan komentar di `globals.css`: netral tanpa chroma agar UI tidak kusam kemerahan) |
| Angka = tipografi | Ikuti DATA_PRESENTATION: tanpa kotak statistik. Papan kurs dan biaya PKD berupa tabel/baris dengan hairline, bukan kartu berbayang |

Referensi rasa: Wise, Stripe, Linear, Revolut (bagian kurs), Apple financial report.

---

## 2. Design token

Token landing di-namespace `--lp-*` supaya tidak mengubah admin. Sebagian besar hanya alias ke token shadcn yang sudah ada.

### 2.1 Warna

Basis merah brand sudah ada: `--primary: oklch(0.48 0.19 23)` = `#c62828` (dan `logo-red.png`). Skala di bawah dibangun dari titik itu.

```css
:root {
  /* Merah PVI — skala (hue 23 tetap, ubah L & C) */
  --lp-red-50:  oklch(0.977 0.013 23);
  --lp-red-100: oklch(0.936 0.032 23);
  --lp-red-200: oklch(0.885 0.062 23);
  --lp-red-300: oklch(0.808 0.114 23);
  --lp-red-400: oklch(0.704 0.170 23);
  --lp-red-500: oklch(0.600 0.200 23);
  --lp-red-600: oklch(0.540 0.205 23);   /* hover terang / dark mode primary */
  --lp-red-700: oklch(0.480 0.190 23);   /* = --primary  #c62828 */
  --lp-red-800: oklch(0.410 0.160 23);   /* pressed, teks merah di atas putih (kontras AA) */
  --lp-red-900: oklch(0.330 0.120 23);
  --lp-red-950: oklch(0.240 0.080 23);   /* band gelap bernuansa merah */

  /* Netral — chroma nyaris nol, sama dengan admin */
  --lp-ink:        oklch(0.21 0.006 285);   /* teks utama */
  --lp-ink-soft:   oklch(0.40 0.010 285);   /* teks isi */
  --lp-ink-mute:   oklch(0.552 0.012 285);  /* label, caption */
  --lp-line:       oklch(0.923 0.004 285);  /* hairline */
  --lp-paper:      oklch(0.985 0.004 80);   /* kanvas hangat, bukan putih dingin */
  --lp-paper-2:    oklch(0.965 0.006 80);   /* band bergantian */
  --lp-night:      oklch(0.17 0.012 20);    /* section gelap (hitam hangat, bukan #000) */
  --lp-night-line: oklch(0.30 0.014 20);

  /* Aksen sekunder — hanya untuk detail kecil (satu titik per layar) */
  --lp-brass:      oklch(0.78 0.11 85);     /* emas hangat: garis tipis, badge "Berizin BI" */

  /* Semantik kurs */
  --lp-up:    oklch(0.58 0.13 155);         /* = --success */
  --lp-down:  oklch(0.55 0.21 27);          /* = --destructive */
  --lp-open:  var(--lp-up);
  --lp-closed: var(--lp-ink-mute);
}
```

**Tiga PT, satu keluarga.** Jangan tiga warna berbeda; itu memecah brand. Bedakan lewat label dan satu detail warna:

| Entitas | Kode | Penanda | Keterangan |
|---|---|---|---|
| Pusat Valas Indo | PVI | `--lp-red-700` | Warna inti grup |
| Pusat Tukar Uang | PTU | `--lp-red-700` + titik `--lp-brass` | Keputusan #1 di §7: apakah PTU perlu identitas terpisah |
| Pusat Kirim Duit | PKD | `--lp-red-700` + titik `--lp-ink` | Bedanya cukup di ikon/label |

### 2.2 Tipografi

Font sudah dimuat di `layout.tsx`: **Outfit** (display) dan **Inter** (sans). Pertahankan, jangan tambah font ketiga (LCP).

| Token | Nilai | Pakai |
|---|---|---|
| `--lp-font-display` | Outfit, weight 600–700 | Headline, angka besar |
| `--lp-font-body` | Inter, 400/500/600 | Isi, tombol, tabel |
| `--lp-font-mono` | `ui-monospace` / Geist Mono bila sudah ada | Kode ISO (USD, JPY), nomor izin |

Skala fluid (`clamp`), tracking rapat untuk display:

| Token | Nilai | Pakai |
|---|---|---|
| `--lp-text-hero` | `clamp(2.75rem, 1.2rem + 6vw, 6rem)` / lh 0.98 / tracking -0.035em | H1 hero |
| `--lp-text-h2` | `clamp(2rem, 1.2rem + 3vw, 3.75rem)` / lh 1.02 / -0.03em | Judul section |
| `--lp-text-h3` | `clamp(1.25rem, 1.05rem + 1vw, 1.75rem)` / lh 1.15 | Sub-judul |
| `--lp-text-lead` | `clamp(1.0625rem, 1rem + 0.4vw, 1.25rem)` / lh 1.55 | Paragraf pembuka |
| `--lp-text-body` | `1rem` / 1.65 | Isi |
| `--lp-text-label` | `0.75rem` / uppercase / +0.12em / 600 | Label di atas angka |
| `--lp-text-figure` | Outfit 700, `.tabular`, `clamp(1.5rem, 1.2rem + 1.5vw, 2.5rem)` | Angka kurs & biaya |

Angka selalu `.tabular` dan format `id-ID` (mis. `16.250`, `USD 1.000`).

### 2.3 Spasi, radius, layout

| Token | Nilai |
|---|---|
| `--lp-container` | `72rem` (1152px), gutter `clamp(1rem, 4vw, 2rem)` |
| `--lp-section-y` | `clamp(4.5rem, 3rem + 7vw, 9rem)` |
| `--lp-gap-1…6` | 4, 8, 12, 16, 24, 40 px |
| Radius | `--lp-radius-pill: 999px` (tombol, chip), `--lp-radius-lg: 1.25rem` (panel foto/peta), `--lp-radius-sm: 0.5rem` (input). Tidak ada radius di blok metrik |
| Hairline | `1px solid var(--lp-line)` — pemisah utama, ganti kotak |
| Bayangan | Hampir tidak ada. Hanya `--shadow-lg` untuk menu mobile & popover. Tidak ada shadow pada kurs/biaya |

### 2.4 Gerak

| Token | Nilai |
|---|---|
| `--lp-ease` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--lp-dur-fast / base / slow` | 150 / 280 / 600 ms |

Gerak yang dipakai (semua dimatikan oleh `prefers-reduced-motion`):
- ticker mata uang berjalan pelan di bawah hero,
- angka kurs berubah dengan transisi halus (tanpa kedip),
- reveal on scroll: geser 12px + fade, sekali saja,
- tombol WhatsApp: hover geser panah 2px.

### 2.5 Tekstur & komponen khas

- Band hero/CTA: `--lp-red-700` ke `--lp-red-900` gradien 160°, ditimpa `public/noise.svg` opasitas 6–8% (sudah ada di repo) untuk kesan cetak/uang kertas.
- Garis tipis `--lp-brass` sebagai pemisah dekoratif di bagian legalitas saja.
- **Tombol**: primer = pill merah, teks putih; sekunder = pill outline `--lp-ink`; tersier = tautan dengan panah. Satu tombol primer per layar: **"Tanya kurs via WhatsApp"**.
- **Chip mata uang**: kode ISO mono + bendera (SVG lokal, bukan emoji, agar konsisten di Windows).
- **Badge status buka**: titik hijau/abu + "Buka sampai 16.30" / "Tutup, buka lagi Sen 08.00", dihitung dari jam WIB.
- **Fokus**: ring `--ring` 2px offset 2px. Kontras minimum WCAG AA (teks merah di atas putih pakai `--lp-red-700` atau lebih gelap; jangan `--lp-red-500`).
- **Dark mode**: bagian gelap sudah ada sebagai section (`--lp-night`). Halaman publik tetap terang secara default; dark mode penuh opsional, di luar MVP.

---

## 3. Section & informasi

Urutan halaman utama `/`. Kolom "Sumber" menunjuk ke bagian di `landing-facts.md`.

| # | Section | Isi | Sumber | Status |
|---|---|---|---|---|
| 0 | **Header** | Logo, menu (Layanan, Kurs, Lokasi, FAQ), status buka cabang terdekat, tombol WhatsApp | §2 | ✅ |
| 1 | **Hero** | H1 ringkas: money changer berizin BI sejak 2018 + PKD kirim uang luar negeri. Dua CTA: WhatsApp & lihat lokasi. Bukti kecil di bawah: "Izin BI No. 20/28/KEP.GBI/DKSP/2018", "4,7 bintang, 359 ulasan Google (per Sep 2026)". Ticker mata uang | §2 | ✅ (tanggal ulasan di-refresh) |
| 2 | **Papan kurs** | Kurs beli/jual per mata uang, waktu pembaruan, tombol "Kunci kurs via WhatsApp". Baris + hairline, tanpa kartu | §2, §6 (kurs Yahoo ≠ kurs toko) | **BLOCKED** oleh pertanyaan #8. Fallback: daftar mata uang tanpa angka + ajakan tanya via WA |
| 3 | **Tiga PT** | Tiga kolom editorial (PVI, PTU, PKD): satu kalimat peran, satu fakta kunci, tautan ke halaman entitas. Menjelaskan hubungan grup tanpa klaim kepemilikan | §1 | ⚠️ kalimat "di bawah naungan yang sama" ditahan (🚫); PTU minim data |
| 4 | **Layanan PVI** | Dua jalur: Online (WhatsApp/transfer) dan On the spot (datang ke kantor). Daftar mata uang yang dijanjikan | §2 | ⚠️ daftar mata uang publik belum diputuskan (#3) |
| 5 | **Pusat Kirim Duit** | Untuk pengusaha yang kirim ke luar negeri. 10 negara/mata uang, minimum USD 1.000, estimasi 2–4 hari kerja, kurs real-time, tarik di bank/ATM penerima. **Tabel biaya** (4 skenario). Dokumen yang disiapkan (pribadi vs perusahaan) | §3 | ⚠️ tanpa nama regulator & nomor izin sampai #1 dijawab; tafsir tarif perlu konfirmasi (#6) |
| 6 | **Cara kerja / apa yang dibawa** | 3 langkah (Tanya kurs, Konfirmasi & bawa dokumen, Transaksi). Daftar bawaan (KTP, dst.) | §2, §3, rekomendasi.md §8 | ✅ |
| 7 | **Lokasi & jam** | Dua cabang PVI + PKD (+PTU Pluit bila data lengkap). Alamat, peta, jam, tombol WA dengan nomor `62…` yang benar, badge buka/tutup | §2, §3 | ✅ PVI & PKD. PTU ❌ |
| 8 | **Legal & kepercayaan** (section gelap) | Izin BI PVI (nomor), status PKD, tahun berdiri, kebijakan dokumen underlying di atas USD 24.000. Nada faktual, bukan slogan | §2, §3 | ⚠️ PKD menunggu nomor izin |
| 9 | **Ulasan** | 3–4 kutipan Google asli dengan atribusi. Tautan ke Google Maps | §5 | ✅ (ambil ulang teks penuh; jangan pakai ulasan bernada personal) |
| 10 | **FAQ** | 8–12 pertanyaan (lihat §5.4). Sumber utama GEO | semua | ✅ |
| 11 | **CTA akhir** | Band merah: satu kalimat + tombol WhatsApp per entitas | §2, §3 | ✅ |
| 12 | **Footer** | NAP (nama, alamat, telepon) tiap PT, jam, tautan legal, sitemap kecil, © tahun berjalan. Ikon sosial hanya bila akun resmi ada | §6 | ⚠️ `/privacy` & `/terms` perlu ada (#12) |

**Yang sengaja tidak ada:** "same-day settlement", "kurs terbaik", "elite", "institutional", "100% berlisensi OJK", "Open Now" statis, "+20 mata uang". Semuanya 🚫 di §6 fakta.

Copy Indonesia menjadi bahasa utama; Inggris sebagai locale kedua (turis, ekspatriat di ulasan). Semua string lewat next-intl, bukan hardcode.

---

## 4. Struktur URL

**Diperbarui (keputusan owner): PTU = PVI versi 2, satu kantor dengan PVI di Cengkareng dan Green Lake City (dua PT per kantor); `/kurs` tidak dibuat.** Titik lokasi tiap halaman diambil dari data admin (Branch.latitude/longitude) dan disalin ke `src/config/group.ts` (`Branch.geo`, `pkdContact.geo`). Satu halaman kuat per topik dengan satu query utama masing-masing, supaya halaman tidak saling bersaing. Sumber kebenaran daftar halaman: `siteConfig.pages` di `src/config/site.ts` (menggerakkan sitemap, llms.txt, metadata).

| Path | Query utama | Status |
|---|---|---|
| `/` | nama brand, "money changer Jakarta Barat / Tangerang" | ✅ tayang |
| `/pusat-valas-indo` | "jual beli valas", "tukar dolar / ringgit / yen" | ✅ tayang |
| `/pusat-kirim-duit` | "kirim uang ke luar negeri untuk pengusaha" | ✅ tayang |
| `/lokasi/cengkareng` | "money changer Cengkareng / Taman Palem" | ✅ tayang |
| `/lokasi/tangerang` | "money changer Tangerang / Green Lake City / Cipondoh" | ✅ tayang |
| `/money-changer-terbaik` | "money changer terbaik Cengkareng / Jakarta Barat / Jakarta" (panduan kriteria) | ✅ tayang. Strategi GBP dan backlink: [LOCAL_SEO_PLAYBOOK.md](./LOCAL_SEO_PLAYBOOK.md) |
| `/privacy`, `/terms` | — | Footer belum menautnya; buat sebelum ditautkan. Tidak masuk sitemap |

Sengaja **tidak** dibuat: `/kurs` (diputuskan owner), `/faq` dan `/tentang` terpisah (isinya menggandakan beranda; FAQ sudah ada di tiap halaman dengan subset topiknya), `/kontak` (kontak ada di tiap cabang & footer), halaman per mata uang (tipis tanpa kurs; fase 2 bila ada konten unik).

Halaman lama (`/about`, `/services`, `/contact`, juga varian `/en/*` dan `/id/*`) di-redirect permanen di `next.config.ts` ke `/pusat-valas-indo` dan `/lokasi/cengkareng`. `src/app/[locale]/old/*` tidak terindeks (robots + tidak di sitemap); hapus setelah rilis.

## 5. SEO, GEO, LLMs.txt, robots, sitemap

### 5.1 Kondisi repo sekarang

- `src/config/site.ts` **masih template** ("My Product", `example.com`, `contact@example.com`). Seluruh pipeline SEO (`seo.ts`, `structured-data.ts`, `sitemap.ts`, `llms.txt/route.ts`) membaca dari sini, jadi ini pekerjaan pertama.
- `robots.ts` ada tapi hanya `allow /` + disallow `/api/` `/_next/`. Perlu ditambah: `/dashboard`, `/login`, `/signup`, `/old`, dan aturan crawler AI.
- `sitemap.ts` ada, mengeluarkan URL per locale tetapi tanpa `alternates.languages` (hreflang) dan `lastModified: new Date()` selalu berubah (sinyal palsu). Perbaiki.
- `llms.txt/route.ts` ada; isinya akan otomatis benar setelah `site.ts` diisi, tetapi butuh versi `llms-full.txt`.
- `NEXT_PUBLIC_APP_URL` harus di-set ke domain produksi (`pusatvalasindo.com` atau yang diputuskan owner) agar canonical/sitemap benar.

### 5.2 SEO

- `buildMetadata()` per halaman: title unik (≤ 60 karakter), description (≤ 155), canonical, `alternates.languages` (`id`, `en`, `x-default`), OG + Twitter.
- Locale: `id_ID` utama. Putuskan default locale (saat ini root mengarah ke `/en`; untuk pasar Tangerang/Jakarta sebaiknya `id` tanpa prefix).
- Gambar OG dinamis per halaman (`opengraph-image.tsx`), merah PVI + logo.
- Query target (lokal, transaksional): "money changer Tangerang", "money changer Cengkareng", "kurs dollar hari ini Tangerang", "kirim uang ke luar negeri untuk pengusaha", "jual beli valas berizin BI". Satu query utama per halaman, tidak dobel.
- `next/image` untuk semua foto, `font-display: swap`, target LCP < 2,5 dtk, CLS < 0,1. Halaman statis/ISR; hanya papan kurs yang dinamis.
- Google Business Profile tiap cabang dikaitkan ke halaman `/lokasi/*` yang sesuai; NAP harus identik di web, GBP, dan JSON-LD.

### 5.3 GEO (structured data)

Semua JSON-LD dibangun dari `site.ts` lewat `structured-data.ts`, satu sumber kebenaran.

| Schema | Dipasang di | Catatan |
|---|---|---|
| `Organization` (grup) dengan `subOrganization` ke 3 PT | `/` | `legalName`, `foundingDate`, `sameAs` (hanya akun nyata) |
| `CurrencyExchangeService` / `FinancialService` + `LocalBusiness` per cabang | halaman entitas & `/lokasi/*` | `address` (Banten, bukan DKI, untuk Tangerang), `geo`, `telephone`, `openingHoursSpecification` (Sen–Jum 08.00–16.30, Sab 08.00–14.00), `areaServed`, `hasMap`, `identifier` = nomor izin |
| `Service` / `Offer` | `/pusat-kirim-duit` | Biaya sebagai teks; hindari `price` menyesatkan karena bergantung skenario |
| `FAQPage` | `/`, `/faq`, halaman entitas | Rich result Google untuk FAQ dibatasi, tetapi tetap dipakai mesin AI |
| `BreadcrumbList` | semua halaman dalam | |
| `WebSite` + `SearchAction` | tidak perlu | Tidak ada pencarian internal |

**Gaya penulisan GEO:** kalimat pembuka tiap section berdiri sendiri dan bisa dikutip. Contoh: "Pusat Valas Indo adalah money changer berizin Bank Indonesia (No. 20/28/KEP.GBI/DKSP/2018) yang beroperasi sejak 2018 di Cengkareng, Jakarta Barat dan Cipondoh, Kota Tangerang." Angka spesifik, tanggal, sebut entitas dengan nama lengkap. Tidak ada superlatif.

### 5.4 Bahan FAQ (semua dari fakta terverifikasi)

1. Apa bedanya PVI, PTU, dan PKD?
2. Jam buka dan lokasi money changer terdekat?
3. Dokumen apa yang dibawa untuk tukar valas?
4. Apakah bisa transaksi online tanpa datang ke kantor?
5. Apakah PVI berizin? (nomor izin BI)
6. Berapa minimum dan biaya kirim uang ke luar negeri lewat PKD?
7. Berapa lama proses kirim uang PKD? (2–4 hari kerja)
8. Ke negara mana saja PKD bisa mengirim?
9. Dokumen underlying itu apa dan kapan diperlukan (di atas USD 24.000)?
10. Bagaimana penerima mengambil uangnya? (tarik di bank/ATM)

Pertanyaan dengan jawaban ❌ (maksimum kirim, izin PKD, mata uang publik) tidak ditulis sampai owner menjawab.

### 5.5 LLMs.txt

- `/llms.txt`: ringkasan grup (3 PT, peran masing-masing), NAP tiap cabang, jam, tautan ke halaman utama dengan satu baris deskripsi. Format markdown H1 + blockquote + daftar tautan, sesuai spesifikasi llms.txt.
- `/llms-full.txt`: isi lengkap yang sama dengan halaman (layanan, biaya PKD, dokumen, FAQ) dalam markdown polos, dibangkitkan dari sumber data yang sama dengan halaman (bukan salinan manual).
- Setiap klaim di kedua berkas harus berstatus ✅ di `landing-facts.md`. Tanggal "diperbarui" dicantumkan.
- Opsional: versi `.md` tiap halaman (`/pusat-kirim-duit.md`) untuk agen yang mengambil konten.

### 5.6 robots.txt

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard
Disallow: /login
Disallow: /signup
Disallow: /old/
Disallow: /_next/

# Crawler AI: diizinkan eksplisit supaya bisa dikutip
User-agent: GPTBot
User-agent: ChatGPT-User
User-agent: OAI-SearchBot
User-agent: ClaudeBot
User-agent: Claude-SearchBot
User-agent: PerplexityBot
User-agent: Google-Extended
Allow: /
Disallow: /api/
Disallow: /dashboard

Sitemap: https://<domain>/sitemap.xml
```

Keputusan kebijakan (#3 di §7): izinkan semua crawler AI (maksimal visibilitas GEO) atau hanya crawler pencarian/kutipan dan blok pelatihan (`GPTBot`, `Google-Extended`, `ClaudeBot`).

### 5.7 Sitemap

- Satu entri per halaman × locale, dengan `alternates.languages` (hreflang) dan `x-default`.
- `lastModified` dari data nyata (tanggal edit konten/kurs), bukan `new Date()`.
- Pisah bila membesar: `sitemap-pages`, `sitemap-locations`. Untuk situs sekecil ini satu berkas cukup.
- Kirim ke Google Search Console & Bing Webmaster; verifikasi kedua domain property.

### 5.8 Pelengkap

- `security.txt`, `humans.txt` (opsional).
- `manifest.webmanifest` + ikon dari logo merah.
- Header keamanan sudah ada di middleware; pastikan tidak memblokir crawler (rate limit whitelisting untuk bot resmi bila perlu).
- Pantauan: Search Console, PageSpeed CI, uji Rich Results, cek sitasi manual di ChatGPT/Perplexity/Gemini untuk query target tiap bulan.

---

## 6. Urutan kerja yang disarankan

1. Owner menjawab pertanyaan blocker (§7 fakta & §7 di bawah).
2. Isi `src/config/site.ts` dengan data grup nyata (tiga PT, cabang, jam, izin) sebagai satu sumber data. Semua halaman, JSON-LD, sitemap, llms membaca dari sini.
3. Tambah token `--lp-*` ke `globals.css` (blok terpisah, tidak mengubah token admin).
4. Bangun primitif landing: `Section`, `Container`, `Eyebrow`, `RateRow`, `HoursBadge`, `WhatsAppButton`, `CurrencyChip`.
5. Bangun `/` lalu tiga halaman entitas, lalu `/lokasi/*`.
6. SEO/GEO: `buildMetadata`, JSON-LD, sitemap+hreflang, robots, llms(-full).txt.
7. Hapus/redirect `old/*`, uji Rich Results & Lighthouse, daftar Search Console.

---

## 7. Keputusan (dijawab owner)

| # | Keputusan |
|---|---|
| Locale | Indonesia default **tanpa prefix**; Inggris di `/en` |
| Kurs di web | Tanpa angka kurs; **ajakan via WhatsApp** (papan kurs jadi daftar mata uang + tombol WA) |
| Crawler AI | Hanya boleh mengakses **landing, halaman PT, halaman cabang** (+ `llms.txt`); sisanya ditutup. Sudah di `robots.ts` |
| Domain per PT | Tidak perlu, satu domain |
| Identitas visual PTU | Tidak perlu, sama dengan PVI (titik brass PTU dihapus) |

## 8. Keputusan terbuka lama (arsip)

1. Apakah PTU perlu identitas visual sendiri (titik brass) atau sama persis dengan PVI?
2. Locale default: Indonesia tanpa prefix (disarankan) atau tetap `/en`?
3. Crawler AI: izinkan semua atau blok pelatihan saja?
4. Domain produksi final dan apakah tiap PT punya domain sendiri (akan mengubah strategi `Organization`/`sameAs`).
5. Kurs di web: tampil angka toko (butuh keputusan #8 fakta) atau hanya ajakan WhatsApp?
6. Bendera: SVG lokal (disarankan) atau tanpa bendera, hanya kode ISO.
7. Foto: apakah ada foto kantor dan logo PKD/PTU (fakta #10)? Tanpa foto, hero memakai tipografi + tekstur saja.
