/**
 * Data fakta Grup Pusat Valas Indo — satu-satunya sumber untuk landing, JSON-LD,
 * sitemap, dan llms.txt. Setiap nilai harus ✅ di docs/datas/landing-facts.md.
 * Nilai yang belum diketahui ditulis `null` dan TIDAK boleh ditampilkan.
 */

export interface OpeningHours {
  /** Schema.org day names */
  days: ('Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday')[];
  opens: string;
  closes: string;
}

/** Titik lokasi (WGS84). Disalin dari data cabang di admin (Branch.latitude/longitude). */
export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Branch {
  slug: string;
  /** Entitas pemegang izin yang ditampilkan di schema/halaman: kunci di `entities` */
  entity: EntityKey;
  /**
   * PT lain yang beroperasi di kantor yang sama. Cengkareng dan Green Lake City masing-masing
   * satu kantor untuk dua PT (PVI + PTU); di admin keduanya tercatat pada koordinat yang sama.
   */
  coOperators: EntityKey[];
  geo: GeoPoint;
  name: string;
  /** Variasi penulisan yang dicari orang (ejaan "Greenlake", dsb.). Hanya nama tempat, bukan klaim. */
  alternateNames: string[];
  street: string;
  district: string;
  city: string;
  region: string;
  postalCode: string;
  country: 'ID';
  telephone: string | null;
  telephoneDisplay?: string;
  /** Format internasional tanpa +, untuk wa.me */
  whatsapp: string;
  whatsappDisplay: string;
  mapsUrl: string;
  hours: OpeningHours[];
  note?: string;
  /** Petunjuk mencapai lokasi. Hanya dari fakta terverifikasi (situs resmi lama / ulasan Google). */
  directions: string[];
}

export type EntityKey = 'pvi' | 'ptu' | 'pkd';

export interface Entity {
  key: EntityKey;
  slug: string;
  legalName: string;
  shortName: string;
  /** Satu kalimat peran, faktual */
  role: string;
  foundingDate: string | null;
  license: { number: string; issuer: string } | null;
  /** false = belum boleh tampil di publik (data belum cukup) */
  publishable: boolean;
  /** Punya halaman sendiri di /<slug>. PTU tidak: tampil lewat halaman PVI dan halaman cabang. */
  hasPage: boolean;
}

const WEEKDAY: OpeningHours = {
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  opens: '08:00',
  closes: '16:30',
};
const SATURDAY: OpeningHours = { days: ['Saturday'], opens: '08:00', closes: '14:00' };

export const entities: Record<EntityKey, Entity> = {
  pvi: {
    key: 'pvi',
    slug: 'pusat-valas-indo',
    legalName: 'PT Pusat Valas Indo',
    shortName: 'Pusat Valas Indo',
    role: 'Money changer (jual beli valuta asing) berizin Bank Indonesia.',
    foundingDate: '2018',
    license: { number: '20/28/KEP.GBI/DKSP/2018', issuer: 'Bank Indonesia' },
    publishable: true,
    hasPage: true,
  },
  ptu: {
    key: 'ptu',
    slug: 'pusat-tukar-uang',
    legalName: 'PT Pusat Tukar Uang',
    shortName: 'Pusat Tukar Uang',
    role: 'Money changer yang beroperasi satu kantor dengan PT Pusat Valas Indo.',
    // PTU = "PVI versi 2" (owner): lokasi dan tahun berdiri sama dengan PVI, satu kantor di
    // Cengkareng dan Green Lake City (lihat `Branch.coOperators`). Nomor izin sengaja kosong.
    // Cabang "Pluit" hanya ada di seeder lama; tidak ada di database admin.
    foundingDate: '2018',
    license: null,
    publishable: true,
    hasPage: false,
  },
  pkd: {
    key: 'pkd',
    slug: 'pusat-kirim-duit',
    legalName: 'PT Pusat Kirim Duit',
    shortName: 'Pusat Kirim Duit',
    role: 'Pengiriman uang ke luar negeri untuk pengusaha Indonesia.',
    foundingDate: '2024-07-18',
    license: null, // nomor izin & regulator belum dikonfirmasi; jangan tampilkan nama regulator
    publishable: true,
    hasPage: true,
  },
};

export const branches: Branch[] = [
  {
    slug: 'cengkareng',
    entity: 'pvi',
    coOperators: ['ptu'],
    geo: { lat: -6.1370625, lng: 106.7313125 },
    name: 'Pusat Valas Indo Cengkareng (Kantor Pusat)',
    alternateNames: ['Money Changer Cengkareng', 'Pusat Valas Indo Taman Palem', 'PVI Cengkareng'],
    street: 'Ruko Mutiara Taman Palem A5-27, RT 07/RW 14, Cengkareng Timur',
    district: 'Cengkareng',
    city: 'Jakarta Barat',
    region: 'DKI Jakarta',
    postalCode: '11730',
    country: 'ID',
    telephone: '+622129513988',
    telephoneDisplay: '(021) 2951 3988',
    whatsapp: '6281770099920',
    whatsappDisplay: '0817-7009-9920',
    mapsUrl: 'https://maps.app.goo.gl/P37npFa6zb3nYR8Y6',
    hours: [WEEKDAY, SATURDAY],
    note: 'Ruko blok A, parkir di luar kompleks Taman Palem.',
    directions: [
      'Berada di Ruko Mutiara Taman Palem, blok A.',
      'Gedungnya tinggi sehingga terlihat dari jalan raya.',
      'Parkir di luar; tidak perlu masuk ke dalam kompleks Taman Palem.',
    ],
  },
  {
    slug: 'tangerang',
    entity: 'pvi',
    coOperators: ['ptu'],
    geo: { lat: -6.1842887, lng: 106.7095652 },
    name: 'Pusat Valas Indo Tangerang (Green Lake City)',
    alternateNames: ['Money Changer Tangerang', 'Money Changer Greenlake', 'Pusat Valas Indo Green Lake City', 'PVI Tangerang'],
    street: 'Jl. Green Lake City Boulevard, Rukan Wallstreet A No. 16, Petir',
    district: 'Cipondoh',
    city: 'Kota Tangerang',
    region: 'Banten',
    postalCode: '15147',
    country: 'ID',
    telephone: null,
    whatsapp: '6282333800080',
    whatsappDisplay: '0823-3380-0080',
    mapsUrl: 'https://maps.app.goo.gl/1SGvqb2UvqXpotfN9',
    hours: [WEEKDAY, SATURDAY],
    directions: [
      'Berada di Rukan Wallstreet, Jl. Green Lake City Boulevard.',
      'Lokasinya dekat dengan bank.',
    ],
  },
];

/** Kontak PKD. Alamat sama dengan cabang Tangerang PVI (perlu konfirmasi: satu ruko?). */
export const pkdContact = {
  whatsapp: '6287771690203',
  whatsappDisplay: '0877-7169-0203',
  branchSlug: 'tangerang',
  /**
   * Koordinat dari admin (cabang "Pusat Kirim Duit"). ⚠️ Jatuh ±500 m dari kantor Cengkareng dan
   * ±6 km dari Green Lake City, padahal alamat PKD tertulis Green Lake City. Belum dikonfirmasi
   * owner: karena itu TIDAK dimasukkan ke JSON-LD, hanya ke peta di halaman PKD.
   */
  geo: { lat: -6.132385, lng: 106.732719 } satisfies GeoPoint,
};

/** Embed peta tanpa API key (pin di titik koordinat). */
export function mapEmbedUrl({ lat, lng }: GeoPoint, zoom = 17): string {
  return `https://www.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`;
}

/** Tautan rute Google Maps ke titik koordinat. */
export function directionsUrl({ lat, lng }: GeoPoint): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export const pvi = {
  googleRating: 4.7,
  googleReviewCount: 359,
  googleReviewAsOf: '2026-09',
};

export function whatsappUrl(number: string, text?: string): string {
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${number}${q}`;
}

export function branchBySlug(slug: string): Branch | undefined {
  return branches.find((b) => b.slug === slug);
}

export function branchesOf(entity: EntityKey): Branch[] {
  return branches.filter((b) => b.entity === entity);
}
