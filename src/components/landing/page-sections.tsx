import type { ReactNode } from 'react';

import {
  branches,
  directionsUrl,
  entities,
  mapEmbedUrl,
  pkdContact,
  type Branch,
  type GeoPoint,
} from '@/config/group';
import { currencyCodes, currencyNames, relatedLinks } from '@/content/landing';
import { Link } from '@/i18n/routing';
import { serializeSchema } from '@/lib/structured-data';

import { HoursBadge } from './hours-badge';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import { CurrencyChip, Em, Eyebrow, H2, Section } from './ui';

const labelCls = 'text-xs font-semibold uppercase tracking-[0.12em] text-lp-ink-mute';
export const linkCls =
  'text-sm font-semibold text-lp-red-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-red-700';

export const ASK_RATE = 'Halo, saya mau tanya kurs hari ini.';
export const ASK_REMIT = 'Halo, saya mau tanya pengiriman uang ke luar negeri.';

/** Kerangka halaman dalam: JSON-LD + header + main + footer. */
export function InnerPage({
  id,
  schemas,
  children,
}: {
  id: string;
  schemas: Parameters<typeof serializeSchema>[0];
  children: ReactNode;
}) {
  return (
    <>
      <script
        id={`${id}-jsonld`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeSchema(schemas) }}
      />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}

const DAY_ID: Record<string, string> = {
  Monday: 'Senin', Tuesday: 'Selasa', Wednesday: 'Rabu', Thursday: 'Kamis',
  Friday: 'Jumat', Saturday: 'Sabtu', Sunday: 'Minggu',
};

/** Peta dengan pin di titik koordinat (data admin) + tautan rute. Iframe lazy: tidak membebani LCP. */
export function LocationMap({ geo, name }: { geo: GeoPoint; name: string }) {
  return (
    <div>
      <div className="aspect-[4/3] w-full overflow-hidden border border-lp-line bg-lp-paper-2 sm:aspect-[16/7]">
        <iframe
          src={mapEmbedUrl(geo)}
          title={`Peta lokasi ${name}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="size-full border-0"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm tabular-nums text-lp-ink-mute">
          {geo.lat.toFixed(6)}, {geo.lng.toFixed(6)}
        </span>
        <a href={directionsUrl(geo)} target="_blank" rel="noopener noreferrer" className={linkCls}>
          Petunjuk arah di Google Maps →
        </a>
      </div>
    </div>
  );
}

/** Jam kerja cabang, disusun dari `branch.hours` supaya selalu sama dengan JSON-LD. */
export function HoursList({ branch }: { branch: Branch }) {
  const rows: [string, string][] = branch.hours.map((h) => [
    h.days.length > 1 ? `${DAY_ID[h.days[0]]}–${DAY_ID[h.days[h.days.length - 1]]}` : DAY_ID[h.days[0]],
    `${h.opens.replace(':', '.')}–${h.closes.replace(':', '.')}`,
  ]);
  if (!branch.hours.some((h) => h.days.includes('Sunday'))) rows.push(['Minggu', 'Tutup']);
  return (
    <dl className="divide-y divide-lp-line border-y border-lp-line text-sm">
      {rows.map(([d, t]) => (
        <div key={d} className="flex justify-between py-2">
          <dt className="text-lp-ink-mute">{d}</dt>
          <dd className="tabular-nums">
            {t} {t !== 'Tutup' && <span className="text-lp-ink-mute">WIB</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Dua cara transaksi, lebih rinci dari ringkasan di beranda. Isi hanya dari fakta terverifikasi. */
export function PviChannels() {
  const channels = [
    {
      n: '01',
      name: 'Online',
      body: 'Tidak perlu datang ke kantor.',
      steps: [
        'Kirim pesan WhatsApp ke cabang terdekat.',
        'Tanyakan kurs beli atau jual dan ketersediaan mata uangnya.',
        'Selesaikan pembayaran melalui transfer bank.',
      ],
    },
    {
      n: '02',
      name: 'On the spot',
      body: 'Transaksi tunai langsung di kantor.',
      steps: [
        'Datang ke Cengkareng (Jakarta Barat) atau Green Lake City (Tangerang).',
        'Kunjungi pada jam kerja: Senin–Jumat 08.00–16.30, Sabtu 08.00–14.00 WIB.',
        'Lakukan penukaran secara langsung.',
      ],
    },
  ];
  return (
    <Section tone="paper2">
      <Eyebrow>Cara bertransaksi</Eyebrow>
      <H2 className="mt-3 max-w-3xl">
        Dua cara tukar valas: <Em>online</Em> atau langsung.
      </H2>
      <div className="mt-14 divide-y divide-lp-line border-y border-lp-ink">
        {channels.map((c) => (
          <div key={c.n} className="grid gap-5 py-8 md:grid-cols-[6rem_1fr_1.4fr] md:items-baseline">
            <span className="font-display text-lp-figure font-bold tabular-nums text-lp-red-700">{c.n}</span>
            <div>
              <h3 className="font-display text-[clamp(1.75rem,1.3rem+2vw,3rem)] font-bold leading-none tracking-[-0.03em]">
                {c.name}
              </h3>
              <p className="mt-3 text-lp-ink-soft">{c.body}</p>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-lp-ink-soft marker:font-semibold marker:text-lp-red-700">
              {c.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Kode ISO + nama umum, untuk pencarian seperti "tukar ringgit" atau "beli dolar Singapura". */
export function CurrencyList() {
  return (
    <Section>
      <Eyebrow>Mata uang</Eyebrow>
      <H2 className="mt-3 max-w-3xl">
        Mata uang yang <Em>sering ditransaksikan.</Em>
      </H2>
      <p className="mt-6 max-w-2xl text-lp-lead text-lp-ink-soft">
        Ketersediaan mengikuti stok. Kurs beli dan jual berubah sepanjang hari, jadi tidak kami pajang di
        situs; tanyakan kurs terkini lewat WhatsApp.
      </p>
      <ul className="mt-12 grid border-l border-t border-lp-line sm:grid-cols-2 lg:grid-cols-3">
        {currencyCodes.map((code) => (
          <li key={code} className="flex items-baseline gap-4 border-b border-r border-lp-line px-5 py-4">
            <CurrencyChip code={code} className="w-10 text-base text-lp-red-700" />
            <span className="text-lp-ink-soft">{currencyNames[code] ?? code}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Kartu ringkas cabang → halaman /lokasi/*. */
export function BranchLinks({ title, tone = 'paper2' }: { title?: ReactNode; tone?: 'paper' | 'paper2' }) {
  return (
    <Section tone={tone}>
      <Eyebrow>Lokasi &amp; jam</Eyebrow>
      <H2 className="mt-3 max-w-3xl">{title ?? <>Dua kantor, <Em>satu jam kerja.</Em></>}</H2>
      <div className="mt-14 grid gap-x-14 gap-y-12 border-t border-lp-ink pt-10 md:grid-cols-2">
        {branches.map((b) => (
          <address key={b.slug} className="flex flex-col not-italic">
            <HoursBadge hours={b.hours} className="text-lp-ink-soft" />
            <p className="mt-4 font-display text-lp-h3 font-bold leading-tight tracking-[-0.02em]">{b.name}</p>
            <p className="mt-3 max-w-sm text-lp-ink-soft">
              {b.street}, {b.district}, {b.city}, {b.region} {b.postalCode}
            </p>
            <Link href={`/lokasi/${b.slug}`} className={`${linkCls} mt-5 inline-block`}>
              Petunjuk lokasi dan detail cabang →
            </Link>
          </address>
        ))}
      </div>
    </Section>
  );
}

/** Empat langkah kirim uang, seluruhnya dari jawaban owner PKD (landing-facts §3). */
export function PkdSteps() {
  const steps = [
    {
      title: 'Hubungi via WhatsApp',
      body: 'Transaksi bisa dilakukan online tanpa datang ke kantor.',
    },
    {
      title: 'Siapkan dokumen',
      body: 'KTP untuk perorangan; KTP direktur, NIB, dan NPWP untuk perusahaan. Nominal di atas USD 10.000 memerlukan dokumen underlying.',
    },
    {
      title: 'Dana diproses',
      body: 'Estimasi 2–4 hari kerja, dengan kurs yang mengikuti rate real-time, bukan kurs tetap.',
    },
    {
      title: 'Penerima menarik dana',
      body: 'Penerima mengambil uangnya di bank atau ATM setempat.',
    },
  ];
  return (
    <Section tone="paper2">
      <Eyebrow>Cara kirim</Eyebrow>
      <H2 className="mt-3 max-w-3xl">
        Empat langkah, <Em>tanpa ke kantor.</Em>
      </H2>
      <ol className="mt-14 grid gap-10 border-t border-lp-ink pt-10 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title}>
            <span className="font-display text-lp-figure font-bold tabular-nums text-lp-red-700">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="mt-3 font-display text-lp-h3 font-bold leading-tight">{s.title}</p>
            <p className="mt-2 text-lp-ink-soft">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** Profil PKD. Regulator & nomor izin sengaja tidak ditulis (belum dikonfirmasi owner). */
export function PkdProfile() {
  const pkd = entities.pkd;
  const office = branches.find((b) => b.slug === pkdContact.branchSlug) ?? branches[1];
  const rows: [string, ReactNode][] = [
    ['Berdiri', '18 Juli 2024'],
    ['Status', 'Terdaftar sebagai KUPVA / Penyelenggara Transfer Dana (PTD)'],
    ['Untuk', 'Pengusaha Indonesia yang mengirim uang ke luar negeri'],
    [
      'Alamat',
      `${office.street}, ${office.district}, ${office.city}, ${office.region} ${office.postalCode}`,
    ],
    ['Jam kerja', 'Senin–Jumat 08.00–16.30 · Sabtu 08.00–14.00 WIB'],
    ['WhatsApp', pkdContact.whatsappDisplay],
  ];
  return (
    <Section>
      <Eyebrow>Profil</Eyebrow>
      <H2 className="mt-3 max-w-3xl">
        {pkd.legalName}, <Em>singkatnya.</Em>
      </H2>
      <dl className="mt-14 divide-y divide-lp-line border-y border-lp-ink">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-4 md:grid-cols-[12rem_1fr] md:gap-6">
            <dt className={labelCls}>{k}</dt>
            <dd className="text-lp-ink-soft">{v}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/** Blok isi halaman cabang: alamat, jam, kontak, dan petunjuk lokasi. */
export function BranchDetail({ branch }: { branch: Branch }) {
  return (
    <Section>
      <div className="grid gap-14 lg:grid-cols-2">
        <address className="not-italic">
          <p className={labelCls}>Alamat</p>
          <p className="mt-3 max-w-sm font-display text-lp-h3 font-bold leading-tight tracking-[-0.02em]">
            {branch.street}
          </p>
          <p className="mt-2 text-lp-ink-soft">
            {branch.district}, {branch.city}, {branch.region} {branch.postalCode}
          </p>

          <p className={`${labelCls} mt-10`}>Jam kerja</p>
          <HoursBadge hours={branch.hours} className="mt-3 text-lp-ink-soft" />
          <div className="mt-4">
            <HoursList branch={branch} />
          </div>

          <p className={`${labelCls} mt-10`}>Perusahaan di kantor ini</p>
          <ul className="mt-3 space-y-1 text-lp-ink-soft">
            {[branch.entity, ...branch.coOperators].map((k) => (
              <li key={k}>
                {entities[k].legalName}
                {entities[k].license && (
                  <span className="text-lp-ink-mute">
                    {' '}
                    · izin {entities[k].license?.issuer} No. {entities[k].license?.number}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <p className={`${labelCls} mt-10`}>Kontak</p>
          <p className="mt-3 text-lp-ink-soft">
            WhatsApp <span className="tabular-nums">{branch.whatsappDisplay}</span>
            {branch.telephoneDisplay && (
              <>
                {' '}
                · Telp <span className="tabular-nums">{branch.telephoneDisplay}</span>
              </>
            )}
          </p>
        </address>

        <div>
          <p className={labelCls}>Cara menuju lokasi</p>
          <ul className="mt-4 divide-y divide-lp-line border-y border-lp-ink">
            {branch.directions.map((d) => (
              <li key={d} className="py-4 text-lp-ink-soft">
                {d}
              </li>
            ))}
          </ul>
          <a
            href={branch.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkCls} mt-5 inline-block`}
          >
            Buka di Google Maps →
          </a>
        </div>
      </div>
      <div className="mt-14">
        <p className={`${labelCls} mb-4`}>Titik lokasi</p>
        <LocationMap geo={branch.geo} name={branch.name} />
      </div>
    </Section>
  );
}

/** Tautan silang antar cabang dan ke halaman layanan (internal linking). */
export function BranchCrossLinks({ branch }: { branch: Branch }) {
  const other = branches.filter((b) => b.slug !== branch.slug);
  const hostsPkd = pkdContact.branchSlug === branch.slug;
  return (
    <Section tone="paper2">
      <Eyebrow>Layanan di cabang ini</Eyebrow>
      <H2 className="mt-3 max-w-3xl">
        Tukar valas, <Em>online atau langsung.</Em>
      </H2>
      <p className="mt-6 max-w-2xl text-lp-lead text-lp-ink-soft">
        Kantor ini melayani jual beli valuta asing untuk {entities.pvi.legalName} (izin Bank Indonesia
        No. {entities.pvi.license?.number}) dan {entities.ptu.legalName}. Konsultasi kurs dan transaksi
        bisa lewat WhatsApp, atau datang langsung pada jam kerja.
      </p>
      <ul className="mt-8 space-y-3">
        <li>
          <Link href="/pusat-valas-indo" className={linkCls}>
            Daftar mata uang dan cara transaksi →
          </Link>
        </li>
        {hostsPkd && (
          <li>
            <Link href="/pusat-kirim-duit" className={linkCls}>
              Kirim uang ke luar negeri untuk pengusaha (PT Pusat Kirim Duit, alamat yang sama) →
            </Link>
          </li>
        )}
        {other.map((b) => (
          <li key={b.slug}>
            <Link href={`/lokasi/${b.slug}`} className={linkCls}>
              Cabang lain: {b.name} →
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Lokasi PKD. Koordinat dari admin; lihat catatan di `pkdContact.geo`. */
export function PkdLocation() {
  const office = branches.find((b) => b.slug === pkdContact.branchSlug) ?? branches[1];
  return (
    <Section tone="paper2">
      <Eyebrow>Lokasi</Eyebrow>
      <H2 className="mt-3 max-w-3xl">
        Titik lokasi <Em>Pusat Kirim Duit.</Em>
      </H2>
      <p className="mt-6 max-w-2xl text-lp-ink-soft">
        {office.street}, {office.district}, {office.city}, {office.region} {office.postalCode}
      </p>
      <div className="mt-10">
        <LocationMap geo={pkdContact.geo} name={entities.pkd.legalName} />
      </div>
    </Section>
  );
}

/** Jaring tautan internal: setiap halaman menautkan ke semua halaman lain dengan anchor berisi kata kunci. */
export function RelatedLinks({ currentPath, tone = 'paper' }: { currentPath: string; tone?: 'paper' | 'paper2' }) {
  return (
    <Section tone={tone}>
      <Eyebrow>Halaman terkait</Eyebrow>
      <H2 className="mt-3 max-w-3xl">
        Lanjut ke <Em>layanan dan lokasi lain.</Em>
      </H2>
      <ul className="mt-14 grid gap-x-14 gap-y-8 border-t border-lp-ink pt-10 md:grid-cols-2">
        {relatedLinks(currentPath).map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={linkCls}>
              {l.label} →
            </Link>
            <p className="mt-1 text-sm text-lp-ink-mute">{l.desc}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
