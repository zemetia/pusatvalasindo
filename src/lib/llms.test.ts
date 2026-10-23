import { describe, expect, it } from 'vitest';
import { buildLlmsTxt, buildLlmsFullTxt } from './llms';

describe('llms.ts buildLlmsTxt and buildLlmsFullTxt', () => {
  const samplePosts = [
    {
      slug: 'cara-tukar-dolar-online',
      title: 'Cara Tukar Dolar Online',
      excerpt: 'Layanan kurir antar valas aman.',
      content: '## Panduan\n\nIsi panduan lengkap cara tukar dolar.',
      publishedAt: new Date('2026-10-20T10:00:00Z'),
      category: { name: 'Edukasi Valas' },
    },
  ];

  it('buildLlmsTxt menyertakan judul, tautan artikel, kategori, dan feed RSS', () => {
    const text = buildLlmsTxt(samplePosts);
    expect(text).toContain('# Pusat Valas Indo');
    expect(text).toContain('## Artikel Blog');
    expect(text).toContain('Feed RSS: https://pusatvalasindo.com/feed.xml');
    expect(text).toContain('[Cara Tukar Dolar Online](https://pusatvalasindo.com/blog/cara-tukar-dolar-online)');
    expect(text).toContain('[Edukasi Valas]');
  });

  it('buildLlmsFullTxt menyertakan konten lengkap artikel bila tersedia', () => {
    const text = buildLlmsFullTxt(samplePosts);
    expect(text).toContain('## Artikel Blog (Panduan Lengkap)');
    expect(text).toContain('### [Cara Tukar Dolar Online](https://pusatvalasindo.com/blog/cara-tukar-dolar-online)');
    expect(text).toContain('Kategori: Edukasi Valas');
    expect(text).toContain('Isi panduan lengkap cara tukar dolar.');
  });
});
