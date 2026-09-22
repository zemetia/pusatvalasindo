import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  // Halaman lama dipindah ke /old dan diganti struktur baru. 301 supaya URL yang sudah
  // terindeks mewariskan sinyalnya ke padanan barunya (prefix locale lama: /en, /id).
  async redirects() {
    const moved: [string, string][] = [
      ["about", "/pusat-valas-indo"],
      ["services", "/pusat-valas-indo"],
      ["contact", "/lokasi/cengkareng"],
    ];
    return moved.flatMap(([from, to]) => [
      { source: `/${from}`, destination: to, permanent: true },
      { source: `/:locale(en|id)/${from}`, destination: to, permanent: true },
    ]);
  },
};

export default withNextIntl(nextConfig);
