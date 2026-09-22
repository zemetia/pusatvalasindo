import type { Metadata } from 'next';

import { branches, entities } from '@/config/group';
import { siteConfig } from '@/config/site';
import { faqsFor } from '@/content/landing';
import { Faq, FinalCta, Trust } from '@/components/landing/sections';
import { PageIntro } from '@/components/landing/page-intro';
import {
  ASK_RATE,
  BranchLinks,
  CurrencyList,
  InnerPage,
  RelatedLinks,
  PviChannels,
} from '@/components/landing/page-sections';
import { WhatsAppButton } from '@/components/landing/ui';
import { buildMetadata } from '@/lib/seo';
import {
  breadcrumbSchema,
  faqSchema,
  serviceSchema,
  webPageSchema,
} from '@/lib/structured-data';

interface Props {
  params: Promise<{ locale: string }>;
}

const page = siteConfig.pages['pusat-valas-indo'];
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

export default function PusatValasIndoPage() {
  const faqs = faqsFor('pvi');
  const schemas = [
    webPageSchema({ name: page.title, description: page.description, url, dateModified: page.lastModified }),
    breadcrumbSchema([
      { name: 'Beranda', url: siteConfig.url },
      { name: 'Pusat Valas Indo', url },
    ]),
    serviceSchema({
      name: 'Jual beli valuta asing (money changer)',
      description: page.description,
      url,
      serviceType: 'Penukaran valuta asing',
      provider: entities.pvi,
      areaServed: ['Jakarta Barat', 'Kota Tangerang'],
    }),
    faqSchema(faqs.map((f) => ({ question: f.q, answer: f.a }))),
  ];

  return (
    <InnerPage id="pvi" schemas={schemas}>
      <PageIntro
        crumbs={[{ name: 'Beranda', href: '/' }, { name: 'Pusat Valas Indo' }]}
        eyebrow="PT Pusat Valas Indo"
        title={
          <>
            Jual beli valas di money changer <em className="not-italic text-lp-red-700">berizin Bank Indonesia.</em>
          </>
        }
        lead={`PT Pusat Valas Indo adalah money changer berizin Bank Indonesia (No. ${entities.pvi.license?.number}) yang beroperasi sejak ${entities.pvi.foundingDate} di Cengkareng, Jakarta Barat dan Cipondoh, Kota Tangerang.`}
      >
        {branches.map((b, i) => (
          <WhatsAppButton key={b.slug} number={b.whatsapp} text={ASK_RATE} variant={i === 0 ? 'primary' : 'outline'}>
            Tanya kurs · {b.district}
          </WhatsAppButton>
        ))}
      </PageIntro>
      <PviChannels />
      <CurrencyList />
      <Trust />
      <BranchLinks />
      <Faq items={faqs} tone="paper" />
      <RelatedLinks currentPath="/pusat-valas-indo" tone="paper2" />
      <FinalCta />
    </InnerPage>
  );
}
