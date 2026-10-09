import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { branchBySlug, branches, entities } from '@/config/group';
import { siteConfig } from '@/config/site';
import { routing } from '@/i18n/routing';
import { branchCopy, branchFaqs } from '@/content/landing';
import { Faq, FinalCta } from '@/components/landing/sections';
import { PageIntro } from '@/components/landing/page-intro';
import {
  ASK_RATE,
  BranchCrossLinks,
  BranchDetail,
  InnerPage,
  RelatedLinks,
} from '@/components/landing/page-sections';
import { WhatsAppButton } from '@/components/landing/ui';
import { buildMetadata } from '@/lib/seo';
import {
  branchSchema,
  breadcrumbSchema,
  faqSchema,
  webPageSchema,
} from '@/lib/structured-data';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

/** Hanya cabang yang entitasnya boleh tayang (data lengkap). */
const published = () => branches.filter((b) => entities[b.entity].publishable);

export function generateStaticParams() {
  const branchList = published();
  return routing.locales.flatMap((locale) =>
    branchList.map((b) => ({ locale, slug: b.slug }))
  );
}

function pageOf(slug: string) {
  return siteConfig.pages[`lokasi-${slug}`];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (slug === 'tanggerang') return {};
  const page = pageOf(slug);
  if (!page) return {};
  return buildMetadata({
    title: page.title,
    description: page.description,
    path: page.path,
    locale,
    noIndex: !siteConfig.contentLocales.includes(locale),
  });
}

export default async function BranchPage({ params }: Props) {
  const { locale, slug } = await params;
  if (slug === 'tanggerang') {
    permanentRedirect(locale === 'en' ? '/en/lokasi/tangerang' : '/lokasi/tangerang');
  }

  const branch = branchBySlug(slug);
  const page = pageOf(slug);
  const copy = branchCopy[slug];
  if (!branch || !page || !copy || !entities[branch.entity].publishable) notFound();

  const url = `${siteConfig.url}${page.path}`;
  const faqs = branchFaqs(branch);
  const schemas = [
    webPageSchema({ name: page.title, description: page.description, url, dateModified: page.lastModified }),
    breadcrumbSchema([
      { name: 'Beranda', url: siteConfig.url },
      { name: branch.name, url },
    ]),
    branchSchema(branch, entities[branch.entity]),
    faqSchema(faqs.map((f) => ({ question: f.q, answer: f.a }))),
  ];

  return (
    <InnerPage id={`lokasi-${slug}`} schemas={schemas}>
      <PageIntro
        crumbs={[{ name: 'Beranda', href: '/' }, { name: branch.name }]}
        eyebrow={`Cabang ${branch.district}`}
        title={
          <>
            {copy.h1[0]}
            <em className="not-italic text-lp-red-700">{copy.h1[1]}</em>
          </>
        }
        lead={copy.lead}
      >
        <WhatsAppButton number={branch.whatsapp} text={ASK_RATE}>
          Tanya kurs via WhatsApp
        </WhatsAppButton>
      </PageIntro>
      <BranchDetail branch={branch} />
      <BranchCrossLinks branch={branch} />
      <Faq items={faqs} tone="paper" />
      <RelatedLinks currentPath={`/lokasi/${slug}`} tone="paper2" />
      <FinalCta />
    </InnerPage>
  );
}
