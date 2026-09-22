import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: 'PVI',
    description: siteConfig.tagline,
    start_url: '/',
    display: 'browser',
    background_color: '#fbfaf8',
    theme_color: '#c62828',
    lang: 'id-ID',
    icons: [{ src: '/images/logo/logo-red.png', sizes: '358x108', type: 'image/png' }],
  };
}
