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
  tagline: 'Money changer terbaik & terpercaya di Jakarta & Tangerang, berizin Bank Indonesia.',
  description:
    'Pusat Valas Indo adalah money changer berizin Bank Indonesia (sejak 2018) melayani jual beli valas online bebas repot untuk wilayah Jakarta (Jakarta Barat, Jakarta Selatan, Jakarta Pusat, Jakarta Utara, Jakarta Timur) hingga Tangerang dengan sistem kurir & transfer bank tanpa perlu datang ke kantor, serta kantor fisik di Cengkareng dan Green Lake City.',
  url: process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://pusatvalasindo.com',

  ogImage: '/opengraph-image',

  company: {
    legalName: 'PT Pusat Valas Indo',
    foundedYear: 2018,
    industry: 'Money changer / penukaran valuta asing',
    targetAudience:
      'Individu, profesional, ekspatriat, dan pelaku usaha di seluruh DKI Jakarta (Jakarta Selatan, Jakarta Pusat, Jakarta Barat, Jakarta Utara, Jakarta Timur) dan Tangerang yang menginginkan penukaran valas cepat, aman, dan tanpa repot via layanan kurir / transfer antar-bank maupun transaksi langsung di kantor.',
    problemSolved:
      'Tukar valas di Jakarta sering memakan waktu akibat macet, antrean panjang, dan ketidakpastian izin. Pusat Valas Indo menghadirkan solusi tukar valas online bebas repot dengan pengantaran kurir terpercaya dan transfer bank resmi.',
    solution:
      'PT Pusat Valas Indo melayani jual beli valuta asing secara online bebas repot dengan sistem kurir dan transfer bank ke seluruh Jakarta (Jakarta Selatan, Jakarta Pusat, Barat, Utara, Timur) dan Tangerang, maupun transaksi tunai di kantor Cengkareng & Green Lake City.',
    keyBenefits: [
      'Berizin resmi Bank Indonesia No. 20/28/KEP.GBI/DKSP/2018 (PT Pusat Valas Indo)',
      'Layanan valas online bebas repot se-Jakarta & Tangerang via kurir aman atau transfer bank',
      'Ulasan Google terverifikasi bintang 4,7 dari ratusan ulasan nasabah',
      'Kirim uang ke 10 negara/mata uang dengan biaya transparan (PT Pusat Kirim Duit)',
    ],
    socialLinks: {},
  },

  contentLocales: ['id'],

  seo: {
    titleTemplate: '%s | Pusat Valas Indo',
    defaultTitle: 'Pusat Valas Indo — Money Changer Terbaik di Jakarta & Tangerang (Berizin BI)',
    locale: 'id_ID',
  },

  // Satu halaman kuat per topik dengan satu query utama masing-masing (tidak saling bersaing):
  //   /                     → "money changer terbaik di jakarta", nama brand, layanan online kurir & transfer
  //   /pusat-valas-indo     → "jual beli valas jakarta", "tukar valas online jakarta", "tukar dolar/ringgit/yen"
  //   /pusat-kirim-duit     → "kirim uang ke luar negeri untuk pengusaha"
  //   /lokasi/cengkareng    → "money changer Cengkareng / Taman Palem / Jakarta Barat"
  //   /lokasi/tangerang     → "money changer Tangerang / Green Lake City / Cipondoh"
  //   /money-changer-terbaik → "money changer terbaik di jakarta" (panduan memilih + layanan kurir online)
  pages: {
    home: {
      path: '/',
      title: 'Money Changer Terbaik di Jakarta & Tangerang | Pusat Valas Indo',
      description:
        'Money changer terbaik di Jakarta berizin Bank Indonesia sejak 2018. Layanan tukar valas online bebas repot via kurir / transfer untuk Jakarta Selatan, Jakarta Pusat, Jakarta Barat, hingga Tangerang tanpa perlu datang ke kantor.',
      changeFreq: 'weekly',
      priority: 1.0,
      lastModified: '2026-10-12',
    },
    'pusat-valas-indo': {
      path: '/pusat-valas-indo',
      title: 'Tukar Valas Online Bebas Repot Jakarta & Tangerang | Pusat Valas Indo',
      description:
        'Tukar dolar, SGD, EUR, JPY, dan valas lainnya di money changer terbaik berizin BI. Layanan antar kurir & transfer bank untuk Jakarta Selatan, Jakarta Pusat, Jakarta Barat, dan Tangerang.',
      changeFreq: 'monthly',
      priority: 0.9,
      lastModified: '2026-10-12',
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
        'Money changer terpercaya berizin BI di Cengkareng, Jakarta Barat: Ruko Mutiara Taman Palem A5-27. Melayani datang langsung atau order online via kurir ke seluruh Jakarta.',
      changeFreq: 'monthly',
      priority: 0.8,
      lastModified: '2026-10-12',
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
      title: 'Money Changer Terbaik di Jakarta & Tangerang (Berizin Bank Indonesia)',
      description:
        'Panduan money changer terbaik di Jakarta (Jakarta Selatan, Pusat, Barat) & Tangerang: izin resmi BI, kurs transparan, serta layanan online bebas repot dengan sistem kurir & transfer bank tanpa perlu datang ke lokasi.',
      changeFreq: 'monthly',
      priority: 0.8,
      lastModified: '2026-10-12',
    },
    // Indeks blog. Daftar & tanggal terakhirnya dinamis (dari database) — sitemap.ts
    // menimpa lastModified dengan tanggal artikel terbaru dan MELEWATKAN halaman ini
    // selama belum ada artikel terbit (indeks kosong = thin content).
    blog: {
      path: '/blog',
      title: 'Blog Valas: Tips Tukar Uang & Kirim Uang | Pusat Valas Indo',
      description:
        'Artikel dan panduan seputar tukar valas, kurs, dan kirim uang ke luar negeri dari money changer berizin Bank Indonesia di Jakarta & Tangerang.',
      changeFreq: 'weekly',
      priority: 0.7,
      lastModified: '2026-10-20',
    },
  },
};
