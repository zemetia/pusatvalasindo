import { entities, type Branch } from '@/config/group';

/**
 * Copy landing (Indonesia). Setiap klaim harus ✅ di docs/datas/landing-facts.md.
 * Terjemahan Inggris belum ada → halaman /en belum diindeks (lihat siteConfig.contentLocales).
 */

/** Tautan nyata (bukan anchor) supaya menu berfungsi di semua halaman dan menjadi tautan internal. */
export const nav = [
  { href: '/pusat-valas-indo', label: 'Tukar Valas' },
  { href: '/pusat-kirim-duit', label: 'Kirim Uang' },
  { href: '/lokasi/cengkareng', label: 'Cengkareng' },
  { href: '/lokasi/tangerang', label: 'Tangerang' },
  { href: '/money-changer-terbaik', label: 'Cara Memilih' },
  { href: '/#faq', label: 'FAQ' },
];

/**
 * Tautan internal antar halaman (jaring tautan). Anchor sengaja memakai frasa pencarian yang
 * dituju halaman tujuan; `related()` membuang halaman yang sedang dibuka.
 */
export const internalLinks = [
  { href: '/', label: 'Money changer Jakarta Barat & Tangerang', desc: 'Ringkasan grup Pusat Valas Indo, layanan, dan lokasi.' },
  { href: '/pusat-valas-indo', label: 'Jual beli valas berizin Bank Indonesia', desc: 'Mata uang, cara transaksi online dan langsung.' },
  { href: '/pusat-kirim-duit', label: 'Kirim uang ke luar negeri untuk pengusaha', desc: 'Biaya, minimum, dokumen, dan estimasi waktu.' },
  { href: '/lokasi/cengkareng', label: 'Money changer Cengkareng, Jakarta Barat', desc: 'Alamat, jam buka, dan petunjuk ke Taman Palem.' },
  { href: '/lokasi/tangerang', label: 'Money changer Tangerang, Green Lake City', desc: 'Alamat Rukan Wallstreet, jam buka, dan WhatsApp.' },
  { href: '/money-changer-terbaik', label: 'Cara memilih money changer terbaik', desc: 'Enam kriteria yang bisa Anda periksa sendiri.' },
] as const;

export function relatedLinks(currentPath: string) {
  return internalLinks.filter((l) => l.href !== currentPath);
}

/** Kode ISO saja — ketersediaan mengikuti stok, bukan janji publik (fakta #3 belum diputuskan). */
export const currencyCodes = [
  'USD', 'SGD', 'EUR', 'JPY', 'AUD', 'MYR', 'SAR', 'GBP', 'CNY', 'THB', 'HKD', 'KRW',
];

/** Nama umum mata uang untuk pencarian long-tail ("tukar ringgit", "beli dolar Singapura"). */
export const currencyNames: Record<string, string> = {
  USD: 'Dolar Amerika Serikat',
  SGD: 'Dolar Singapura',
  EUR: 'Euro',
  JPY: 'Yen Jepang',
  AUD: 'Dolar Australia',
  MYR: 'Ringgit Malaysia',
  SAR: 'Riyal Arab Saudi',
  GBP: 'Poundsterling Inggris',
  CNY: 'Yuan Tiongkok',
  THB: 'Baht Thailand',
  HKD: 'Dolar Hong Kong',
  KRW: 'Won Korea Selatan',
};

export const pkdCurrencies = [
  { code: 'USD', country: 'Amerika Serikat' },
  { code: 'JPY', country: 'Jepang' },
  { code: 'GBP', country: 'Inggris' },
  { code: 'EUR', country: 'Eropa' },
  { code: 'CHF', country: 'Swiss' },
  { code: 'NZD', country: 'Selandia Baru' },
  { code: 'CAD', country: 'Kanada' },
  { code: 'SGD', country: 'Singapura' },
  { code: 'HKD', country: 'Hong Kong' },
  { code: 'AUD', country: 'Australia' },
];

export const pkdFees = [
  { scenario: 'Di bawah USD 10.000, penerima terima penuh', fee: 'USD 40 + Rp 200.000' },
  { scenario: 'Di bawah USD 10.000, tidak terima penuh', fee: 'USD 15 + Rp 200.000' },
  { scenario: 'Di atas USD 10.000, penerima terima penuh', fee: 'USD 40' },
  { scenario: 'Di atas USD 10.000, tidak terima penuh', fee: 'USD 15' },
];

export const steps = [
  { title: 'Tanya kurs', body: 'Kirim pesan WhatsApp untuk kurs terkini dan ketersediaan mata uang.' },
  { title: 'Siapkan dokumen', body: 'Bawa KTP. Untuk kirim uang di atas USD 10.000 siapkan juga dokumen underlying.' },
  { title: 'Transaksi', body: 'Datang ke kantor, atau selesaikan lewat transfer bank untuk transaksi online.' },
];

export const documents = {
  personal: ['KTP', 'Dokumen underlying, bila nominal di atas USD 10.000'],
  company: ['KTP direktur', 'NIB', 'NPWP perusahaan', 'Dokumen underlying'],
};

export const reviews = [
  {
    quote: 'Lokasi nya di Ruko Blok A Mudah di capai, karna bangunanya tinggi, terlihat dari depan jalan raya. Pelayanan nya ramah.',
  },
  { quote: 'Good rate. Pelayanan cepat & profesional.' },
  { quote: 'The bosses were very patient and friendly during the process.' },
];

export type FaqTopic = 'umum' | 'pvi' | 'pkd';

export interface FaqItem {
  q: string;
  a: string;
  topic: FaqTopic;
}

const allFaqs: FaqItem[] = [
  {
    topic: 'umum',
    q: 'Apa bedanya PT Pusat Valas Indo, PT Pusat Tukar Uang, dan PT Pusat Kirim Duit?',
    a: 'PT Pusat Valas Indo adalah money changer (jual beli valuta asing) berizin Bank Indonesia, berkantor di Cengkareng. PT Pusat Tukar Uang juga money changer, berkantor di Green Lake City. PT Pusat Kirim Duit melayani pengiriman uang (remitansi) ke luar negeri untuk pengusaha Indonesia, dengan kantor di Green Lake City.',
  },
  {
    topic: 'pvi',
    q: 'Apakah Pusat Valas Indo berizin?',
    a: 'Ya. PT Pusat Valas Indo berizin Bank Indonesia dengan nomor 20/28/KEP.GBI/DKSP/2018 dan beroperasi sejak 2018.',
  },
  {
    topic: 'umum',
    q: 'Jam buka dan lokasinya di mana?',
    a: 'Cabang Cengkareng (Jakarta Barat) dan Tangerang (Green Lake City, Cipondoh) buka Senin–Jumat 08.00–16.30 WIB dan Sabtu 08.00–14.00 WIB. Minggu tutup.',
  },
  {
    topic: 'pvi',
    q: 'Apakah bisa transaksi online tanpa datang ke kantor?',
    a: 'Bisa. Konsultasi kurs dan transaksi dapat dilakukan lewat WhatsApp dengan pembayaran melalui transfer bank. Anda juga bisa datang langsung untuk transaksi tunai.',
  },
  {
    topic: 'pvi',
    q: 'Berapa kurs hari ini?',
    a: 'Kurs berubah sepanjang hari, jadi kami tidak memajangnya di situs. Tanyakan kurs beli dan jual terkini lewat WhatsApp.',
  },
  {
    topic: 'pkd',
    q: 'Dokumen apa yang perlu disiapkan untuk kirim uang ke luar negeri?',
    a: 'Untuk perorangan cukup KTP; untuk nominal di atas USD 10.000 diperlukan dokumen underlying. Untuk perusahaan: KTP direktur, NIB, NPWP perusahaan, dan dokumen underlying.',
  },
  {
    topic: 'pkd',
    q: 'Berapa minimum dan biaya kirim uang ke luar negeri lewat Pusat Kirim Duit?',
    a: 'Minimum USD 1.000 (atau ekuivalen) per transaksi. Di bawah USD 10.000 biayanya USD 40 + Rp 200.000 (penerima terima penuh) atau USD 15 + Rp 200.000 (tidak penuh). Di atas USD 10.000 biayanya USD 40 (penuh) atau USD 15 (tidak penuh), tanpa biaya tambahan.',
  },
  {
    topic: 'pkd',
    q: 'Berapa lama pengiriman uang ke luar negeri?',
    a: 'Estimasi 2–4 hari kerja, dengan kurs yang mengikuti rate real-time.',
  },
  {
    topic: 'pkd',
    q: 'Ke negara mana saja Pusat Kirim Duit bisa mengirim?',
    a: 'Amerika Serikat, Jepang, Inggris, Eropa, Swiss, Selandia Baru, Kanada, Singapura, Hong Kong, dan Australia.',
  },
  {
    topic: 'pkd',
    q: 'Bagaimana penerima mengambil uangnya?',
    a: 'Penerima menarik dana di bank atau ATM setempat.',
  },
];

/** Semua FAQ (beranda). */
export const faqs = allFaqs;

/** FAQ untuk halaman bertopik: item topik itu + item umum. */
export function faqsFor(topic: Exclude<FaqTopic, 'umum'>): FaqItem[] {
  return allFaqs.filter((f) => f.topic === topic || f.topic === 'umum');
}

/** Copy halaman cabang. Query utama tiap halaman berbeda supaya tidak saling bersaing. */
export const branchCopy: Record<string, { h1: [string, string]; lead: string; area: string }> = {
  cengkareng: {
    h1: ['Money changer terpercaya di ', 'Cengkareng, Jakarta Barat'],
    lead: 'Money changer terpercaya dan berizin Bank Indonesia di Cengkareng. Kantor pusat Pusat Valas Indo berada di Ruko Mutiara Taman Palem, Cengkareng Timur, Jakarta Barat. Satu kantor untuk PT Pusat Valas Indo (berizin Bank Indonesia sejak 2018) dan PT Pusat Tukar Uang, melayani jual beli valuta asing secara online maupun langsung.',
    area: 'Cengkareng, Jakarta Barat',
  },
  tangerang: {
    h1: ['Money changer terpercaya di ', 'Tangerang, Green Lake City'],
    lead: 'Money changer terpercaya dan berizin Bank Indonesia di Tangerang. Cabang Pusat Valas Indo di Rukan Wallstreet, Green Lake City (Greenlake), Cipondoh, Kota Tangerang. Satu kantor untuk PT Pusat Valas Indo dan PT Pusat Tukar Uang; tukar valas lewat WhatsApp atau datang langsung pada jam kerja.',
    area: 'Green Lake City, Cipondoh, Kota Tangerang',
  },
};

const DAY_ID: Record<string, string> = {
  Monday: 'Senin', Tuesday: 'Selasa', Wednesday: 'Rabu', Thursday: 'Kamis',
  Friday: 'Jumat', Saturday: 'Sabtu', Sunday: 'Minggu',
};

/** FAQ khusus cabang, disusun dari data cabang (alamat, jam, kontak) agar selalu konsisten dengan JSON-LD. */
export function branchFaqs(b: Branch): FaqItem[] {
  const hours = b.hours
    .map((h) => {
      const days =
        h.days.length > 1 ? `${DAY_ID[h.days[0]]}–${DAY_ID[h.days[h.days.length - 1]]}` : DAY_ID[h.days[0]];
      return `${days} ${h.opens.replace(':', '.')}–${h.closes.replace(':', '.')}`;
    })
    .join(', ');
  const contact = `WhatsApp ${b.whatsappDisplay}${b.telephoneDisplay ? ` atau telepon ${b.telephoneDisplay}` : ''}`;
  return [
    {
      topic: 'umum',
      q: `Di mana alamat ${b.name}?`,
      a: `${b.street}, ${b.district}, ${b.city}, ${b.region} ${b.postalCode}. ${b.directions.join(' ')}`,
    },
    {
      topic: 'umum',
      q: `Jam buka ${b.name}?`,
      a: `${hours} WIB. Minggu tutup.`,
    },
    {
      topic: 'umum',
      q: `Bagaimana menghubungi ${b.name}?`,
      a: `Lewat ${contact}. Konsultasi kurs dan transaksi bisa dilakukan online, atau datang langsung pada jam kerja.`,
    },
    {
      topic: 'umum',
      q: `Apakah ${b.name} money changer terpercaya di ${b.district}?`,
      a: `Ya. ${entities[b.entity].legalName} berizin Bank Indonesia No. ${entities[b.entity].license?.number} dan beroperasi sejak ${entities[b.entity].foundingDate}, dengan alamat dan jam buka yang bisa dicek di Google Maps: ${b.mapsUrl}.`,
    },
  ];
}
