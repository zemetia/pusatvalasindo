# Fakta Landing Page — Grup Pusat Valas Indo

Kumpulan **fakta** (bukan copy marketing) untuk refaktor landing page. Semua klaim di landing harus bisa ditelusuri ke tabel ini. Kalau tidak ada di sini, jangan ditampilkan.

Sumber: `docs/datas/pusat-kirim-duit.md` (jawaban owner PKD), `docs/contents/*` (salinan situs lama pusatvalasindo.com, April 2026), seeder Prisma (`prisma/seeds/*`), dan kode landing saat ini (`src/components/premium/*`, `src/app/[locale]/pusat-kirim-duit/page.tsx`).

Status: ✅ terverifikasi (dijawab owner / ada di situs resmi lama) · ⚠️ ada konflik atau perlu konfirmasi · ❌ belum ada datanya · 🚫 muncul di landing sekarang tapi tidak ada sumbernya.

---

## 1. Grup

| Fakta | Nilai | Status |
|---|---|---|
| Tiga PT | PT Pusat Valas Indo (PVI), PT Pusat Tukar Uang (PTU), PT Pusat Kirim Duit (PKD) | ✅ (seeder `companies.seeder.ts`) |
| Bidang PVI | Money changer (jual/beli valas), legal, berizin BI | ✅ |
| Bidang PTU | Money changer, cabang Pluit (Jakarta Utara) | ⚠️ hanya dari seeder; alamat/kontak/izin/tahun berdiri belum ada |
| Bidang PKD | Pengiriman uang ke luar negeri (remittance) untuk pengusaha | ✅ |
| Hubungan PVI–PKD | "Pusat Kirim Duit" juga ditampilkan sebagai layanan di situs PVI; kontak PKD di Contact Us situs lama = kantor Jakarta Barat | ⚠️ tapi PKD sendiri menyebut alamat Tangerang (lihat §3) |
| Klaim "grup di bawah naungan yang sama" | Tertulis di Companies.tsx | 🚫 struktur kepemilikan belum didokumentasikan |

## 2. PT Pusat Valas Indo (PVI)

| Fakta | Nilai | Status |
|---|---|---|
| Berdiri | 2018 | ✅ |
| Izin | No. 20/28/KEP.GBI/DKSP/2018, Bank Indonesia (izin KUPVA BB) | ✅ (situs lama). Tanggal berlaku/masa izin ❌ |
| Layanan 1: Online | Konsultasi kurs & transaksi via WhatsApp / transfer bank | ✅ |
| Layanan 2: On the spot | Datang ke kantor, transaksi tunai langsung | ✅ |
| Kurs | Ditampilkan/ditanyakan via WhatsApp; ada kurs beli & jual per mata uang | ✅ |
| Ulasan Google | 4,7 bintang dari 359 ulasan Google (per September 2026, dari owner) | ✅ tetap sebut tanggal |
| Visi | "Menjadi Money Changer yang terpercaya dan terkemuka dalam memberikan pelayanan Valuta Asing" | ✅ |
| Nilai yang diklaim | Kejujuran, keamanan, pelayanan ramah dan cepat | ✅ (dari About Us lama; bukan bukti, jangan dijadikan headline) |
| Mata uang yang diperdagangkan | Bergantung stok. Master item di seeder: AED, AUD, BHD, CAD, DKK, EUR, HKD, INR, IQD, JPY, JOD, KRW, KWD, MYR, NZD, NOK, OMR, PHP, GBP, QAR, RUB, SAR, SGD (besar & kecil), SEK, CHF, TWD, THB, TRY, USD, VND, CNY (31 kode) | ⚠️ daftar stok internal, bukan daftar yang dijanjikan ke publik. Tentukan mana yang boleh tampil |
| Emas | Master stok punya LM & LM Silver | ⚠️ apakah dijual ke publik? Belum ada konfirmasi |
| Mata uang yang belum tentu ada | "+20 mata uang" di Companies.tsx | 🚫 |

### Cabang PVI

| | Jakarta Barat (kantor pusat) | Tangerang |
|---|---|---|
| Alamat | Ruko Mutiara Taman Palem A5-27, RT 07/RW 14, Cengkareng Timur, Kec. Cengkareng, Jakarta Barat 11730 | Jl. Green Lake City Boulevard, Rukan Wallstreet A No. 16, Petir, Kec. Cipondoh, Kota Tangerang 15147 |
| Telepon | (021) 2951 3988 | — |
| WhatsApp | 0817-7009-9920 (`6281770099920`) | 0823-3380-0080 (`6282333800080`) |
| Maps | https://maps.app.goo.gl/P37npFa6zb3nYR8Y6 | https://maps.app.goo.gl/1SGvqb2UvqXpotfN9 |
| Jam | Sen–Jum 08.00–16.30, Sab 08.00–14.00, Minggu tutup | sama |
| Catatan | Ruko blok A, gedung tinggi terlihat dari jalan raya; parkir di luar, tidak perlu masuk Taman Palem (ulasan pelanggan) | Dekat bank (ulasan pelanggan) |

Catatan alamat: situs lama menulis Tangerang sebagai "DKI Jakarta 15147" — itu salah, Tangerang masuk Banten. Pakai "Kota Tangerang, Banten".

## 3. PT Pusat Kirim Duit (PKD)

| Fakta | Nilai | Status |
|---|---|---|
| Berdiri | 18 Juli 2024 | ✅ |
| Status regulasi | "Sudah terdaftar sebagai KUPVA / Penyelenggara Transfer Dana (PTD)" | ✅ dijawab owner |
| Regulator | Landing sekarang menulis "OJK" di banyak tempat ("100% Berlisensi OJK") | 🚫 owner tidak menyebut OJK. PTD di Indonesia diawasi Bank Indonesia. **Jangan tampilkan nama regulator sebelum ada nomor izin.** |
| Nomor izin | — | ❌ pertanyaan #1 di `pusat-kirim-duit.md` belum dijawab. Ini fakta paling krusial |
| Target pelanggan | Pengusaha Indonesia yang mengirim uang ke luar negeri | ✅ |
| Negara tujuan (10) | Amerika Serikat, Jepang, Inggris, Eropa, Swiss, Selandia Baru, Kanada, Singapura, Hong Kong, Australia | ✅ |
| Mata uang (10) | USD, JPY, GBP, EUR, CHF, NZD, CAD, SGD, HKD, AUD | ✅ |
| Minimum kirim | USD 1.000 (atau ekuivalen) per transaksi | ✅ |
| Maksimum | — | ❌ belum dijawab |
| Waktu proses | Estimasi 2–4 hari kerja | ✅ |
| Kurs | Mengikuti rate real-time (bukan fixed) | ✅ |
| Promo / rate khusus | Ada untuk pengiriman rutin/besar; detail ❌ | ⚠️ |
| Cara penerima mengambil | Tarik di bank/ATM setempat | ✅ |
| Transaksi online | Bisa, tanpa datang ke kantor (WhatsApp) | ✅ |
| Dokumen pribadi | KTP; dokumen underlying jika nominal di atas USD 10.000 | ✅ |
| Dokumen perusahaan | KTP direktur, NIB, NPWP perusahaan, underlying | ✅ |
| Alamat | Green Lake City, Rukan Wall Street Blok A No. 16, Cipondoh, Kota Tangerang, Banten 15147 | ✅ (sama dengan cabang Tangerang PVI — kemungkinan satu ruko, ⚠️ konfirmasi) |
| WhatsApp | 0877-7169-0203 → `6287771690203` | ✅ |
| Jam | Sen–Jum 08.00–16.30, Sab 08.00–14.00 | ✅ |
| Testimonial | Belum ada yang boleh dipublikasikan | ✅ |
| Logo / foto kantor | Ada, belum masuk repo | ⚠️ minta file |

### Biaya kirim PKD

| Skenario | Biaya |
|---|---|
| Di bawah USD 10.000, penerima terima penuh (full amount) | USD 40 + Rp 200.000 |
| Di bawah USD 10.000, tidak full amount | USD 15 + Rp 200.000 |
| Di atas USD 10.000, terima penuh | USD 40, tanpa biaya tambahan |
| Di atas USD 10.000, tidak full | USD 15, tanpa biaya tambahan |

⚠️ Jawaban owner "di atas 10.000 usd ada biaya 15 usd (tidak full) dan 40 usd (terima full), tanpa biaya tambahan lagi" saya tafsirkan sebagai tabel di atas (Rp 200.000 tidak berlaku). Konfirmasi.

Bug kontak yang ada di kode sekarang: `pusat-kirim-duit/page.tsx` memakai `6208777169020` (salah: ada angka 0 setelah 62 dan kehilangan digit terakhir). Yang benar `6287771690203`.

## 4. PT Pusat Tukar Uang (PTU)

**Koreksi (owner, 2026-09-22):** PTU adalah "PVI versi 2" dan beroperasi **satu kantor dengan PVI** di Cengkareng dan Green Lake City (di admin, cabang "Greenlake" PTU dan "Tangerang" PVI berkoordinat identik). Cabang "Pluit" hanya ada di seeder lama, tidak ada di database. Paragraf di bawah ini usang.

Data minimal. Yang ada hanya nama, kode, cabang Pluit (Jakarta Utara) dari seeder. ❌ Alamat lengkap, telepon/WhatsApp, jam, nomor izin, tahun berdiri, mata uang.

Companies.tsx sekarang menulis "BI Authorized • KUPVA BB", "Est. Tangerang", dan tag MYR/HKD — 🚫 semua tanpa sumber, dan cabang yang tercatat adalah Pluit, bukan Tangerang.

## 5. Bukti sosial

Ulasan Google asli (dari `docs/contents/testimonials.md`, situs lama). Boleh dipakai dengan atribusi "Ulasan Google", nama sesuai yang tampil di Google:

- Jo T. — dolar USD di Jakarta beberapa kali, sabar & ramah, rate layak, bisa berbahasa Inggris.
- Pelanggan lokal — lokasi mudah dicapai (gedung tinggi terlihat dari jalan), ramah, rate beli & jual bagus; beli Baht 27 Februari, jual sisa seminggu kemudian hanya turun 7 poin.
- Josh Isaiah — staf jujur soal rate & transfer, lokasi dekat bank.
- Ulasan singkat: "Good rate, pelayanan cepat & profesional"; "Excellent service with good value"; "potongan harga gak besar banget, lokasi mudah dicari, bisa parkir luar".

Catatan: satu ulasan memuat komentar tentang penampilan pemilik ("lady boss is really pretty") — jangan dipakai. Kutipan di situs lama sebagian dipotong; ambil ulang teks penuh dari Google Maps sebelum tayang. Rating 4,7 dari 359 ulasan (owner, Sep 2026).

## 6. Yang muncul di landing sekarang tapi tidak berdasar fakta

| Teks | Lokasi | Masalah |
|---|---|---|
| "Institusi No. 2026/PVI" | messages `Hero.institutionNo` | Nomor karangan. Nomor izin yang benar: 20/28/KEP.GBI/DKSP/2018 |
| "Penyelesaian hari yang sama", "same-day settlement guarantees" | Hero, ExchangeRates | Tidak ada sumber. PKD justru 2–4 hari kerja |
| "Institutional spreads / global liquidity providers", "Elite Quote", "Dealing desk", "Wholesale margins", "Orders > $10,000" | ExchangeRates, CTA akhir | Bahasa trading desk; PVI money changer retail. Ambang USD 10.000 milik tarif PKD, bukan PVI |
| Kurs "live" dari Yahoo Finance | `lib/rates.ts` | Itu kurs pasar (mid-market), bukan kurs beli/jual toko. Menyesatkan bila disebut kurs PVI. Kurs toko ada di modul stok/harga (`patokan-harga`, `CurrencyPrice`) |
| "Open Now" hijau | Locations | Statis. Harus dihitung dari jam operasional (WIB), Minggu tutup |
| Nomor WA cabang | Locations | Link dibentuk dari `replace("-", "")` sehingga rusak (`0817...`, bukan `62...`) |
| "Berlisensi OJK", "100% Berlisensi OJK" | PKD page, Companies | Lihat §3 |
| "Kurs terbaik", "Elite Standards", "Jakarta's elite currency gateway" | Features, Footer | Klaim superlatif tanpa dasar |
| Media sosial | Footer | Ikon Instagram/Facebook tanpa tautan; situs lama hanya placeholder. ❌ akun resmi belum diketahui |
| "© 2025 … Designed by Zharkwave" | Footer | Tahun perlu diperbarui |

## 7. Pertanyaan yang harus dijawab owner sebelum landing final

1. **Nomor izin PKD** dan regulatornya (BI/OJK) — dan tanggal terbitnya.
2. Nomor izin PTU, alamat Pluit, kontak, jam buka, tahun berdiri.
3. Daftar mata uang yang **dijanjikan** ke publik untuk PVI (dan apakah emas dijual).
4. Apakah PVI melayani beli/jual dalam jumlah besar dengan kurs khusus, dan ambang batasnya.
5. Batas maksimum transaksi PKD, dan detail promo/rate khusus.
6. Konfirmasi tafsir tarif PKD di atas USD 10.000 (§3).
7. Apakah PKD dan PVI Tangerang satu ruko/satu tim.
8. Kurs yang ditampilkan di web: kurs beli/jual toko (dari modul harga) atau tanpa kurs (arahkan ke WhatsApp)? Berapa sering diperbarui?
9. Akun media sosial resmi (Instagram, Google Business, dst.).
10. Foto kantor (Taman Palem & Green Lake City), logo PKD/PTU, izin memakai nama & ulasan pelanggan.
11. Rating rata-rata Google dan tanggal jumlah ulasan diambil.
12. Terms/Privacy: footer menaut `/privacy` dan `/terms` — apakah halamannya ada?

## 8. Referensi non-fakta (strategi, bukan data)

`docs/contents/recommendation.md` berisi strategi ("screen to store", rate board, "what to bring", status buka/tutup, WhatsApp rate locker). Itu arah desain, bukan fakta; pakai sebagai masukan saat merancang ulang, bukan sebagai klaim.
