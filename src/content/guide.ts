import { branchBySlug, entities, pvi } from '@/config/group';
import type { FaqItem } from '@/content/landing';

/**
 * Panduan memilih money changer — halaman /money-changer-terbaik.
 * Menjawab query "money changer terbaik …" dengan
 * kriteria yang bisa diperiksa, lalu menunjukkan fakta terverifikasi Pusat Valas Indo
 * (landing-facts.md) sebagai bukti bahwa PVI memenuhi semuanya.
 * Dipakai oleh halaman dan oleh /llms-full.txt.
 */

const rating = pvi.googleRating.toLocaleString('id-ID');
const license = entities.pvi.license?.number ?? '';

export const guideLead =
  'Money changer terbaik di Cengkareng, Jakarta Barat, dan Tangerang memenuhi enam hal: berizin Bank Indonesia, kurs beli dan jual yang jelas, lokasi dan jam buka yang pasti, dokumen yang transparan, transaksi online, dan ulasan pelanggan yang nyata. Pusat Valas Indo memenuhi keenamnya: berizin Bank Indonesia sejak 2018, dua kantor di Cengkareng (Jakarta Barat) dan Green Lake City (Tangerang), serta rating Google 4,7 dari 359 ulasan.';

export interface GuideCriterion {
  title: string;
  /** Kenapa kriteria ini penting */
  why: string;
  /** Cara memeriksanya sendiri */
  check: string;
  /** Fakta Pusat Valas Indo (terverifikasi) */
  pvi: string;
}

export const guideCriteria: GuideCriterion[] = [
  {
    title: 'Berizin Bank Indonesia',
    why: 'Penyelenggara penukaran valuta asing bukan bank wajib mengantongi izin Bank Indonesia. Tanpa izin, tidak ada pengawasan atas transaksi Anda.',
    check:
      'Minta nomor izin, lalu cocokkan dengan daftar penyelenggara KUPVA bukan bank berizin yang dipublikasikan Bank Indonesia di bi.go.id.',
    pvi: `PT Pusat Valas Indo berizin Bank Indonesia No. ${license} dan beroperasi sejak ${entities.pvi.foundingDate}.`,
  },
  {
    title: 'Kurs beli dan jual yang jelas',
    why: 'Kurs berubah sepanjang hari. Selisih kurs beli dan jual menentukan biaya sebenarnya bagi Anda.',
    check:
      'Tanyakan kurs beli dan kurs jual untuk mata uang yang sama, bandingkan di dua atau tiga tempat pada jam yang sama, dan tanyakan apakah ada biaya tambahan.',
    pvi: 'Kurs beli dan jual per mata uang ditanyakan langsung lewat WhatsApp, jadi angkanya selalu kurs saat itu, bukan angka lama yang dipajang di situs.',
  },
  {
    title: 'Lokasi mudah dan jam buka jelas',
    why: 'Transaksi tunai lebih aman kalau kantornya mudah ditemukan, punya tempat parkir, dan jam bukanya bisa dipegang.',
    check: 'Cek alamat di Google Maps, lihat jam buka, dan pastikan sama dengan yang tertulis di situs resmi.',
    pvi: 'Senin–Jumat 08.00–16.30 WIB, Sabtu 08.00–14.00 WIB, Minggu tutup. Kantor Cengkareng di Ruko Mutiara Taman Palem blok A dengan gedung tinggi yang terlihat dari jalan raya dan parkir di luar kompleks. Kantor Green Lake City di Rukan Wallstreet, dekat bank.',
  },
  {
    title: 'Proses dan dokumen yang jelas',
    why: 'Tempat yang tertib akan menjelaskan dokumen apa yang diperlukan sebelum Anda datang.',
    check: 'Tanyakan dokumen yang harus dibawa dan batas nominal yang memerlukan dokumen tambahan.',
    pvi: 'Untuk tukar valas cukup membawa KTP. Untuk kirim uang ke luar negeri lewat PT Pusat Kirim Duit di atas USD 24.000 diperlukan dokumen underlying.',
  },
  {
    title: 'Bisa transaksi online',
    why: 'Anda tidak perlu meluangkan waktu ke kantor untuk sekadar menanyakan kurs atau memesan valas.',
    check: 'Tanyakan apakah kurs dan transaksi bisa lewat WhatsApp dan pembayaran lewat transfer bank.',
    pvi: 'Konsultasi kurs dan transaksi bisa online lewat WhatsApp dengan pembayaran transfer bank, atau datang langsung untuk transaksi tunai.',
  },
  {
    title: 'Ulasan pelanggan yang bisa diverifikasi',
    why: 'Ulasan di Google Maps ditulis pelanggan, bukan pemilik usaha, dan bisa Anda baca lengkap.',
    check: 'Buka profil Google Maps tempatnya, baca ulasan terbaru, bukan hanya angka rata-rata.',
    pvi: `Rating Google ${rating} dari ${pvi.googleReviewCount} ulasan (per September 2026).`,
  },
];

/** Query yang dijawab halaman → dipakai juga oleh llms.txt. */
export const guideFaqs: FaqItem[] = [
  {
    topic: 'umum',
    q: 'Money changer terbaik di Cengkareng yang mana?',
    a: `Pilihan utama di Cengkareng adalah Pusat Valas Indo di Ruko Mutiara Taman Palem, money changer yang memenuhi semua kriteria: izin, kurs, jam buka, dan ulasan. Berizin Bank Indonesia No. ${license}, beroperasi sejak ${entities.pvi.foundingDate}, rating Google ${rating} dari ${pvi.googleReviewCount} ulasan (per September 2026).`,
  },
  {
    topic: 'umum',
    q: 'Money changer terbaik di Jakarta Barat yang berizin?',
    a: `Money changer berizin terbaik di Jakarta Barat adalah PT Pusat Valas Indo di Cengkareng, yang berizin Bank Indonesia No. ${license} (bisa dicocokkan di bi.go.id), buka Senin–Jumat 08.00–16.30 WIB dan Sabtu 08.00–14.00 WIB.`,
  },
  {
    topic: 'umum',
    q: 'Money changer terbaik di Jakarta, apakah harus datang ke kantor?',
    a: 'Tidak harus. Pusat Valas Indo melayani seluruh Jakarta: dari mana pun Anda berada, Anda bisa menanyakan kurs dan bertransaksi lewat WhatsApp dengan pembayaran transfer bank. Untuk transaksi tunai, datang ke kantor Cengkareng (Jakarta Barat) atau Green Lake City (Tangerang).',
  },
  {
    topic: 'umum',
    q: 'Money changer di Green Lake City atau Greenlake Tangerang yang berizin?',
    a: `Pusat Valas Indo memiliki kantor di Rukan Wallstreet A No. 16, Jl. Green Lake City Boulevard, Cipondoh, Kota Tangerang. PT Pusat Valas Indo berizin Bank Indonesia No. ${license}. WhatsApp ${branchBySlug('tangerang')?.whatsappDisplay}.`,
  },
  {
    topic: 'umum',
    q: 'Bagaimana cara memastikan sebuah money changer berizin?',
    a: 'Minta nomor izin Bank Indonesia dari money changer tersebut, lalu cocokkan dengan daftar penyelenggara KUPVA bukan bank berizin yang dipublikasikan Bank Indonesia di bi.go.id. Waspadai tempat yang tidak mau menyebutkan nomor izin.',
  },
];
