import type { Metadata } from 'next';

import { Entities, Faq, FinalCta, Hero, Locations, Pkd, Reviews, Services, Steps, Trust } from '@/components/landing/sections';
import { RelatedLinks } from '@/components/landing/page-sections';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteHeader } from '@/components/landing/site-header';
import { siteConfig } from '@/config/site';
import { faqs } from '@/content/landing';
import { buildMetadata } from '@/lib/seo';
import {
  allBranchSchemas,
  faqSchema,
  organizationSchema,
  serializeSchema,
  webPageSchema,
  websiteSchema,
} from '@/lib/structured-data';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const page = siteConfig.pages['home'];
  return buildMetadata({
    title: page.title,
    description: page.description,
    path: page.path,
    locale,
    // Terjemahan Inggris belum ada; jangan diindeks sebagai duplikat.
    noIndex: !siteConfig.contentLocales.includes(locale),
  });
}

export default function HomePage() {
  const page = siteConfig.pages['home'];
  const schemas = [
    organizationSchema(),
    websiteSchema(),
    ...allBranchSchemas(),
    webPageSchema({ name: page.title, description: page.description, url: siteConfig.url }),
    faqSchema(faqs.map((f) => ({ question: f.q, answer: f.a }))),
  ];

  return (
    <>
      <script
        id="home-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeSchema(schemas) }}
      />
      <SiteHeader />
      <main>
        <Hero />
        <Entities />
        <Services />
        <Pkd />
        <Steps />
        <Locations />
        <Trust />
        <Reviews />
        <Faq />
        <RelatedLinks currentPath="/" />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
