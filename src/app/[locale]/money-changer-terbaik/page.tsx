import type { Metadata } from 'next';

import { branches } from '@/config/group';
import { siteConfig } from '@/config/site';
import { guideCriteria, guideFaqs, guideLead } from '@/content/guide';
import { Faq, FinalCta, Trust } from '@/components/landing/sections';
import { PageIntro } from '@/components/landing/page-intro';
import {
  ASK_RATE,
  BranchLinks,
  InnerPage,
  RelatedLinks,
  linkCls,
} from '@/components/landing/page-sections';
import { Em, Eyebrow, H2, Section, WhatsAppButton } from '@/components/landing/ui';
import { buildMetadata } from '@/lib/seo';
import {
  articleSchema,
  breadcrumbSchema,
  faqSchema,
  webPageSchema,
} from '@/lib/structured-data';

interface Props {
  params: Promise<{ locale: string }>;
}

const page = siteConfig.pages['money-changer-terbaik'];
const url = `${siteConfig.url}${page.path}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    title: page.title,
    description: page.description,
    path: page.path,
    locale,
    noIndex: !siteConfig.contentLocales.includes(locale),
  });
}

export default function MoneyChangerTerbaikPage() {
  const schemas = [
    webPageSchema({ name: page.title, description: page.description, url, dateModified: page.lastModified }),
    articleSchema({
      headline: 'Cara memilih money changer terbaik dan terpercaya di Cengkareng, Jakarta Barat, dan Tangerang',
      description: page.description,
      url,
      datePublished: page.lastModified,
      dateModified: page.lastModified,
      authorName: siteConfig.company.legalName,
    }),
    breadcrumbSchema([
      { name: 'Beranda', url: siteConfig.url },
      { name: 'Money changer terbaik', url },
    ]),
    faqSchema(guideFaqs.map((f) => ({ question: f.q, answer: f.a }))),
  ];

  return (
    <InnerPage id="guide" schemas={schemas}>
      <PageIntro
        crumbs={[{ name: 'Beranda', href: '/' }, { name: 'Money changer terbaik' }]}
        eyebrow="Panduan"
        title={
          <>
            Money changer terbaik dan terpercaya di Cengkareng, Jakarta Barat, dan Tangerang?{' '}
            <Em>Periksa enam hal ini.</Em>
          </>
        }
        lead={guideLead}
      >
        {branches.map((b, i) => (
          <WhatsAppButton key={b.slug} number={b.whatsapp} text={ASK_RATE} variant={i === 0 ? 'primary' : 'outline'}>
            Tanya kurs · {b.district}
          </WhatsAppButton>
        ))}
      </PageIntro>

      <Section>
        <Eyebrow>Kriteria</Eyebrow>
        <H2 className="mt-3 max-w-3xl">
          Enam kriteria, <Em>bisa Anda cek sendiri.</Em>
        </H2>
        <ol className="mt-14 divide-y divide-lp-line border-y border-lp-line">
          {guideCriteria.map((c, i) => (
            <li key={c.title} className="grid gap-6 py-10 md:grid-cols-[6rem_1fr_1fr]">
              <span className="font-display text-lp-figure font-bold tabular-nums text-lp-line">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="font-display text-lp-h3 font-bold leading-tight tracking-[-0.02em]">{c.title}</h3>
                <p className="mt-3 text-lp-ink-soft">{c.why}</p>
                <p className="mt-3 text-lp-ink-soft">
                  <span className="font-semibold text-lp-ink">Cara mengecek: </span>
                  {c.check}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lp-ink-mute">Di Pusat Valas Indo</p>
                <p className="mt-3 text-lp-ink-soft">{c.pvi}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-lp-ink-mute">
          Daftar resmi penyelenggara KUPVA bukan bank berizin dipublikasikan Bank Indonesia di{' '}
          <a href="https://www.bi.go.id" target="_blank" rel="noopener noreferrer" className={linkCls}>
            bi.go.id
          </a>
          .
        </p>
      </Section>

      <Trust />
      <BranchLinks
        tone="paper"
        title={
          <>
            Cabang di <Em>Cengkareng dan Tangerang.</Em>
          </>
        }
      />
      <Faq items={guideFaqs} tone="paper2" />
      <RelatedLinks currentPath="/money-changer-terbaik" />
      <FinalCta />
    </InnerPage>
  );
}
