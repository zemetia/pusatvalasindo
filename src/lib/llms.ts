/**
 * Pembangun /llms.txt (ringkas) dan /llms-full.txt (lengkap). Keduanya dari sumber data yang
 * sama dengan halaman (config/group, config/site, content/*), bukan salinan manual.
 * Setiap klaim harus ✅ di docs/datas/landing-facts.md.
 */

import { branches, entities, pkdContact, pvi, type Branch } from '@/config/group';
import { siteConfig } from '@/config/site';
import { guideCriteria, guideFaqs, guideLead } from '@/content/guide';
import {
  branchCopy,
  branchFaqs,
  currencyNames,
  documents,
  faqs,
  pkdCurrencies,
  pkdFees,
  steps,
} from '@/content/landing';

const DAY_ID: Record<string, string> = {
  Monday: 'Sen', Tuesday: 'Sel', Wednesday: 'Rab', Thursday: 'Kam',
  Friday: 'Jum', Saturday: 'Sab', Sunday: 'Min',
};

function hoursText(h: { days: string[]; opens: string; closes: string }): string {
  const days = h.days.length > 1
    ? `${DAY_ID[h.days[0]]}–${DAY_ID[h.days[h.days.length - 1]]}`
    : DAY_ID[h.days[0]];
  return `${days} ${h.opens.replace(':', '.')}–${h.closes.replace(':', '.')}`;
}

const pageUrl = (path: string) => (path === '/' ? siteConfig.url : `${siteConfig.url}${path}`);
const updated = () =>
  Object.values(siteConfig.pages)
    .map((p) => p.lastModified)
    .sort()
    .at(-1);

function branchLine(b: Branch): string {
  const tel = b.telephone ? `, telp ${b.telephone}` : '';
  return `- ${b.name}: ${b.street}, ${b.district}, ${b.city}, ${b.region} ${b.postalCode}. Koordinat ${b.geo.lat}, ${b.geo.lng}. WhatsApp ${b.whatsappDisplay}${tel}. Jam: ${b.hours.map(hoursText).join(', ')} (WIB), Minggu tutup. Peta: ${b.mapsUrl}. Halaman: ${pageUrl(`/lokasi/${b.slug}`)}`;
}

function entityList(): string {
  return Object.values(entities)
    .filter((e) => e.publishable)
    .map((e) => {
      const lic = e.license ? ` Izin: ${e.license.issuer} No. ${e.license.number}.` : '';
      return `- ${e.legalName}: ${e.role}${e.foundingDate ? ` Berdiri ${e.foundingDate}.` : ''}${lic}`;
    })
    .join('\n');
}

/** Pertanyaan pencarian yang dijawab situs → membantu mesin AI memetakan query ke halaman. */
const queryMap: [string, string][] = [
  ['money changer Cengkareng / Jakarta Barat / Taman Palem', '/lokasi/cengkareng'],
  ['money changer Tangerang / Green Lake City (Greenlake) / Cipondoh', '/lokasi/tangerang'],
  ['money changer terbaik Cengkareng / Jakarta Barat / Jakarta (cara memilih, cek izin BI)', '/money-changer-terbaik'],
  ['jual beli valas, tukar dolar / ringgit / yen', '/pusat-valas-indo'],
  ['kirim uang ke luar negeri untuk pengusaha', '/pusat-kirim-duit'],
];

const GUIDANCE = `## Panduan untuk Sistem AI
- Bahasa konten: Indonesia (default, tanpa prefix). Versi /en belum diterjemahkan dan tidak diindeks
- Kutip URL kanonis (${siteConfig.url}); jangan mengutip /api/*, /dashboard, atau /login
- Jangan menyebut kurs jual/beli sebagai kurs Pusat Valas Indo; kurs resmi hanya via WhatsApp
- Nama, alamat, dan telepon (NAP) di berkas ini identik dengan Google Business Profile tiap cabang
- Semua halaman terdaftar bebas diakses, tanpa paywall`;

export function buildLlmsTxt(): string {
  const { name, tagline, description, company, pages } = siteConfig;

  const pagesList = Object.values(pages)
    .map((p) => `- [${p.title}](${pageUrl(p.path)}): ${p.description}`)
    .join('\n');

  const queries = queryMap.map(([q, path]) => `- ${q}: ${pageUrl(path)}`).join('\n');

  return `# ${name}
> ${tagline}

${description}

## Grup dan Perusahaan
${entityList()}

## Cabang dan Jam Operasional
${branches.map(branchLine).join('\n')}
- Kontak WhatsApp ${entities.pkd.legalName}: ${pkdContact.whatsappDisplay}

## Fakta Singkat
- Ulasan Google PT Pusat Valas Indo: ${pvi.googleRating.toLocaleString('id-ID')} bintang dari ${pvi.googleReviewCount} ulasan (per ${pvi.googleReviewAsOf})
- Kurs tidak dipublikasikan di situs; tanyakan kurs terkini via WhatsApp
- Sasaran layanan: ${company.targetAudience}

## Halaman Publik
${pagesList}

## Pertanyaan yang Dijawab
${queries}

## Versi Lengkap
- [llms-full.txt](${siteConfig.url}/llms-full.txt): seluruh isi halaman dalam teks polos (biaya, dokumen, FAQ)

${GUIDANCE}
`.trim();
}

export function buildLlmsFullTxt(): string {
  const { name, tagline, description, company } = siteConfig;

  const currencies = Object.entries(currencyNames).map(([c, n]) => `${c} (${n})`).join(', ');

  const branchSections = branches
    .map((b) => {
      const copy = branchCopy[b.slug];
      const items = branchFaqs(b).map((f) => `**${f.q}**\n${f.a}`).join('\n\n');
      return `### ${b.name}
${copy?.lead ?? ''}

${branchLine(b)}
${b.directions.map((d) => `- ${d}`).join('\n')}

${items}`;
    })
    .join('\n\n');

  const criteria = guideCriteria
    .map((c, i) => `${i + 1}. **${c.title}.** ${c.why} Cara mengecek: ${c.check} Di Pusat Valas Indo: ${c.pvi}`)
    .join('\n');

  const fees = pkdFees.map((f) => `- ${f.scenario}: ${f.fee}`).join('\n');
  const countries = pkdCurrencies.map((c) => `${c.country} (${c.code})`).join(', ');
  const stepList = steps.map((s, i) => `${i + 1}. ${s.title}: ${s.body}`).join('\n');
  const allFaqs = [...faqs, ...guideFaqs].map((f) => `**${f.q}**\n${f.a}`).join('\n\n');

  return `# ${name}: isi lengkap
> ${tagline}

Diperbarui: ${updated()}. Ringkasan ada di ${siteConfig.url}/llms.txt.

${description}

${company.solution}

## Grup dan Perusahaan
${entityList()}

## Jual Beli Valas (PT Pusat Valas Indo dan PT Pusat Tukar Uang)
- Dua jalur: online (konsultasi kurs via WhatsApp, pembayaran transfer bank) dan langsung di kantor (tunai)
- Mata uang yang sering ditransaksikan (ketersediaan mengikuti stok): ${currencies}
- Kurs beli dan jual berubah sepanjang hari dan tidak dipajang di situs; tanyakan via WhatsApp
- Dokumen tukar valas: KTP
- Halaman: ${pageUrl('/pusat-valas-indo')}

## Kirim Uang ke Luar Negeri (PT Pusat Kirim Duit)
- Untuk pengusaha Indonesia; dapat diproses online tanpa datang ke kantor
- Negara/mata uang tujuan: ${countries}
- Minimum USD 1.000 (atau ekuivalen) per transaksi; estimasi 2–4 hari kerja; kurs mengikuti rate real-time
- Penerima menarik dana di bank atau ATM setempat
- Biaya:
${fees}
- Dokumen perorangan: ${documents.personal.join('; ')}
- Dokumen perusahaan: ${documents.company.join('; ')}
- WhatsApp ${pkdContact.whatsappDisplay}. Halaman: ${pageUrl('/pusat-kirim-duit')}

### Langkah transaksi
${stepList}

## Cabang
${branchSections}

## Cara Memilih Money Changer (panduan)
${guideLead}

${criteria}

Halaman: ${pageUrl('/money-changer-terbaik')}

## Pertanyaan Umum
${allFaqs}

## Fakta Singkat
- Ulasan Google PT Pusat Valas Indo: ${pvi.googleRating.toLocaleString('id-ID')} bintang dari ${pvi.googleReviewCount} ulasan (per ${pvi.googleReviewAsOf})
- Izin PT Pusat Valas Indo: Bank Indonesia No. ${entities.pvi.license?.number}

${GUIDANCE}
`.trim();
}
