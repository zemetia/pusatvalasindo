import { branches, entities, pkdContact, pvi, whatsappUrl } from '@/config/group';
import { Link } from '@/i18n/routing';
import {
  currencyCodes,
  currencyNames,
  documents,
  faqs,
  type FaqItem,
  pkdCurrencies,
  pkdFees,
  reviews,
  steps,
} from '@/content/landing';

import { HoursBadge } from './hours-badge';
import { Container, CurrencyChip, Em, Eyebrow, H2, Section, WhatsAppButton } from './ui';

const hq = branches[0];
const tangerang = branches[1];
const ASK_RATE = 'Halo, saya mau tanya kurs hari ini.';
const ASK_REMIT = 'Halo, saya mau tanya pengiriman uang ke luar negeri.';

const labelCls = 'text-xs font-semibold uppercase tracking-[0.12em] text-lp-ink-mute';
const linkCls =
  'text-sm font-semibold text-lp-red-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-red-700';

const boardCodes = ['USD', 'SGD', 'EUR', 'JPY', 'AUD', 'MYR'];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-lp-paper text-lp-ink">
      <div aria-hidden className="absolute inset-y-0 right-0 hidden w-[46%] bg-lp-night lg:block" />
      <Container className="relative grid gap-14 py-[clamp(3.5rem,2.5rem+5vw,7rem)] lg:grid-cols-[1.25fr_1fr] lg:gap-20">
        <div className="lp-rise flex flex-col justify-center">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-lp-ink-mute">
            <span aria-hidden className="h-px w-8 bg-lp-red-700" />
            Berizin Bank Indonesia · sejak 2018
          </p>
          <h1 className="mt-6 font-display text-[clamp(2.5rem,1rem+4.6vw,5rem)] font-bold leading-[0.98] tracking-[-0.035em] text-balance">
            Tukar valas dengan <Em>tenang.</Em>
          </h1>
          <p className="mt-6 max-w-xl text-lp-lead leading-[1.55] text-lp-ink-soft">
            Pusat Valas Indo adalah money changer berizin Bank Indonesia. Kami melayani jual beli valuta asing di Cengkareng dan Tangerang. Tanya kurs
            hari ini lewat WhatsApp, atau datang langsung ke kantor.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <WhatsAppButton number={hq.whatsapp} text={ASK_RATE}>
              Tanya kurs via WhatsApp
            </WhatsAppButton>
            <a href="#lokasi" className={linkCls}>
              Lihat lokasi &amp; jam →
            </a>
          </div>
          <dl className="mt-14 grid max-w-xl gap-y-5 border-t border-lp-line pt-6 sm:grid-cols-2 sm:gap-x-8">
            <HeroFact term="Izin Bank Indonesia" value="No. 20/28/KEP.GBI/DKSP/2018" />
            <HeroFact term="Ulasan Google" value={`${pvi.googleRating.toLocaleString('id-ID')} bintang · ${pvi.googleReviewCount} ulasan`} />
          </dl>
        </div>

        <div className="lp-rise rounded-[1.25rem] bg-lp-night p-6 text-white sm:p-8 lg:-my-4 lg:rounded-none lg:bg-transparent lg:p-0 lg:py-4 lg:pl-4">
          <div className="flex items-center justify-between gap-4 border-b border-lp-night-line pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Papan valas</p>
            <HoursBadge hours={hq.hours} className="text-white/80" />
          </div>
          <ul>
            {boardCodes.map((c) => (
              <li key={c} className="border-b border-lp-night-line">
                <a
                  href={whatsappUrl(hq.whatsapp, `Halo, saya mau tanya kurs ${c} hari ini.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-baseline gap-4 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <CurrencyChip code={c} className="w-12 text-base text-white" />
                  <span className="flex-1 truncate text-sm text-white/65">{currencyNames[c]}</span>
                  <span className="text-xs font-semibold text-lp-brass transition-transform duration-150 group-hover:translate-x-0.5">
                    Tanya kurs →
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="pt-4 text-xs leading-relaxed text-white/50">
            Kurs dikonfirmasi lewat WhatsApp sesuai jam kerja (WIB). Mata uang lain juga bisa ditanyakan.
          </p>
        </div>
      </Container>
    </section>
  );
}

function HeroFact({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-lp-ink-mute">{term}</dt>
      <dd className="mt-1 text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Tampilan per PT — WAJIB TIGA (PVI, PTU, PKD). Owner meminta PTU tampil di landing sebagai
 * PT tersendiri (permintaan terbaru menggantikan catatan lama "PTU bagian brand PVI"). Jangan
 * dihapus. Fakta di sini harus ✅ di landing-facts.md. PTU: lokasi & tahun berdiri sama dengan PVI
 * (satu kantor), izin sengaja kosong; tidak punya halaman sendiri, tautannya ke halaman cabang.
 */
const entityCards: {
  key: keyof typeof entities;
  code: string;
  tag: string;
  place: string;
  href?: string;
  cta?: string;
}[] = [
  { key: 'pvi', code: 'PVI', tag: 'Money changer', place: 'Cengkareng · Cipondoh (Tangerang)', href: '/pusat-valas-indo', cta: 'Layanan valas' },
  { key: 'ptu', code: 'PTU', tag: 'Money changer', place: 'Cengkareng · Cipondoh (Tangerang)', href: '/lokasi/cengkareng', cta: 'Lokasi kantor' },
  { key: 'pkd', code: 'PKD', tag: 'Kirim uang ke luar negeri', place: 'Green Lake City, Tangerang', href: '/pusat-kirim-duit', cta: 'Biaya & negara tujuan' },
];

export function Entities() {
  return (
    <Section id="grup">
      <Eyebrow>Grup Pusat Valas Indo</Eyebrow>
      <H2 className="mt-3 max-w-3xl">
        Tiga perusahaan, <Em>satu</Em> tujuan: urusan uang lintas negara.
      </H2>
      <div className="mt-14 grid border-t border-lp-ink md:grid-cols-3">
        {entityCards.map((c, i) => {
          const e = entities[c.key];
          return (
            <article
              key={c.key}
              className="group relative flex flex-col gap-6 border-b border-lp-line py-10 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0 md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:border-lp-line"
            >
              <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-lp-red-700 transition-transform duration-500 [transition-timing-function:var(--lp-ease)] group-hover:scale-x-100" />
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lp-figure font-bold tabular-nums text-lp-line transition-colors duration-300 group-hover:text-lp-red-700">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-mono text-xs font-semibold tracking-[0.2em] text-lp-ink-mute">{c.code}</span>
              </div>

              <div>
                <h3 className="font-display text-lp-h3 font-bold leading-tight tracking-[-0.02em]">{e.legalName}</h3>
                <p className="mt-1 text-sm font-semibold text-lp-red-700">{c.tag}</p>
              </div>

              <dl className="space-y-3 border-t border-lp-line pt-5 text-sm">
                <div>
                  <dt className={labelCls}>Lokasi</dt>
                  <dd className="mt-0.5 text-lp-ink-soft">{c.place}</dd>
                </div>
                {e.foundingDate && (
                  <div>
                    <dt className={labelCls}>Berdiri</dt>
                    <dd className="mt-0.5 tabular-nums text-lp-ink-soft">{e.key === 'pkd' ? '18 Juli 2024' : e.foundingDate}</dd>
                  </div>
                )}
                {e.license && (
                  <div>
                    <dt className={labelCls}>Izin</dt>
                    <dd className="mt-0.5 text-lp-ink-soft">
                      {e.license.issuer}
                      <br />
                      No. {e.license.number}
                    </dd>
                  </div>
                )}
              </dl>

              {c.href ? (
                <Link
                  href={c.href}
                  className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-lp-red-700 underline-offset-4 hover:underline"
                >
                  {c.cta} <span aria-hidden>→</span>
                </Link>
              ) : (
                <p className="mt-auto text-sm text-lp-ink-mute">Informasi lengkap menyusul.</p>
              )}
            </article>
          );
        })}
      </div>
    </Section>
  );
}

export function Services() {
  const paths = [
    {
      n: '01',
      name: 'Online',
      body: 'Konsultasi kurs dan transaksi lewat WhatsApp, pembayaran melalui transfer bank. Tidak perlu datang ke kantor.',
    },
    {
      n: '02',
      name: 'On the spot',
      body: 'Datang ke kantor dan bertransaksi tunai langsung, di Cengkareng atau Tangerang.',
    },
  ];
  return (
    <Section id="layanan" tone="paper2">
      <Eyebrow>Layanan PT Pusat Valas Indo</Eyebrow>
      <H2 className="mt-3 max-w-3xl">
        Dua cara tukar valas: <Em>online</Em> atau langsung.
      </H2>

      <div className="mt-14 divide-y divide-lp-line border-y border-lp-ink">
        {paths.map((p) => (
          <div key={p.n} className="grid gap-4 py-8 md:grid-cols-[6rem_1fr_1.2fr] md:items-baseline">
            <span className="font-display text-lp-figure font-bold tabular-nums text-lp-red-700">{p.n}</span>
            <h3 className="font-display text-[clamp(1.75rem,1.3rem+2vw,3rem)] font-bold leading-none tracking-[-0.03em]">{p.name}</h3>
            <p className="max-w-md text-lp-ink-soft">{p.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className={labelCls}>Mata uang yang sering ditransaksikan</p>
          <p className="mt-3 max-w-sm text-sm text-lp-ink-mute">
            Ketersediaan mengikuti stok. Kurs beli dan jual berubah sepanjang hari, jadi tidak kami pajang di sini.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <WhatsAppButton number={hq.whatsapp} text={ASK_RATE}>
              Tanya kurs · Cengkareng
            </WhatsAppButton>
            <WhatsAppButton number={tangerang.whatsapp} text={ASK_RATE} variant="outline">
              Tanya kurs · Tangerang
            </WhatsAppButton>
          </div>
          <Link href="/pusat-valas-indo" className={`${linkCls} mt-6 inline-block`}>
            Nama mata uang dan cara transaksi →
          </Link>
        </div>
        <ul className="grid grid-cols-3 border-l border-t border-lp-line sm:grid-cols-4">
          {currencyCodes.map((c) => (
            <li key={c} className="border-b border-r border-lp-line px-4 py-4 transition-colors hover:bg-lp-red-50">
              <CurrencyChip code={c} className="text-base" />
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

export function Locations() {
  return (
    <Section id="lokasi">
      <Eyebrow>Lokasi &amp; jam</Eyebrow>
      <H2 className="mt-3 max-w-3xl">
        Dua kantor, <Em>satu jam kerja.</Em>
      </H2>
      <div className="mt-14 grid gap-x-14 gap-y-14 border-t border-lp-ink pt-10 md:grid-cols-2">
        {branches.map((b, i) => (
          <address key={b.slug} className="flex flex-col not-italic">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-display text-lp-figure font-bold tabular-nums text-lp-line">{String(i + 1).padStart(2, '0')}</span>
              <HoursBadge hours={b.hours} className="text-lp-ink-soft" />
            </div>
            <p className="mt-4 font-display text-lp-h3 font-bold leading-tight tracking-[-0.02em]">{b.name}</p>
            <p className="mt-3 max-w-sm text-lp-ink-soft">
              {b.street}, {b.district}, {b.city}, {b.region} {b.postalCode}
            </p>
            {b.note && <p className="mt-2 text-sm text-lp-ink-mute">{b.note}</p>}

            <dl className="mt-6 divide-y divide-lp-line border-y border-lp-line text-sm">
              {[
                ['Senin–Jumat', '08.00–16.30'],
                ['Sabtu', '08.00–14.00'],
                ['Minggu', 'Tutup'],
              ].map(([d, t]) => (
                <div key={d} className="flex justify-between py-2">
                  <dt className="text-lp-ink-mute">{d}</dt>
                  <dd className="tabular-nums">{t} {t !== 'Tutup' && <span className="text-lp-ink-mute">WIB</span>}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <WhatsAppButton number={b.whatsapp} text={ASK_RATE}>
                {b.whatsappDisplay}
              </WhatsAppButton>
              <a
                href={b.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-lp-red-700 underline-offset-4 hover:underline"
              >
                Buka di Google Maps
              </a>
            </div>
            <Link href={`/lokasi/${b.slug}`} className={`${linkCls} mt-5 inline-block`}>
              Petunjuk lokasi dan detail cabang →
            </Link>
          </address>
        ))}
      </div>
    </Section>
  );
}

export function Reviews() {
  const [lead, ...rest] = reviews;
  return (
    <Section>
      <Eyebrow>Ulasan Google</Eyebrow>
      <H2 className="mt-3 max-w-3xl">
        Kata pelanggan di <Em>Google Maps.</Em>
      </H2>
      <div className="mt-14 grid gap-12 border-t border-lp-ink pt-10 lg:grid-cols-[1.3fr_1fr]">
        <figure>
          <span aria-hidden className="font-display text-8xl leading-none text-lp-red-700">“</span>
          <blockquote className="-mt-6 font-display text-[clamp(1.5rem,1.2rem+1.5vw,2.25rem)] font-semibold leading-tight tracking-[-0.02em] text-balance">
            {lead.quote}
          </blockquote>
          <figcaption className="mt-5 text-sm text-lp-ink-mute">Pelanggan, ulasan Google</figcaption>
        </figure>
        <div className="divide-y divide-lp-line border-y border-lp-line lg:border-y-0">
          {rest.map((r) => (
            <figure key={r.quote} className="py-6 first:pt-0 lg:first:pt-0">
              <blockquote className="text-lg leading-relaxed">“{r.quote}”</blockquote>
              <figcaption className="mt-3 text-sm text-lp-ink-mute">Pelanggan, ulasan Google</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </Section>
  );
}

/** `standalone`: dipakai di /pusat-kirim-duit, di mana H1 sudah ada di intro halaman. */
export function Pkd({ standalone = false }: { standalone?: boolean }) {
  return (
    <Section id="kirim-uang">
      {!standalone && (
        <>
          <Eyebrow>PT Pusat Kirim Duit</Eyebrow>
          <H2 className="mt-3 max-w-3xl">
            Kirim uang ke luar negeri untuk <Em>pengusaha.</Em>
          </H2>
        </>
      )}
      <p className={`max-w-2xl text-lp-lead text-lp-ink-soft ${standalone ? '' : 'mt-6'}`}>
        Minimum USD 1.000 (atau ekuivalen) per transaksi, ke 10 negara. Estimasi proses 2–4 hari kerja dengan
        kurs real-time. Penerima menarik dana di bank atau ATM setempat.
      </p>

      <div className="mt-14 grid gap-14 lg:grid-cols-2">
        <div>
          <p className={labelCls}>Biaya kirim</p>
          <dl className="mt-4 divide-y divide-lp-line border-y border-lp-line">
            {pkdFees.map((f) => (
              <div key={f.scenario} className="flex items-baseline justify-between gap-6 py-4">
                <dt className="text-sm text-lp-ink-soft">{f.scenario}</dt>
                <dd className="whitespace-nowrap font-display text-xl font-bold tabular-nums">{f.fee}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <p className={labelCls}>Negara &amp; mata uang tujuan</p>
          <ul className="mt-4 grid grid-cols-2 border-y border-lp-line">
            {pkdCurrencies.map((c) => (
              <li key={c.code} className="flex items-baseline gap-3 border-b border-lp-line py-3 pr-4 last:border-b-0 [&:nth-last-child(2)]:border-b-0">
                <CurrencyChip code={c.code} className="w-10 text-lp-red-700" />
                <span className="text-sm text-lp-ink-soft">{c.country}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-14 grid gap-10 border-t border-lp-line pt-10 md:grid-cols-2">
        <div>
          <p className="font-display text-lp-h3 font-bold">Dokumen perorangan</p>
          <ul className="mt-3 space-y-1 text-lp-ink-soft">
            {documents.personal.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-display text-lp-h3 font-bold">Dokumen perusahaan</p>
          <ul className="mt-3 space-y-1 text-lp-ink-soft">
            {documents.company.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-10">
        <WhatsAppButton number={pkdContact.whatsapp} text={ASK_REMIT}>
          Tanya pengiriman via WhatsApp
        </WhatsAppButton>
        {!standalone && (
          <Link href="/pusat-kirim-duit" className={`${linkCls} ml-5 inline-block`}>
            Detail biaya, dokumen, dan negara tujuan →
          </Link>
        )}
      </div>
    </Section>
  );
}

export function Steps() {
  return (
    <Section tone="paper2">
      <Eyebrow>Cara kerja</Eyebrow>
      <H2 className="mt-3 max-w-3xl">
        Tiga langkah, <Em>tanpa ribet.</Em>
      </H2>
      <ol className="mt-14 grid gap-10 border-t border-lp-line pt-10 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <span className="font-display text-lp-figure font-bold tabular-nums text-lp-red-700">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="mt-3 font-display text-lp-h3 font-bold">{s.title}</p>
            <p className="mt-2 text-lp-ink-soft">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function Trust() {
  return (
    <Section tone="night">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lp-brass">Legalitas</p>
      {/* `[color:white]`, bukan `text-white`: cn() (tailwind-merge) menganggap text-white bentrok dengan
          text-lp-h2 dan membuang ukuran font-nya. */}
      <H2 className="mt-3 max-w-3xl [color:white]">
        Izin yang bisa <span className="text-lp-brass">Anda periksa.</span>
      </H2>
      <dl className="mt-14 grid gap-10 border-t border-lp-night-line pt-10 md:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Izin PT Pusat Valas Indo</dt>
          <dd className="mt-2 font-display text-xl font-bold">
            Bank Indonesia
            <br />
            No. 20/28/KEP.GBI/DKSP/2018
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Beroperasi sejak</dt>
          <dd className="mt-2 font-display text-lp-figure font-bold tabular-nums">2018</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Ulasan Google</dt>
          <dd className="mt-2 font-display text-lp-figure font-bold tabular-nums">
            {pvi.googleRating.toLocaleString('id-ID')}★ <span className="text-base font-medium text-white/60">{pvi.googleReviewCount} ulasan · September 2026</span>
          </dd>
        </div>
      </dl>
    </Section>
  );
}

export function Faq({ items = faqs, tone = 'paper2' }: { items?: FaqItem[]; tone?: 'paper' | 'paper2' }) {
  return (
    <Section id="faq" tone={tone}>
      <Eyebrow>FAQ</Eyebrow>
      <H2 className="mt-3 max-w-3xl">
        Pertanyaan yang <Em>sering ditanyakan.</Em>
      </H2>
      <div className="mt-14 divide-y divide-lp-line border-y border-lp-line">
        {items.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-lg font-semibold">
              {f.q}
              <span aria-hidden className="text-2xl leading-none text-lp-red-700 transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 max-w-3xl text-lp-ink-soft">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function FinalCta() {
  return (
    <Section tone="red">
      <H2 className="max-w-3xl">Butuh kurs hari ini? Tanya lewat WhatsApp.</H2>
      <div className="mt-8 flex flex-wrap gap-3">
        <WhatsAppButton number={hq.whatsapp} text={ASK_RATE} variant="onRed">
          Valas · Cengkareng
        </WhatsAppButton>
        <WhatsAppButton number={tangerang.whatsapp} text={ASK_RATE} variant="onRed">
          Valas · Tangerang
        </WhatsAppButton>
        <WhatsAppButton number={pkdContact.whatsapp} text={ASK_REMIT} variant="onRed">
          Kirim uang · PKD
        </WhatsAppButton>
      </div>
    </Section>
  );
}
