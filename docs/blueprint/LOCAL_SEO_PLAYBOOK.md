# Local SEO Playbook: web + Google Business Profile

Tujuan: situs ini menopang Google Business Profile (GBP) kedua cabang untuk query **money changer Cengkareng**, **money changer Green Lake City/Greenlake**, **money changer Tangerang**, **money changer Jakarta**, dan varian kepercayaan **terbaik** / **terpercaya** (Cengkareng, Jakarta Barat, Jakarta, Tangerang).

Bagian 1 sudah ada di kode. Bagian 2–5 dikerjakan di luar repo (GBP, direktori, PR); tidak bisa dilakukan dari kode.

## 1. Peta kata kunci → halaman (satu query utama per halaman)

| Query | Halaman | Hal yang sudah dipasang |
|---|---|---|
| money changer cengkareng, jakarta barat, taman palem, **money changer terpercaya cengkareng** | `/lokasi/cengkareng` | title, H1 "terpercaya", lead, `FinancialService` + NAP + geo + FAQ alamat/jam/terpercaya |
| money changer tangerang, green lake city, greenlake, cipondoh, **money changer terpercaya tangerang** | `/lokasi/tangerang` | idem; ejaan "Greenlake" di lead, deskripsi, `alternateName`, FAQ terpercaya |
| money changer terbaik / **terpercaya** cengkareng / jakarta barat / jakarta / tangerang | `/money-changer-terbaik` | panduan enam kriteria + FAQ per query (termasuk FAQ "terpercaya" per kota), `Article` + `FAQPage` |
| jual beli valas, tukar dolar/ringgit/yen | `/pusat-valas-indo` | daftar mata uang, `Service` |
| kirim uang ke luar negeri pengusaha | `/pusat-kirim-duit` | biaya, dokumen, `Service` |

Strategi "terbaik"/"terpercaya": halaman panduan mendefinisikan kriteria "money changer terbaik" lalu membuktikan PVI memenuhinya dengan fakta yang bisa diperiksa (izin BI No. 20/28/KEP.GBI/DKSP/2018, sejak 2018, 4,7 dari 359 ulasan Google). "Terpercaya" dipakai sebagai sinonim yang sama-sama dicari orang (bukan halaman terpisah — menghindari thin/duplicate content); disisipkan di title/description/H1/FAQ halaman panduan dan halaman cabang, serta `areaServed` Organization schema (termasuk "Jakarta" polos, bukan hanya "Jakarta Barat"). Klaim bertumpu pada bukti, sehingga bisa dikutip mesin AI dan tidak mudah dianggap spam.

## 2. Jaring tautan internal (sudah dipasang)

- Menu header dan footer memuat semua halaman.
- Setiap halaman punya blok **Halaman terkait** (`RelatedLinks`) ke lima halaman lain, dengan anchor berisi kata kunci. Daftarnya satu sumber: `internalLinks` di `src/content/landing.ts`. Halaman baru cukup ditambah di sana.
- Halaman cabang saling menaut, dan halaman Tangerang menaut ke PKD.
- JSON-LD berbagi `@id`: `Organization` (`/#organization`) → tiga PT (`/#pvi`, `/#ptu`, `/#pkd`) → cabang (`/lokasi/x#branch`). `WebSite` (`/#website`) menjadi induk semua `WebPage`. Mesin AI membaca ini sebagai satu graf entitas.

## 3. Google Business Profile (dikerjakan di business.google.com)

Satu profil per cabang. NAP harus **sama persis** dengan `src/config/group.ts` dan JSON-LD.

| Field | Cengkareng | Tangerang (Green Lake City) |
|---|---|---|
| Nama | Pusat Valas Indo (tanpa tambahan kata kunci; nama yang distuff bisa ditangguhkan Google) | sama |
| Kategori utama | Money changer / Currency exchange service | sama |
| Kategori tambahan | Foreign exchange | sama |
| Alamat | Ruko Mutiara Taman Palem A5-27, RT 07/RW 14, Cengkareng Timur, Jakarta Barat 11730 | Jl. Green Lake City Boulevard, Rukan Wallstreet A No. 16, Petir, Cipondoh, Kota Tangerang 15147 |
| Telepon | (021) 2951 3988 | 0823-3380-0080 |
| **Website** | `https://pusatvalasindo.com/lokasi/cengkareng` | `https://pusatvalasindo.com/lokasi/tangerang` |
| Jam | Sen–Jum 08.00–16.30, Sab 08.00–14.00, Minggu tutup | sama |
| Tautan pesan/WhatsApp | `wa.me/6281770099920` | `wa.me/6282333800080` |

Aturan:
- Tautan website GBP menunjuk ke **halaman cabangnya**, bukan beranda. Tambahkan `?utm_source=google&utm_medium=organic&utm_campaign=gbp-cengkareng` (dan `gbp-tangerang`) agar kunjungan GBP terpisah di analitik.
- Deskripsi GBP (750 karakter): sebut izin BI, sejak 2018, layanan online + langsung, area (Cengkareng, Taman Palem, Jakarta Barat / Green Lake City, Cipondoh, Tangerang). Tanpa harga, tanpa superlatif.
- Isi seluruh **Produk/Layanan** dengan nama mata uang (Dolar AS, Dolar Singapura, Euro, Yen, Ringgit, dst.), tanpa kurs.
- **Tanya-Jawab**: salin lima FAQ dari halaman cabang dan `/money-changer-terbaik` (jawaban sudah faktual).
- **Postingan** mingguan (info jam libur, pengingat bawa KTP, tautan ke halaman cabang). Foto: tampak depan ruko, papan nama, interior; tambahkan foto baru tiap bulan.
- **Ulasan**: minta pelanggan menulis lewat tautan ulasan GBP (short link `g.page/r/…/review`). Balas semua ulasan, termasuk yang negatif, dengan nada faktual. Jangan menawarkan imbalan untuk ulasan (melanggar kebijakan Google).
- PKD: alamat tercatat sama dengan cabang Tangerang tetapi koordinat di admin (-6.132385, 106.732719) jatuh ±6 km dari sana. Selesaikan dulu mana yang benar; **jangan buat GBP PKD** sebelum alamat dan izin PKD pasti (banyak listing dengan alamat sama untuk PT berbeda dapat dianggap duplikat).
- Setelah `sameAs` di JSON-LD (tautan Maps cabang) dan GBP saling menunjuk, pantau di Search Console bahwa halaman cabang menjadi hasil sitelink/kaitan nama merek.

## 4. Backlink dan sitasi (bangun bertahap; kualitas di atas jumlah)

Prioritas dari yang paling berpengaruh dan paling murah:

1. **Sitasi direktori dengan NAP identik**: Bing Places, Apple Business Connect, Yelp/Foursquare, Waze, Facebook Page, Instagram bio, LinkedIn company page, Yellow Pages Indonesia. Website di tiap profil menunjuk ke halaman cabang yang sesuai (bukan beranda semua).
2. **Situs regulator**: pastikan nama dan alamat di daftar KUPVA BB berizin Bank Indonesia sama dengan situs.
3. **Kemitraan lokal**: pengelola Green Lake City / Taman Palem, asosiasi pengusaha atau paguyuban ruko, komunitas alumni/UMKM Tangerang dan Jakarta Barat, biro perjalanan umrah/haji dan wisata (butuh SAR, MYR, JPY), kampus (mahasiswa pertukaran), agen properti luar negeri. Tawarkan halaman "mitra" timbal balik atau artikel tamu; anchor natural ("money changer di Cengkareng").
4. **Konten yang layak ditautkan**: panduan dokumen tukar valas dan kirim uang, ringkasan aturan underlying USD 10.000, panduan bawa valas ke luar negeri. Hanya publikasikan jika faktanya terverifikasi (`landing-facts.md`).
5. **PR/liputan**: rilis ulang tahun, kanal berita lokal Tangerang, wawancara pemilik tentang tips tukar valas musim liburan.
6. **Pola anchor**: sebagian besar nama merek ("Pusat Valas Indo") dan URL polos; sisanya frasa pencarian seperti "money changer Cengkareng". Hindari anchor eksak berulang dari banyak situs.

Jangan beli paket backlink massal atau jaringan blog pribadi (PBN): risiko penalti manual pada situs keuangan.

## 5. Ukur dan rawat

- Daftarkan `pusatvalasindo.com` sebagai Domain property di Google Search Console dan Bing Webmaster; kirim `/sitemap.xml`. Isi env `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` bila memakai verifikasi meta-tag.
- Set `NEXT_PUBLIC_APP_URL=https://pusatvalasindo.com` di produksi (kanonis, sitemap, JSON-LD memakainya).
- Uji tiap halaman di Rich Results Test dan Schema Markup Validator setelah rilis.
- Tiap bulan: cek posisi query target di Search Console (Performa → Kueri), tampilan/klik/telepon/rute di GBP Insights, dan tanyakan query yang sama ke ChatGPT, Perplexity, Gemini untuk melihat apakah situs dikutip.
- Perbarui `lastModified` di `siteConfig.pages` **hanya** saat isi halaman berubah; perbarui rating/jumlah ulasan di `src/config/group.ts` (`pvi`) tiap bulan agar tidak basi.
- Sengaja tidak dipasang: `aggregateRating` pada JSON-LD. Kebijakan Google tidak menampilkan bintang untuk ulasan yang dimuat oleh bisnis itu sendiri pada `LocalBusiness`/`Organization`; rating tampil lewat GBP.
- Terjemahan Inggris belum ada, jadi `/en/*` `noindex` dan tidak ada di sitemap. Bila ditambah, tambahkan `en` ke `siteConfig.contentLocales`.
