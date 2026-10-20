/**
 * Structured data (JSON-LD) helpers for GEO — Generative Engine Optimization.
 * These schemas make content citable and indexable by AI search engines
 * (Perplexity, ChatGPT Browse, Google AI Overviews, Bing Copilot).
 *
 * Usage in a Server Component:
 * ```tsx
 * import { StructuredData, organizationSchema } from '@/lib/structured-data';
 * <StructuredData id="org" schema={organizationSchema()} />
 * ```
 */

import { siteConfig } from '@/config/site';
import { branches, entities, type Branch, type Entity } from '@/config/group';

// ─── Type stubs (avoid @types/schema-dts as a dep) ───────────────────────────

interface WithContext<T> {
  '@context': 'https://schema.org';
  '@type': T extends { '@type': infer U } ? U : string;
  [key: string]: unknown;
}

const LOGO_PATH = '/images/logo/logo-red.png';

/** @id stabil supaya semua schema di semua halaman menunjuk ke entitas yang sama (graf entitas). */
export const ORG_ID = `${siteConfig.url}/#organization`;
export const WEBSITE_ID = `${siteConfig.url}/#website`;
const entityId = (e: Entity) => `${siteConfig.url}/#${e.key}`;

// ─── Schema builders ─────────────────────────────────────────────────────────

/** Organization schema — attach once in the root layout or home page. */
export function organizationSchema(): WithContext<unknown> {
  const { company, name, url } = siteConfig;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: company.legalName,
    alternateName: [name, 'PVI'],
    url,
    logo: {
      '@type': 'ImageObject',
      url: `${url}${LOGO_PATH}`,
    },
    foundingDate: String(company.foundedYear),
    ...(company.contactEmail ? { email: company.contactEmail } : {}),
    subOrganization: Object.values(entities)
      .filter((e) => e.publishable)
      .map((e) => ({
        '@type': 'Organization',
        '@id': entityId(e),
        name: e.legalName,
        ...(e.hasPage ? { url: `${url}/${e.slug}` } : {}),
        ...(e.license
          ? { identifier: { '@type': 'PropertyValue', name: e.license.issuer, value: e.license.number } }
          : {}),
      })),
    location: allBranchRefs(),
    areaServed: [
      'DKI Jakarta',
      'Jakarta',
      'Jakarta Selatan',
      'Jakarta Pusat',
      'Jakarta Barat',
      'Jakarta Utara',
      'Jakarta Timur',
      'Cengkareng',
      'Tangerang',
      'Kota Tangerang',
      'Green Lake City',
    ],
    knowsAbout: [
      'Money changer',
      'Money changer terbaik di Jakarta',
      'Penukaran valuta asing online',
      'Tukar valas antar kurir',
      'Pengiriman uang ke luar negeri',
    ],
    description: siteConfig.description,
    sameAs: Object.values(company.socialLinks).filter(Boolean),
  };
}

const dayUrl = (d: string) => `https://schema.org/${d}`;

const branchId = (b: Branch) => `${siteConfig.url}/lokasi/${b.slug}#branch`;
function allBranchRefs() {
  return branches
    .filter((b) => entities[b.entity].publishable)
    .map((b) => ({ '@id': branchId(b) }));
}

/** WebSite — menghubungkan semua halaman ke satu situs dan satu penerbit (Organization). */
export function websiteSchema(): WithContext<unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: siteConfig.url,
    name: siteConfig.name,
    inLanguage: 'id-ID',
    publisher: { '@id': ORG_ID },
  };
}

/**
 * LocalBusiness per cabang — NAP harus identik dengan Google Business Profile.
 * `CurrencyExchange` bukan tipe schema.org (Google mengabaikannya); FinancialService adalah
 * subtipe LocalBusiness yang valid.
 */
export function branchSchema(branch: Branch, entity: Entity): WithContext<unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FinancialService',
    '@id': branchId(branch),
    name: branch.name,
    description: `Money changer (jual beli valuta asing) ${entity.legalName} di ${branch.district}, ${branch.city}.`,
    image: `${siteConfig.url}${LOGO_PATH}`,
    areaServed: [branch.city, branch.district],
    // Satu kantor untuk dua PT (PVI + PTU); pemegang izin yang tercatat adalah `entity`.
    parentOrganization: [
      { '@id': ORG_ID },
      ...[entity, ...branch.coOperators.map((k) => entities[k])].map((e) => ({
        '@type': 'Organization',
        '@id': entityId(e),
        name: e.legalName,
      })),
    ],
    // Profil Google Business/Maps cabang: mengikat entitas web ke listing GBP (cocokkan NAP).
    sameAs: [branch.mapsUrl],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      url: `https://wa.me/${branch.whatsapp}`,
      availableLanguage: ['id', 'en'],
    },
    currenciesAccepted: 'IDR',
    alternateName: branch.alternateNames,
    geo: { '@type': 'GeoCoordinates', latitude: branch.geo.lat, longitude: branch.geo.lng },
    hasMap: branch.mapsUrl,
    url: `${siteConfig.url}/lokasi/${branch.slug}`,
    ...(branch.telephone ? { telephone: branch.telephone } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: branch.street,
      addressLocality: branch.city,
      addressRegion: branch.region,
      postalCode: branch.postalCode,
      addressCountry: branch.country,
    },
    openingHoursSpecification: branch.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days.map(dayUrl),
      opens: h.opens,
      closes: h.closes,
    })),
    ...(entity.license
      ? { identifier: { '@type': 'PropertyValue', name: entity.license.issuer, value: entity.license.number } }
      : {}),
  };
}

/** Semua cabang yang entitasnya boleh tayang. */
export function allBranchSchemas(): WithContext<unknown>[] {
  return branches
    .filter((b) => entities[b.entity].publishable)
    .map((b) => branchSchema(b, entities[b.entity]));
}

export interface ServiceSchemaOptions {
  name: string;
  description: string;
  url: string;
  serviceType: string;
  /** Kunci entitas penyedia layanan */
  provider: Entity;
  areaServed?: string[];
}

/** Service schema — halaman layanan (tukar valas, kirim uang). Biaya sengaja tidak dimodelkan sebagai `price`. */
export function serviceSchema(opts: ServiceSchemaOptions): WithContext<unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    serviceType: opts.serviceType,
    provider: {
      '@type': 'Organization',
      '@id': entityId(opts.provider),
      name: opts.provider.legalName,
      url: `${siteConfig.url}/${opts.provider.slug}`,
    },
    ...(opts.areaServed ? { areaServed: opts.areaServed } : {}),
  };
}

export interface WebPageSchemaOptions {
  name: string;
  description: string;
  url: string;
  /** ISO 8601, e.g. '2024-01-01' */
  datePublished?: string;
  dateModified?: string;
}

/** WebPage schema — attach to every public page. */
export function webPageSchema(opts: WebPageSchemaOptions): WithContext<unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    '@id': `${opts.url}#webpage`,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORG_ID },
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    inLanguage: 'id-ID',
  };
}

export interface FAQ {
  question: string;
  answer: string;
}

/**
 * FAQPage schema — drives rich result FAQ snippets in Google and answer boxes
 * in AI search engines. Add to any page with a FAQ section.
 */
export function faqSchema(faqs: FAQ[]): WithContext<unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/** BreadcrumbList schema — improves SERP display and helps AI understand site structure. */
export function breadcrumbSchema(items: BreadcrumbItem[]): WithContext<unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface ArticleSchemaOptions {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
  image?: string;
}

/** Article schema — use on blog posts, changelog entries, and docs pages. */
export function articleSchema(opts: ArticleSchemaOptions): WithContext<unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    author: {
      '@type': 'Organization',
      name: siteConfig.company.legalName,
      url: siteConfig.url,
    },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.company.legalName,
      logo: {
        '@type': 'ImageObject',
        url: `${siteConfig.url}${siteConfig.ogImage}`,
      },
    },
    image: opts.image ?? `${siteConfig.url}${siteConfig.ogImage}`,
    isPartOf: { '@type': 'WebSite', url: siteConfig.url },
  };
}

export interface BlogPostingSchemaOptions {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  /** URL absolut gambar sampul; kosong → gambar OG default situs. */
  image?: string;
  section?: string;
  wordCount?: number;
}

/**
 * BlogPosting untuk satu artikel blog. Penulisnya sengaja organisasi, bukan nama
 * staf: situs publik tidak menampilkan akun internal, dan Google menerima Organization
 * sebagai author untuk konten korporat.
 */
export function blogPostingSchema(opts: BlogPostingSchemaOptions): WithContext<unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${opts.url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': opts.url },
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    inLanguage: 'id-ID',
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    image: opts.image ?? `${siteConfig.url}${siteConfig.ogImage}`,
    isPartOf: { '@id': WEBSITE_ID },
    ...(opts.section ? { articleSection: opts.section } : {}),
    ...(opts.wordCount ? { wordCount: opts.wordCount } : {}),
  };
}

/** Halaman indeks blog: koleksi artikel terbaru. */
export function blogSchema(opts: {
  name: string;
  description: string;
  url: string;
  posts: Array<{ headline: string; url: string; datePublished: string }>;
}): WithContext<unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${opts.url}#blog`,
    name: opts.name,
    description: opts.description,
    url: opts.url,
    inLanguage: 'id-ID',
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': WEBSITE_ID },
    blogPost: opts.posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.headline,
      url: p.url,
      datePublished: p.datePublished,
    })),
  };
}

// ─── Serialization helper ─────────────────────────────────────────────────────

/**
 * Serialize a schema to a JSON string that is safe inside an inline
 * `<script type="application/ld+json">` via dangerouslySetInnerHTML.
 *
 * `JSON.stringify` alone is NOT enough: it leaves `<` untouched, so a value such as
 * `</script><script>…` (blog titles come from the database / MCP agents) would end the
 * script element and inject markup. `<` is therefore emitted as a JSON unicode escape
 * (backslash, "u003c"), which JSON parsers decode back to `<` — the structured data is
 * unchanged, but the HTML parser can never see a closing tag. U+2028/U+2029 are escaped
 * the same way for older JS parsers.
 *
 * Usage in a Server Component (page.tsx):
 * ```tsx
 * import { serializeSchema, webPageSchema } from '@/lib/structured-data';
 *
 * export default function Page() {
 *   return (
 *     <script
 *       id="webpage-schema"
 *       type="application/ld+json"
 *       dangerouslySetInnerHTML={{ __html: serializeSchema(webPageSchema({ ... })) }}
 *     />
 *   );
 * }
 * ```
 */
const BACKSLASH = String.fromCharCode(92);
/** `<` (menutup <script>) serta pemisah baris U+2028/U+2029 (merusak parser JS lama). */
const SCRIPT_UNSAFE = new RegExp(
  '[<' + String.fromCharCode(0x2028) + String.fromCharCode(0x2029) + ']',
  'g'
);
const escapeUnsafe = (ch: string) =>
  BACKSLASH + 'u' + ch.charCodeAt(0).toString(16).padStart(4, '0');

export function serializeSchema(schema: WithContext<unknown> | WithContext<unknown>[]): string {
  return JSON.stringify(schema).replace(SCRIPT_UNSAFE, escapeUnsafe);
}
