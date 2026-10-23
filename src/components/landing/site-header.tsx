'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { UserRound, ChevronDown, Menu, X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';

import { branches } from '@/config/group';
import { HoursBadge } from './hours-badge';
import { Container, WhatsAppButton } from './ui';

const hq = branches[0];

const groupItems = [
  {
    name: 'PT Pusat Valas Indo',
    desc: 'Money Changer',
    href: '/pusat-valas-indo',
  },
  {
    name: 'PT Pusat Kirim Duit',
    desc: 'Pengiriman Uang',
    href: '/pusat-kirim-duit',
  },
  {
    name: 'PT Pusat Tukar Uang',
    desc: 'Money Changer',
    href: '/#grup',
  },
];

const branchItems = [
  {
    name: 'Cengkareng',
    desc: 'Kantor Pusat · Jakarta Barat',
    href: '/lokasi/cengkareng',
  },
  {
    name: 'Tangerang',
    desc: 'Green Lake City',
    href: '/lokasi/tangerang',
  },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState<'group' | 'branch' | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Auto-close on route change
  useEffect(() => {
    setActiveDropdown(null);
    setMobileOpen(false);
  }, [pathname]);

  // Click outside & Escape key listeners
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveDropdown(null);
        setMobileOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleMouseEnter = (type: 'group' | 'branch') => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setActiveDropdown(type);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 120);
  };

  const isGroupActive =
    pathname?.includes('/pusat-valas-indo') ||
    pathname?.includes('/pusat-kirim-duit');

  const isBranchActive = pathname?.includes('/lokasi');
  const isBlogActive = pathname?.startsWith('/blog');

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-lp-line bg-lp-paper/95 backdrop-blur-md"
    >
      <Container className="flex h-16 items-center justify-between gap-6">
        {/* Logo */}
        <Link
          href="/"
          aria-label="Pusat Valas Indo, beranda"
          className="flex-shrink-0 transition-opacity hover:opacity-90"
          onClick={() => setActiveDropdown(null)}
        >
          <Image
            src="/images/logo/logo-red.png"
            alt="Pusat Valas Indo"
            width={358}
            height={108}
            className="h-8 md:h-9 w-auto"
            priority
          />
        </Link>

        {/* Desktop Nav */}
        <nav aria-label="Utama" className="hidden items-center gap-1 md:flex">
          {/* Group Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter('group')}
            onMouseLeave={handleMouseLeave}
          >
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'group' ? null : 'group')}
              aria-expanded={activeDropdown === 'group'}
              aria-haspopup="true"
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeDropdown === 'group' || isGroupActive
                  ? 'text-lp-red-700'
                  : 'text-lp-ink-soft hover:text-lp-red-700'
              }`}
            >
              <span>Group</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  activeDropdown === 'group' ? 'rotate-180 text-lp-red-700' : 'text-lp-ink-mute'
                }`}
                aria-hidden="true"
              />
            </button>

            {activeDropdown === 'group' && (
              <div
                className="absolute left-0 top-full pt-1.5 z-50 w-60"
                onMouseEnter={() => handleMouseEnter('group')}
                onMouseLeave={handleMouseLeave}
              >
                <div className="rounded-xl border border-lp-line bg-lp-paper/98 p-1.5 shadow-lg shadow-black/5 backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100">
                  {groupItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setActiveDropdown(null)}
                      className="group flex flex-col rounded-lg px-3 py-2 transition-colors hover:bg-lp-paper-2"
                    >
                      <span className="text-sm font-medium text-lp-ink group-hover:text-lp-red-700 transition-colors">
                        {item.name}
                      </span>
                      <span className="text-xs text-lp-ink-mute">
                        {item.desc}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cabang Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter('branch')}
            onMouseLeave={handleMouseLeave}
          >
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'branch' ? null : 'branch')}
              aria-expanded={activeDropdown === 'branch'}
              aria-haspopup="true"
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeDropdown === 'branch' || isBranchActive
                  ? 'text-lp-red-700'
                  : 'text-lp-ink-soft hover:text-lp-red-700'
              }`}
            >
              <span>Cabang</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  activeDropdown === 'branch' ? 'rotate-180 text-lp-red-700' : 'text-lp-ink-mute'
                }`}
                aria-hidden="true"
              />
            </button>

            {activeDropdown === 'branch' && (
              <div
                className="absolute left-0 top-full pt-1.5 z-50 w-56"
                onMouseEnter={() => handleMouseEnter('branch')}
                onMouseLeave={handleMouseLeave}
              >
                <div className="rounded-xl border border-lp-line bg-lp-paper/98 p-1.5 shadow-lg shadow-black/5 backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100">
                  {branchItems.map((branch) => (
                    <Link
                      key={branch.href}
                      href={branch.href}
                      onClick={() => setActiveDropdown(null)}
                      className="group flex flex-col rounded-lg px-3 py-2 transition-colors hover:bg-lp-paper-2"
                    >
                      <span className="text-sm font-medium text-lp-ink group-hover:text-lp-red-700 transition-colors">
                        {branch.name}
                      </span>
                      <span className="text-xs text-lp-ink-mute">
                        {branch.desc}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Blog */}
          <Link
            href="/blog"
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isBlogActive ? 'text-lp-red-700' : 'text-lp-ink-soft hover:text-lp-red-700'
            }`}
          >
            Blog
          </Link>

          {/* FAQ */}
          <Link
            href="/#faq"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-lp-ink-soft transition-colors hover:text-lp-red-700"
          >
            FAQ
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <HoursBadge hours={hq.hours} className="hidden text-lp-ink-mute lg:inline-flex" />

          <WhatsAppButton
            number={hq.whatsapp}
            text="Halo, saya mau tanya kurs hari ini."
            className="px-4 py-2 text-sm"
          >
            WhatsApp
          </WhatsAppButton>

          <Link
            href="/login"
            aria-label="Login admin"
            title="Login admin"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-lp-line text-lp-ink-soft transition-colors hover:border-lp-red-700 hover:text-lp-red-700"
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu navigasi'}
            aria-expanded={mobileOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-lp-line text-lp-ink-soft transition-colors hover:border-lp-red-700 hover:text-lp-red-700 md:hidden"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </Container>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-lp-line bg-lp-paper px-4 py-4 shadow-lg md:hidden animate-in slide-in-from-top-2 duration-150">
          <div className="space-y-4">
            {/* Group */}
            <div>
              <p className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wider text-lp-ink-mute">
                Group
              </p>
              <div className="space-y-0.5">
                {groupItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-lp-ink hover:bg-lp-paper-2 hover:text-lp-red-700"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-xs text-lp-ink-mute">{item.desc}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Cabang */}
            <div className="border-t border-lp-line/70 pt-3">
              <p className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wider text-lp-ink-mute">
                Cabang
              </p>
              <div className="space-y-0.5">
                {branchItems.map((branch) => (
                  <Link
                    key={branch.href}
                    href={branch.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-lp-ink hover:bg-lp-paper-2 hover:text-lp-red-700"
                  >
                    <span className="font-medium">{branch.name}</span>
                    <span className="text-xs text-lp-ink-mute">{branch.desc}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Direct Links: Blog & FAQ */}
            <div className="grid grid-cols-2 gap-2 border-t border-lp-line/70 pt-3">
              <Link
                href="/blog"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  isBlogActive
                    ? 'border-lp-red-300 bg-lp-red-50 text-lp-red-700'
                    : 'border-lp-line bg-lp-paper text-lp-ink hover:text-lp-red-700'
                }`}
              >
                Blog
              </Link>
              <Link
                href="/#faq"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center rounded-lg border border-lp-line bg-lp-paper px-3 py-2 text-sm font-medium text-lp-ink hover:text-lp-red-700"
              >
                FAQ
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
