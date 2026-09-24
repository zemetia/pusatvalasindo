/**
 * Central "company brain" — single source of truth for all SEO, GEO, and LLMs.txt.
 * Fakta grup ada di ./group.ts; file ini membungkusnya untuk metadata, sitemap,
 * structured data, dan llms.txt. Daftarkan halaman baru di `pages` HANYA setelah
 * halamannya ada (sitemap tidak boleh memuat 404).
 */

import type { MetadataRoute } from 'next';

export type SitemapChangeFreq = NonNullable<
  MetadataRoute.Sitemap[number]['changeFrequency']
>;

export interface PageConfig {
  /** URL path relative to root, e.g. '/pusat-kirim-duit' */
  path: string;
  title: string;
  /** Meta description — konkret, sebut apa yang didapat pengunjung */
  description: string;
  changeFreq: SitemapChangeFreq;
  priority: number;
  /** Tanggal terakhir KONTEN halaman berubah (YYYY-MM-DD). Perbarui hanya saat isinya berubah. */
  lastModified: string;
}

export interface SiteConfig {
  name: string;
  tagline: string;
  description: string;
  url: string;
  ogImage: string;
  company: {
    legalName: string;
    foundedYear: number;
    industry: string;
    targetAudience: string;
    problemSolved: string;
    solution: string;
    keyBenefits: string[];
    contactEmail?: string;
    socialLinks: {
      instagram?: string;
      facebook?: string;
      linkedin?: string;
    };
  };
  seo: {
    titleTemplate: string;
    defaultTitle: string;
    twitterHandle?: string;
    locale: string;
  };
  /** Locale yang kontennya sudah diterjemahkan → masuk sitemap & hreflang. Lainnya noindex. */
  contentLocales: string[];
  pages: Record<string, PageConfig>;
}

export const siteConfig: SiteConfig = {
  name: 'Pusat Valas Indo',
  tagline: 'Money changer terpercaya, berizin Bank Indonesia di Jakarta Barat dan Tangerang.',
  description:
    'Grup Pusat Valas Indo terdiri dari PT Pusat Valas Indo (money changer berizin Bank Indonesia sejak 2018), PT Pusat Tukar Uang (money changer, satu kantor dengan PVI), dan PT Pusat Kirim Duit (pengiriman uang ke luar negeri untuk pengusaha). Tanya kurs dan transaksi via WhatsApp atau datang langsung ke kantor.',
  url: process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://pusatvalasindo.com',

  ogImage: '/opengraph-image',

  company: {
    legalName: 'PT Pusat Valas Indo',
    foundedYear: 2018,
    industry: 'Money changer / penukaran valuta asing',
    targetAudience:
      'Individu dan pelaku usaha di Jakarta Barat, Tangerang, dan sekitarnya yang menukar valuta asing, serta pengusaha Indonesia yang mengirim uang ke luar negeri.',
    problemSolved:
      'Menukar valuta asing dan mengirim uang ke luar negeri membutuhkan kurs yang jelas, izin yang bisa diperiksa, dan proses yang transparan.',
    solution:
      'PT Pusat Valas Indo melayani jual beli valuta asing secara online (WhatsApp/transfer bank) dan langsung di kantor. PT Pusat Kirim Duit melayani pengiriman uang ke 10 negara untuk pengusaha.',
    keyBenefits: [
      'Berizin Bank Indonesia No. 20/28/KEP.GBI/DKSP/2018 (PT Pusat Valas Indo)',
      'Transaksi online via WhatsApp atau datang langsung ke kantor',
      'Kirim uang ke 10 negara/mata uang dengan biaya tertulis jelas (PT Pusat Kirim Duit)',
    ],
    socialLinks: {},
  },

  contentLocales: ['id'],

  seo: {
    titleTemplate: '%s | Pusat Valas Indo',
    defaultTitle: 'Pusat Valas Indo — Money Changer Berizin BI, Jakarta Barat & Tangerang',
    locale: 'id_ID',
  },

  // Satu halaman kuat per topik dengan satu query utama masing-masing (tidak saling bersaing):
  //   /                     → nama brand + "money changer Jakarta Barat / Tangerang"
  //   /pusat-valas-indo     → "jual beli valas", "tukar dolar/ringgit/yen"
  //   /pusat-kirim-duit     → "kirim uang ke luar negeri untuk pengusaha"
  //   /lokasi/cengkareng    → "money changer Cengkareng / Taman Palem"
  //   /lokasi/tangerang     → "money changer Green Lake City / Cipondoh"
  //   /money-changer-terbaik → "money changer terbaik Cengkareng / Jakarta Barat / Jakarta" (panduan memilih)
  // PTU (Pluit) bagian dari brand PVI: /lokasi/pluit ditambahkan saat datanya lengkap.
  pages: {
    home: {
      path: '/',
      title: 'Pusat Valas Indo — Money Changer Berizin BI, Jakarta Barat & Tangerang',
      description:
        'Money changer terpercaya berizin Bank Indonesia sejak 2018 di Cengkareng, Jakarta Barat & Tangerang. Tanya kurs via WhatsApp, plus kirim uang ke luar negeri untuk pengusaha.',
      changeFreq: 'weekly',
      priority: 1.0,
      lastModified: '2026-09-22',
    },
    'pusat-valas-indo': {
      path: '/pusat-valas-indo',
      title: 'Jual Beli Valas Berizin BI | Pusat Valas Indo',
      description:
        'Tukar dolar, dolar Singapura, euro, yen, dan valas lain di money changer berizin Bank Indonesia. Transaksi via WhatsApp atau langsung di Cengkareng dan Tangerang.',
      changeFreq: 'monthly',
      priority: 0.9,
      lastModified: '2026-09-22',
    },
    'pusat-kirim-duit': {
      path: '/pusat-kirim-duit',
      title: 'Kirim Uang ke Luar Negeri | Pusat Kirim Duit',
      description:
        'Kirim uang ke 10 negara untuk pengusaha: minimum USD 1.000, estimasi 2–4 hari kerja, biaya tertulis jelas. Transaksi online via WhatsApp tanpa ke kantor.',
      changeFreq: 'monthly',
      priority: 0.9,
      lastModified: '2026-09-22',
    },
    'lokasi-cengkareng': {
      path: '/lokasi/cengkareng',
      title: 'Money Changer Cengkareng, Jakarta Barat | Pusat Valas Indo',
      description:
        'Money changer terpercaya berizin BI di Cengkareng, Jakarta Barat: Ruko Mutiara Taman Palem A5-27. Alamat, jam buka, cara menuju lokasi, dan WhatsApp untuk tanya kurs.',
      changeFreq: 'monthly',
      priority: 0.8,
      lastModified: '2026-09-22',
    },
    'lokasi-tangerang': {
      path: '/lokasi/tangerang',
      title: 'Money Changer Tangerang & Green Lake City | Pusat Valas Indo',
      description:
        'Money changer terpercaya berizin BI di Tangerang: Rukan Wallstreet, Green Lake City (Greenlake), Cipondoh. Alamat, jam buka, dan WhatsApp untuk tanya kurs.',
      changeFreq: 'monthly',
      priority: 0.8,
      lastModified: '2026-09-22',
    },
    'money-changer-terbaik': {
      path: '/money-changer-terbaik',
      title: 'Money Changer Terbaik Cengkareng, Jakarta Barat & Tangerang',
      description:
        'Cara memilih money changer terbaik dan terpercaya di Cengkareng, Jakarta Barat, Jakarta & Tangerang: cek izin BI, kurs, dokumen, jam buka. Termasuk profil Pusat Valas Indo.',
      changeFreq: 'monthly',
      priority: 0.8,
      lastModified: '2026-09-22',
    },
  },
};
