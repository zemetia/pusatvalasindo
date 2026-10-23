import { describe, expect, it, vi, beforeEach } from 'vitest';

const { listForFeedsMock } = vi.hoisted(() => ({
  listForFeedsMock: vi.fn(),
}));

vi.mock('@/backend/services/blog.service', () => ({
  blogService: {
    listForFeeds: listForFeedsMock,
  },
}));

import { GET } from './route';

describe('feed.xml route handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('menghasilkan XML RSS 2.0 yang valid dengan header application/xml', async () => {
    listForFeedsMock.mockResolvedValue([
      {
        slug: 'tips-tukar-valas',
        title: 'Tips Tukar Valas Aman & Murah',
        excerpt: 'Panduan tukar uang valas bagi pemula.',
        publishedAt: new Date('2026-10-20T08:00:00Z'),
        updatedAt: new Date('2026-10-21T09:00:00Z'),
        category: { name: 'Tips Valas' },
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/xml');

    const xml = await res.text();
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<channel>');
    expect(xml).toContain('<title>Tips Tukar Valas Aman &amp; Murah</title>');
    expect(xml).toContain('<link>https://pusatvalasindo.com/blog/tips-tukar-valas</link>');
    expect(xml).toContain('<category>Tips Valas</category>');
    expect(xml).toContain('<description>Panduan tukar uang valas bagi pemula.</description>');
  });

  it('tetap menghasilkan XML RSS valid saat daftar artikel kosong', async () => {
    listForFeedsMock.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('<channel>');
    expect(xml).toContain('</channel>');
    expect(xml).not.toContain('<item>');
  });

  it('meng-escape karakter khusus XML (<, >, &, \', ") dengan aman', async () => {
    listForFeedsMock.mockResolvedValue([
      {
        slug: 'kurs-usd-vs-idr',
        title: 'Kurs <USD> & "EUR" vs \'IDR\'',
        excerpt: 'Simbol <>&"\' harus di-escape.',
        publishedAt: null,
        updatedAt: new Date('2026-10-22T00:00:00Z'),
      },
    ]);

    const res = await GET();
    const xml = await res.text();
    expect(xml).toContain('&lt;USD&gt; &amp; &quot;EUR&quot; vs &apos;IDR&apos;');
    expect(xml).toContain('&lt;&gt;&amp;&quot;&apos;');
  });

  it('menyertakan tag enclosure dan media:content saat coverImageUrl tersedia', async () => {
    listForFeedsMock.mockResolvedValue([
      {
        slug: 'tukar-uang-cengkareng',
        title: 'Tukar Uang Cengkareng',
        excerpt: 'Lokasi cabang Cengkareng.',
        coverImageUrl: '/images/blog/cengkareng.jpg',
        publishedAt: new Date('2026-10-22T00:00:00Z'),
        updatedAt: new Date('2026-10-22T00:00:00Z'),
      },
    ]);

    const res = await GET();
    const xml = await res.text();
    expect(xml).toContain('<enclosure url="https://pusatvalasindo.com/images/blog/cengkareng.jpg" type="image/jpeg" length="0" />');
    expect(xml).toContain('<media:content url="https://pusatvalasindo.com/images/blog/cengkareng.jpg" medium="image" />');
  });
});
