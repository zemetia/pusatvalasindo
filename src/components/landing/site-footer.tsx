import { branches, entities } from '@/config/group';
import { Link } from '@/i18n/routing';

import { Container } from './ui';

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-lp-night pb-10 pt-16 text-white/70">
      <Container>
        <div className="grid gap-10 border-b border-lp-night-line pb-10 md:grid-cols-3">
          <div>
            <p className="font-display text-xl font-bold text-white">Pusat Valas Indo</p>
            <ul className="mt-4 space-y-1 text-sm">
              {Object.values(entities)
                .filter((e) => e.publishable)
                .map((e) => (
                  <li key={e.key}>
                    {e.hasPage ? (
                      <Link href={`/${e.slug}`} className="hover:text-white hover:underline underline-offset-4">
                        {e.legalName}
                      </Link>
                    ) : (
                      e.legalName
                    )}
                  </li>
                ))}
            </ul>
            <p className="mt-4 text-sm">Izin Bank Indonesia No. 20/28/KEP.GBI/DKSP/2018 (PT Pusat Valas Indo)</p>
          </div>
          {branches.map((b) => (
            <address key={b.slug} className="text-sm not-italic">
              <p className="font-semibold text-white">
                <Link href={`/lokasi/${b.slug}`} className="hover:underline underline-offset-4">
                  {b.name}
                </Link>
              </p>
              <p className="mt-2">{b.street}, {b.district}, {b.city}, {b.region} {b.postalCode}</p>
              <p className="mt-2">WhatsApp {b.whatsappDisplay}{b.telephoneDisplay ? ` · Telp ${b.telephoneDisplay}` : ''}</p>
            </address>
          ))}
        </div>
        <p className="mt-8 text-xs">
          Senin–Jumat 08.00–16.30 WIB · Sabtu 08.00–14.00 WIB · Minggu tutup. © {year} Grup Pusat Valas Indo.
        </p>
      </Container>
    </footer>
  );
}
