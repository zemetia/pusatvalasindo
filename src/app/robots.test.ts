import { describe, expect, it } from 'vitest';
import robots from './robots';

describe('robots.ts', () => {
  it('menghasilkan konfigurasi robots dengan sitemap dan host kanonis', () => {
    const config = robots();
    expect(config.sitemap).toContain('/sitemap.xml');
    expect(config.host).toBeDefined();
    expect(Array.isArray(config.rules)).toBe(true);
  });

  it('memastikan bot AI diizinkan mengakses artikel blog, feed, sitemap, dan llms.txt', () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const aiRule = rules.find((r) => Array.isArray(r.userAgent) && r.userAgent.includes('GPTBot'));
    expect(aiRule).toBeDefined();
    const allowList = Array.isArray(aiRule?.allow) ? aiRule.allow : [aiRule?.allow];
    expect(allowList).toContain('/blog');
    expect(allowList).toContain('/blog/');
    expect(allowList).toContain('/llms.txt');
    expect(allowList).toContain('/llms-full.txt');
    expect(allowList).toContain('/feed.xml');
    expect(allowList).toContain('/sitemap.xml');
    expect(allowList).toContain('/images/');
  });

  it('melarang bot mengakses area privat dan dashboard', () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const defaultRule = rules.find((r) => r.userAgent === '*');
    expect(defaultRule).toBeDefined();
    const disallow = Array.isArray(defaultRule?.disallow) ? defaultRule.disallow : [defaultRule?.disallow];
    expect(disallow).toContain('/dashboard');
    expect(disallow).toContain('/api/');
    expect(disallow).toContain('/login');
    // Memastikan aset statis /_next/ tidak diblokir agar Googlebot dapat merender halaman
    expect(disallow).not.toContain('/_next/');
  });

  it('menyertakan AI crawler tambahan (CCBot, YouBot)', () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const aiRule = rules.find((r) => Array.isArray(r.userAgent) && r.userAgent.includes('CCBot'));
    expect(aiRule).toBeDefined();
    expect(Array.isArray(aiRule?.userAgent) && aiRule.userAgent.includes('YouBot')).toBe(true);
  });
});
